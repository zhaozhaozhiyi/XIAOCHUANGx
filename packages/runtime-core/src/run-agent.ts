import { spawn } from "node:child_process";
import { getAgentRegistryEntry } from "./agent-registry.js";
import { getAgentAdapter } from "./adapters/index.js";
import {
  buildResolvedCommandArgs,
  resolveWindowsCommand,
} from "./windows-command.js";
import { attachAcpBridge, attachPiRpcBridge } from "./rpc-bridge.js";
import type {
  RunAgentCallbacks,
  RunAgentInput,
  RunAgentResult,
  RunAgentUserInputResponse,
} from "./types.js";

function humanizeCliFailure(bin: string, text: string): string {
  const detail = text.trim();
  if (!detail) return detail;
  if (
    bin === "claude" &&
    /unauthenticated|please.*log\s*in|not logged|authentication.*failed/i.test(
      detail,
    )
  ) {
    return "Claude Code CLI 未完成登录。请在终端执行 claude 完成 OAuth 登录后重试。";
  }
  return detail;
}

export async function runAgent(
  input: RunAgentInput,
  callbacks: RunAgentCallbacks,
  options?: {
    signal?: AbortSignal;
    timeoutMs?: number;
    idleTimeoutMs?: number;
    onUserInputHandlerReady?: (handler: (response: RunAgentUserInputResponse) => boolean) => void;
  },
): Promise<RunAgentResult> {
  const composed = input.composedPrompt?.trim() ?? "";
  if (options?.signal?.aborted) {
    return {
      exitCode: null,
      signal: "SIGTERM",
      cancelled: true,
      emptyOutput: true,
    };
  }

  if (!composed) {
    callbacks.onError?.("composedPrompt 为空", "prompt_empty");
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: true,
    };
  }

  const agentSpec = getAgentRegistryEntry(input.agentId);
  if (!agentSpec.execution.supportsCompanionRun) {
    const message =
      agentSpec.execution.unsupportedReason ??
      `${agentSpec.execution.displayName} 暂未在当前 Companion runtime 中实现`;
    callbacks.onError?.(message, "agent_not_supported");
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: true,
    };
  }

  const adapter = getAgentAdapter(input.agentId);
  const buildArgs = {
    cwd: input.cwd,
    agentModel: input.agentModel,
    composedPrompt: composed,
    extraAllowedDirs: input.extraAllowedDirs,
  };
  const spec = adapter.createLaunchSpec(buildArgs);
  if (spec.promptArgvRejected) {
    callbacks.onError?.(
      `${agentSpec.execution.displayName} 当前 prompt 过长，请缩短上下文或改用支持 stdin 的 agent`,
      "prompt_too_large",
    );
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: true,
    };
  }

  const body = adapter.stdinBody?.(input) ?? input.composedPrompt;

  const state = {
    textEmitted: false,
    threadId: undefined as string | undefined,
  };
  const wrap = (ev: Parameters<NonNullable<typeof adapter.onEvent>>[0]) => {
    adapter.onEvent?.(ev, state, callbacks);
  };

  const parser = adapter.createParser(wrap);

  const stdinMode =
    spec.stdinPayload === "ignore" || spec.promptViaArgs ? "ignore" : "pipe";

  return new Promise((resolve) => {
    const command = resolveWindowsCommand(spec.bin);
    const spawnArgs = buildResolvedCommandArgs(command, spec.args);

    const child = spawn(command.bin, spawnArgs, {
      cwd: input.cwd,
      env: { ...process.env },
      stdio: [stdinMode, "pipe", "pipe"],
      shell: false,
      windowsVerbatimArguments: command.windowsVerbatimArguments,
      ...adapter.spawnOptions?.({
        input,
        buildArgs,
        spec,
      }),
    });

    const writeClaudeToolResult = (
      response: RunAgentUserInputResponse,
    ): boolean => {
      if (!child.stdin || child.stdin.destroyed || child.killed) return false;
      const line = JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: response.toolUseId,
              content: response.content,
              is_error: response.isError === true,
            },
          ],
        },
      });
      return child.stdin.write(`${line}\n`, "utf8");
    };

    if (spec.stdinAsClaudeUserMessage) {
      options?.onUserInputHandlerReady?.(writeClaudeToolResult);
    }

    let stderrTail = "";
    let stdoutTail = "";
    let settled = false;
    let cancelled = false;
    let rpcSession:
      | ReturnType<typeof attachAcpBridge>
      | ReturnType<typeof attachPiRpcBridge>
      | null = null;

    const stopChild = () => {
      if (rpcSession) {
        rpcSession.abort();
      } else {
        child.kill("SIGTERM");
      }
    };

    let idleTimer: NodeJS.Timeout | null = null;
    let timer: NodeJS.Timeout | null = null;
    const clearIdleTimer = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    };
    const touchIdleTimer = () => {
      const idleTimeoutMs = options?.idleTimeoutMs;
      if (!idleTimeoutMs || idleTimeoutMs <= 0) return;
      clearIdleTimer();
      idleTimer = setTimeout(() => {
        callbacks.onError?.("Agent 长时间无输出，执行已空闲超时", "idle_timeout");
        stopChild();
      }, idleTimeoutMs);
    };

    if (spec.streamFormat === "acp-json-rpc") {
      rpcSession = attachAcpBridge({
        child,
        prompt: body,
        model: input.agentModel,
        cwd: input.cwd,
        onEvent: wrap,
      });
    } else if (spec.streamFormat === "pi-rpc") {
      rpcSession = attachPiRpcBridge({
        child,
        prompt: body,
        model: input.agentModel,
        onEvent: wrap,
      });
    }

    const finish = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
    ) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      clearIdleTimer();
      options?.signal?.removeEventListener("abort", onAbort);
      parser.flush();
      const baseResult = {
        exitCode,
        signal,
        cancelled,
        emptyOutput: !state.textEmitted && exitCode === 0,
        stderrTail: stderrTail.trim() || undefined,
        stdoutTail: stdoutTail.trim() || undefined,
      };
      resolve(
        adapter.finalizeResult?.(state, {
          ...baseResult,
          exitCode:
            exitCode === null &&
            signal === "SIGTERM" &&
            rpcSession?.completedSuccessfully()
              ? 0
              : exitCode,
        }) ?? {
          ...baseResult,
          exitCode:
            exitCode === null &&
            signal === "SIGTERM" &&
            rpcSession?.completedSuccessfully()
              ? 0
              : exitCode,
          codexThreadId: state.threadId,
        },
      );
    };

    const onAbort = () => {
      cancelled = true;
      stopChild();
    };
    if (options?.signal?.aborted) {
      onAbort();
    } else {
      options?.signal?.addEventListener("abort", onAbort, { once: true });
    }

    const timeoutMs = options?.timeoutMs;
    if (typeof timeoutMs === "number" && timeoutMs > 0) {
      timer = setTimeout(() => {
        callbacks.onError?.("Agent 执行超时", "timeout");
        stopChild();
      }, timeoutMs);
    }
    touchIdleTimer();

    child.stdout?.on("data", (d) => {
      const chunk = String(d);
      stdoutTail = (stdoutTail + chunk).slice(-2000);
      touchIdleTimer();
      if (rpcSession) {
        rpcSession.onStdout(chunk);
      } else {
        parser.feed(chunk);
      }
    });

    child.stderr?.on("data", (d) => {
      stderrTail = (stderrTail + String(d)).slice(-2000);
      touchIdleTimer();
    });

    child.on("error", (err) => {
      callbacks.onError?.(err.message, "spawn_error");
      finish(1, null);
    });

    child.on("close", (code, signal) => {
      if (code !== 0 && !cancelled && !state.textEmitted) {
        const hint = stderrTail || stdoutTail;
        callbacks.onError?.(
          humanizeCliFailure(spec.bin, hint).slice(0, 500) ||
            `${spec.bin} 退出码 ${code ?? "?"}`,
          "cli_exit",
        );
      }
      rpcSession?.onClose();
      finish(code, signal);
    });

    if (
      !rpcSession &&
      spec.stdinPayload !== "ignore" &&
      !spec.promptViaArgs &&
      child.stdin &&
      body
    ) {
      child.stdin.on("error", () => {
        /* EPIPE when child exits early */
      });
      try {
        adapter.writeToStdin?.({
          stdin: child.stdin,
          body,
          spec,
          input,
        });
      } catch (err) {
        if (!cancelled) {
          callbacks.onError?.(
            err instanceof Error ? err.message : "stdin write failed",
            "stdin_error",
          );
        }
      }
    }
  });
}

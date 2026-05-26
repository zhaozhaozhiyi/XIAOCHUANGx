import type { AgentId } from "../types.js";
import { getAgentRegistryEntry } from "../agent-registry.js";
import { resolveWindowsCommand } from "../windows-command.js";
import {
  DEFAULT_ARGV_PROMPT_BUDGET_BYTES,
  estimatePromptBytes,
} from "../compose-daemon-prompt.js";

export type BuildArgsContext = {
  cwd: string;
  agentModel: string;
  /** OD 对齐：整轮 prompt 走 stdin，避免 argv 过长（E2BIG / ENAMETOOLONG） */
  composedPrompt: string;
  extraAllowedDirs?: string[];
};

export type AgentLaunchSpec = {
  bin: string;
  args: string[];
  requiresShell?: boolean;
  streamFormat:
    | "codex-json"
    | "claude-jsonl"
    | "plain"
    | "json-event-stream"
    | "copilot-stream-json"
    | "qoder-stream-json"
    | "acp-json-rpc"
    | "pi-rpc";
  closeStdinAfterPrompt: boolean;
  stdinAsClaudeUserMessage?: boolean;
  promptViaArgs?: boolean;
  stdinPayload?: "composed" | "ignore";
  /** argv 投递时超过预算则应在 spawn 前由调用方报错 */
  promptArgvRejected?: boolean;
};

export function buildLaunchSpec(
  agentId: AgentId,
  ctx: BuildArgsContext,
): AgentLaunchSpec {
  switch (agentId) {
    case "codex":
      return buildCodexArgs(ctx);
    case "claude":
      return buildClaudeArgs(ctx);
    case "hermes":
      return buildHermesArgs(ctx);
    case "cursor-agent":
      return buildCursorAgentArgs(ctx);
    case "gemini":
      return buildGeminiArgs(ctx);
    case "opencode":
      return buildOpenCodeArgs(ctx);
    case "copilot":
      return buildCopilotArgs(ctx);
    case "qoder":
      return buildQoderArgs(ctx);
    case "deepseek":
      return buildDeepSeekArgs(ctx);
    case "devin":
      return buildDevinArgs(ctx);
    case "pi":
      return buildPiArgs(ctx);
    case "kiro":
      return buildKiroArgs(ctx);
    case "kilo":
      return buildKiloArgs(ctx);
    case "vibe":
      return buildVibeArgs(ctx);
    case "openclaw":
      return buildOpenClawArgs(ctx);
  }
}

function pushAddDirs(args: string[], dirs?: string[]): void {
  for (const d of dirs ?? []) {
    if (typeof d === "string" && d.length > 0) {
      args.push("--add-dir", d);
    }
  }
}

/**
 * Codex：prompt 仅 stdin（对齐 OD codexAgentDef.promptViaStdin）。
 * 不使用 `exec resume` — 每轮全量 transcript 重放，避免 resume 时剥掉 Instructions。
 */
function buildCodexArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("codex");
  const command = resolveWindowsCommand(registry.execution.bin);
  const isWindows = process.platform === "win32";
  const args = isWindows
    ? ["exec", "--json", "--skip-git-repo-check", "--sandbox", "danger-full-access"]
    : [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        "-c",
        "sandbox_workspace_write.network_access=true",
      ];
  args.push("-C", ctx.cwd);
  pushAddDirs(args, ctx.extraAllowedDirs);
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  return {
    bin: command.bin,
    args,
    requiresShell: command.requiresShell,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

/**
 * Claude：Instructions 与 transcript 合并进 stdin stream-json user 行（对齐 OD）。
 * 不使用 `--system-prompt` + 分离 user，避免 system 与 transcript 不同步。
 */
function buildClaudeArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("claude");
  const args = [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "bypassPermissions",
  ];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  pushAddDirs(args, ctx.extraAllowedDirs);
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinAsClaudeUserMessage: true,
    stdinPayload: "composed",
  };
}

function buildHermesArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("hermes");
  const bytes = estimatePromptBytes(ctx.composedPrompt);
  const args = ["chat", "--max-turns", "30", "--yolo", "--accept-hooks"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("-m", ctx.agentModel);
  }
  if (bytes <= DEFAULT_ARGV_PROMPT_BUDGET_BYTES) {
    args.push("-q", ctx.composedPrompt);
    return {
      bin: registry.execution.bin,
      args,
      streamFormat: registry.execution.streamFormat,
      closeStdinAfterPrompt: false,
      promptViaArgs: true,
      stdinPayload: "ignore",
    };
  }
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
      stdinPayload: "composed",
  };
}

function buildCursorAgentArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("cursor-agent");
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--force",
    "--trust",
    "--workspace",
    ctx.cwd,
  ];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

function buildGeminiArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("gemini");
  const args = ["--output-format", "stream-json", "--yolo"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

function buildOpenCodeArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("opencode");
  const args = ["run", "--format", "json"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("-m", ctx.agentModel);
  }
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

function buildCopilotArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("copilot");
  const args = ["--allow-all-tools", "--output-format", "json"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  pushAddDirs(args, ctx.extraAllowedDirs);
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

function buildQoderArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("qoder");
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--yolo",
    "-w",
    ctx.cwd,
  ];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  pushAddDirs(args, ctx.extraAllowedDirs);
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: true,
    stdinPayload: "composed",
  };
}

function buildDeepSeekArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("deepseek");
  const bytes = estimatePromptBytes(ctx.composedPrompt);
  const args = ["exec", "--auto"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  if (bytes > 30_000) {
    return {
      bin: registry.execution.bin,
      args,
      streamFormat: registry.execution.streamFormat,
      closeStdinAfterPrompt: false,
      promptViaArgs: true,
      stdinPayload: "ignore",
      promptArgvRejected: true,
    };
  }
  args.push(ctx.composedPrompt);
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    promptViaArgs: true,
    stdinPayload: "ignore",
  };
}

function buildDevinArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("devin");
  const args = [
    "--permission-mode",
    "dangerous",
    "--respect-workspace-trust",
    "false",
    "acp",
  ];
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinPayload: "ignore",
  };
}

function buildPiArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("pi");
  const args = ["--mode", "rpc"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinPayload: "ignore",
  };
}

function buildKiroArgs(_ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("kiro");
  return {
    bin: registry.execution.bin,
    args: ["acp"],
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinPayload: "ignore",
  };
}

function buildKiloArgs(_ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("kilo");
  return {
    bin: registry.execution.bin,
    args: ["acp"],
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinPayload: "ignore",
  };
}

function buildVibeArgs(_ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("vibe");
  return {
    bin: registry.execution.bin,
    args: [],
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    stdinPayload: "ignore",
  };
}

function buildOpenClawArgs(ctx: BuildArgsContext): AgentLaunchSpec {
  const registry = getAgentRegistryEntry("openclaw");
  const bytes = estimatePromptBytes(ctx.composedPrompt);
  const args = ["infer", "model", "run", "--json"];
  if (ctx.agentModel && ctx.agentModel !== "default") {
    args.push("--model", ctx.agentModel);
  }
  if (bytes > DEFAULT_ARGV_PROMPT_BUDGET_BYTES) {
    return {
      bin: registry.execution.bin,
      args,
      streamFormat: registry.execution.streamFormat,
      closeStdinAfterPrompt: false,
      promptViaArgs: true,
      stdinPayload: "ignore",
      promptArgvRejected: true,
    };
  }
  args.push("--prompt", ctx.composedPrompt);
  return {
    bin: registry.execution.bin,
    args,
    streamFormat: registry.execution.streamFormat,
    closeStdinAfterPrompt: false,
    promptViaArgs: true,
    stdinPayload: "ignore",
  };
}

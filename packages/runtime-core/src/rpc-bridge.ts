import type { ChildProcess } from "node:child_process";
import type { AgentStreamEvent } from "./types.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asObject(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function rpcErrorMessage(raw: JsonRecord): string {
  const error = asObject(raw.error);
  if (!error) return "";
  const message =
    typeof error.message === "string"
      ? error.message
      : typeof error.code === "number"
        ? String(error.code)
        : "json-rpc error";
  return typeof raw.id === "number" ? `json-rpc id ${raw.id}: ${message}` : message;
}

function createJsonLineStream(onMessage: (message: unknown, rawLine: string) => void) {
  let buffer = "";
  return {
    feed(chunk: string) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          onMessage(JSON.parse(trimmed), trimmed);
        } catch {
          /* ignore non-json noise */
        }
      }
    },
    flush() {
      const trimmed = buffer.trim();
      buffer = "";
      if (!trimmed) return;
      try {
        onMessage(JSON.parse(trimmed), trimmed);
      } catch {
        /* ignore */
      }
    },
  };
}

function sendRpc(
  stdin: NodeJS.WritableStream,
  id: string | number,
  method: string,
  params: unknown,
): void {
  stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

function sendRpcResult(
  stdin: NodeJS.WritableStream,
  id: string | number,
  result: unknown,
): void {
  stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function choosePermissionOutcome(options: unknown): string | null {
  const list = Array.isArray(options) ? options : [];
  const approveForSession = list.find(
    (option) => isRecord(option) && option.optionId === "approve_for_session",
  ) as JsonRecord | undefined;
  if (approveForSession) return "approve_for_session";
  const allowAlways = list.find(
    (option) => isRecord(option) && option.kind === "allow_always",
  ) as JsonRecord | undefined;
  if (typeof allowAlways?.optionId === "string") return allowAlways.optionId;
  const allowOnce = list.find(
    (option) => isRecord(option) && option.kind === "allow_once",
  ) as JsonRecord | undefined;
  if (typeof allowOnce?.optionId === "string") return allowOnce.optionId;
  return null;
}

function currentModelFromSessionResult(result: JsonRecord): string | null {
  const models = asObject(result.models);
  return typeof models?.currentModelId === "string" && models.currentModelId.trim()
    ? models.currentModelId.trim()
    : null;
}

function modelSelectionErrorIsRecoverable(code: unknown): boolean {
  return code === -32603 || code === -32602 || code === -32601 || code === -32002;
}

export type RpcBridgeHandle = {
  onStdout: (chunk: string) => void;
  onClose: () => void;
  abort: () => void;
  completedSuccessfully: () => boolean;
  hasFatalError: () => boolean;
};

export function attachAcpBridge(input: {
  child: ChildProcess;
  prompt: string;
  model?: string | null;
  cwd: string;
  onEvent: (ev: AgentStreamEvent) => void;
}): RpcBridgeHandle {
  const stdin = input.child.stdin;
  if (!stdin) {
    throw new Error("ACP child process must expose stdin");
  }

  let expectedId = 1;
  let nextId = 2;
  let promptRequestId: string | number | null = null;
  let setModelRequestId: string | number | null = null;
  let sessionId: string | null = null;
  let activeModel: string | null = null;
  let finished = false;
  let fatal = false;
  let aborted = false;
  let emittedThinkingStart = false;
  let emittedFirstTokenStatus = false;
  const runStartedAt = Date.now();

  const fail = (message: string) => {
    if (finished) return;
    finished = true;
    fatal = true;
    input.onEvent({ type: "error", message, code: "acp_error" });
    if (!input.child.killed) input.child.kill("SIGTERM");
  };

  const writeRpc = (id: string | number, method: string, params: unknown) => {
    try {
      sendRpc(stdin, id, method, params);
    } catch (err) {
      fail(`stdin write failed: ${errorMessage(err)}`);
    }
  };

  const sendPrompt = () => {
    promptRequestId = nextId;
    expectedId = promptRequestId;
    writeRpc(promptRequestId, "session/prompt", {
      sessionId,
      prompt: [{ type: "text", text: input.prompt }],
    });
    nextId += 1;
  };

  const replyPermission = (raw: JsonRecord) => {
    const params = asObject(raw.params);
    const optionId = choosePermissionOutcome(params?.options);
    if (!optionId || (typeof raw.id !== "number" && typeof raw.id !== "string")) {
      fail(`unhandled ACP permission request: ${JSON.stringify(raw)}`);
      return;
    }
    try {
      sendRpcResult(stdin, raw.id, {
        outcome: { outcome: "selected", optionId },
      });
    } catch (err) {
      fail(`stdin write failed: ${errorMessage(err)}`);
    }
  };

  const parser = createJsonLineStream((raw, rawLine) => {
    if (aborted) return;
    const obj = asObject(raw);
    if (!obj) return;
    const error = asObject(obj.error);
    const params = asObject(obj.params);
    const result = asObject(obj.result);
    const rpcErr = rpcErrorMessage(obj);

    if (rpcErr) {
      if (
        obj.id === setModelRequestId &&
        modelSelectionErrorIsRecoverable(error?.code) &&
        promptRequestId === null
      ) {
        setModelRequestId = null;
        activeModel = activeModel || "default";
        input.onEvent({
          type: "tool_progress",
          tool: "lifecycle",
          status: "running",
          message: activeModel ? `模型 · ${activeModel}` : "模型已回退到默认配置",
        });
        sendPrompt();
        return;
      }
      if (error?.code === -32603 && obj.id !== expectedId) {
        return;
      }
      fail(rpcErr);
      return;
    }

    if (obj.method === "session/request_permission") {
      replyPermission(obj);
      return;
    }

    const update = asObject(params?.update);
    if (obj.method === "session/update" && update) {
      if (update.sessionUpdate === "agent_thought_chunk") {
        const text = asObject(update.content)?.text;
        if (typeof text === "string" && text.length > 0) {
          if (!emittedThinkingStart) {
            emittedThinkingStart = true;
            input.onEvent({ type: "narration", text });
            return;
          }
          input.onEvent({ type: "narration", text });
        }
        return;
      }
      if (update.sessionUpdate === "agent_message_chunk") {
        const text = asObject(update.content)?.text;
        if (typeof text === "string" && text.length > 0) {
          if (!emittedFirstTokenStatus) {
            emittedFirstTokenStatus = true;
            input.onEvent({
              type: "tool_progress",
              tool: "lifecycle",
              status: "running",
              message: `开始输出 · ${Date.now() - runStartedAt}ms`,
            });
          }
          input.onEvent({ type: "text_delta", delta: text });
        }
      }
      return;
    }

    if (obj.id !== expectedId || !result) return;

    if (expectedId === 1) {
      expectedId = nextId;
      writeRpc(nextId, "session/new", { cwd: input.cwd, mcpServers: [] });
      nextId += 1;
      return;
    }

    if (expectedId === 2) {
      sessionId = typeof result.sessionId === "string" ? result.sessionId : null;
      activeModel = currentModelFromSessionResult(result);
      if (!sessionId) {
        fail(`invalid session/new response: ${rawLine}`);
        return;
      }
      if (sessionId && activeModel) {
        input.onEvent({
          type: "tool_progress",
          tool: "lifecycle",
          status: "running",
          message: `模型 · ${activeModel}`,
        });
      }
      if (sessionId && input.model && input.model !== "default") {
        setModelRequestId = nextId;
        expectedId = nextId;
        writeRpc(nextId, "session/set_model", { sessionId, modelId: input.model });
        nextId += 1;
        return;
      }
      sendPrompt();
      return;
    }

    if (promptRequestId !== null && obj.id === promptRequestId) {
      finished = true;
      try {
        stdin.end();
      } catch {
        /* ignore */
      }
      const cleanExitTimer = setTimeout(() => {
        if (!input.child.killed) input.child.kill("SIGTERM");
      }, 500);
      input.child.once("close", () => clearTimeout(cleanExitTimer));
      return;
    }

    if (sessionId && input.model && input.model !== "default" && obj.id === expectedId) {
      activeModel = currentModelFromSessionResult(result) ?? input.model;
      input.onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: `模型 · ${activeModel}`,
      });
      sendPrompt();
    }
  });

  writeRpc(1, "initialize", {
    protocolVersion: 1,
    clientCapabilities: { terminal: false },
    clientInfo: { name: "jlc-companion", version: "runtime-core" },
  });

  return {
    onStdout(chunk) {
      parser.feed(chunk);
    },
    onClose() {
      parser.flush();
    },
    abort() {
      if (aborted || finished) return;
      aborted = true;
      finished = true;
      if (!sessionId || stdin.destroyed || (stdin as { writableEnded?: boolean }).writableEnded) {
        return;
      }
      try {
        sendRpc(stdin, nextId, "session/cancel", { sessionId });
        nextId += 1;
      } catch {
        /* caller owns SIGTERM fallback */
      }
    },
    completedSuccessfully() {
      return finished && !fatal && !aborted;
    },
    hasFatalError() {
      return fatal;
    },
  };
}

export function parsePiModels(stdout: unknown): Array<{ id: string; label: string }> | null {
  const lines = String(stdout || "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  if (lines.length === 0) return null;

  const entries = [{ id: "default", label: "Default" }];
  const seen = new Set(["default"]);
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i]?.split(/\s+/);
    if (!parts || parts.length < 2) continue;
    const provider = parts[0];
    const modelId = parts[1];
    if (!provider || !modelId) continue;
    const fullId = `${provider}/${modelId}`;
    if (seen.has(fullId)) continue;
    seen.add(fullId);
    entries.push({ id: fullId, label: fullId });
  }

  return entries.length > 1 ? entries : null;
}

export function attachPiRpcBridge(input: {
  child: ChildProcess;
  prompt: string;
  model?: string | null;
  onEvent: (ev: AgentStreamEvent) => void;
}): RpcBridgeHandle {
  const stdin = input.child.stdin;
  if (!stdin) {
    throw new Error("Pi RPC child process must expose stdin");
  }

  let finished = false;
  let fatal = false;
  let nextRpcId = 1;
  let promptRpcId: number | null = null;
  const sentFirstToken = { value: false };
  const runStartedAt = Date.now();

  const fail = (message: string) => {
    if (finished) return;
    finished = true;
    fatal = true;
    input.onEvent({ type: "error", message, code: "pi_rpc_error" });
    if (!input.child.killed) input.child.kill("SIGTERM");
  };

  const sendCommand = (type: string, params: JsonRecord = {}): number | null => {
    const id = nextRpcId++;
    try {
      stdin.write(`${JSON.stringify({ id, type, ...params })}\n`);
      return id;
    } catch (err) {
      fail(`stdin write failed: ${errorMessage(err)}`);
      return null;
    }
  };

  const parser = createJsonLineStream((raw) => {
    const obj = asObject(raw);
    if (!obj || finished) return;

    if (obj.type === "response") {
      if (obj.id === promptRpcId && obj.success === false) {
        fail(`prompt rejected: ${String(obj.error ?? "unknown")}`);
      }
      return;
    }

    const assistantMessageEvent = asObject(obj.assistantMessageEvent);
    if (obj.type === "agent_start") {
      input.onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: typeof input.model === "string" && input.model ? `初始化 · ${input.model}` : "初始化",
      });
      return;
    }
    if (obj.type === "turn_start") {
      input.onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: "思考中",
      });
      return;
    }
    if (obj.type === "message_update" && assistantMessageEvent) {
      if (
        assistantMessageEvent.type === "text_delta" &&
        typeof assistantMessageEvent.delta === "string"
      ) {
        if (!sentFirstToken.value) {
          sentFirstToken.value = true;
          input.onEvent({
            type: "tool_progress",
            tool: "lifecycle",
            status: "running",
            message: `开始输出 · ${Date.now() - runStartedAt}ms`,
          });
        }
        input.onEvent({ type: "text_delta", delta: assistantMessageEvent.delta });
        return;
      }
      if (
        assistantMessageEvent.type === "thinking_delta" &&
        typeof assistantMessageEvent.delta === "string"
      ) {
        input.onEvent({ type: "narration", text: assistantMessageEvent.delta });
        return;
      }
      if (assistantMessageEvent.type === "error") {
        const message =
          typeof assistantMessageEvent.reason === "string" && assistantMessageEvent.reason.length > 0
            ? assistantMessageEvent.reason
            : typeof assistantMessageEvent.delta === "string" && assistantMessageEvent.delta.length > 0
              ? assistantMessageEvent.delta
              : "Agent error";
        input.onEvent({ type: "error", message, code: "pi_rpc_error" });
      }
      return;
    }

    if (obj.type === "tool_execution_start") {
      input.onEvent({
        type: "tool_progress",
        tool: typeof obj.toolName === "string" ? obj.toolName : "tool",
        status: "running",
        message:
          typeof obj.toolCallId === "string" ? `call:${obj.toolCallId}` : "执行工具",
      });
      return;
    }

    if (obj.type === "tool_execution_end") {
      const result = asObject(obj.result);
      const content = result?.content;
      const text =
        Array.isArray(content)
          ? content
              .map((item) => {
                const record = asObject(item);
                return record?.type === "text" ? String(record.text ?? "") : JSON.stringify(item);
              })
              .join("\n")
          : typeof content === "string"
            ? content
            : "";
      input.onEvent({
        type: "tool_progress",
        tool: typeof obj.toolName === "string" ? obj.toolName : "tool",
        status: obj.isError === true ? "error" : "done",
        message: text.slice(0, 200),
      });
      return;
    }

    if (obj.type === "extension_error") {
      const message =
        typeof obj.error === "string" && obj.error.length > 0 ? obj.error : "Extension error";
      input.onEvent({ type: "error", message, code: "pi_rpc_error" });
      return;
    }

    if (obj.type === "compaction_start") {
      input.onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: "压缩上下文",
      });
      return;
    }

    if (obj.type === "auto_retry_start") {
      input.onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: "自动重试中",
      });
      return;
    }

    if (obj.type === "agent_end") {
      finished = true;
      try {
        stdin.end();
      } catch {
        /* ignore */
      }
      const shutdownMs = 5_000;
      setTimeout(() => {
        if (!input.child.killed) input.child.kill("SIGTERM");
      }, shutdownMs);
    }
  });

  input.onEvent({
    type: "tool_progress",
    tool: "lifecycle",
    status: "running",
    message:
      typeof input.model === "string" && input.model && input.model !== "default"
        ? `初始化 · ${input.model}`
        : "初始化",
  });

  promptRpcId = sendCommand("prompt", {
    message: input.prompt,
  });

  return {
    onStdout(chunk) {
      parser.feed(chunk);
    },
    onClose() {
      parser.flush();
    },
    abort() {
      if (finished || input.child.killed) return;
      finished = true;
      sendCommand("abort");
    },
    completedSuccessfully() {
      return finished && !fatal;
    },
    hasFatalError() {
      return fatal;
    },
  };
}

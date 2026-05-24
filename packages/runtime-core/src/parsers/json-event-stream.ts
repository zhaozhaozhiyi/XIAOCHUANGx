import type { AgentStreamEvent } from "../types.js";

type JsonValue = Record<string, unknown>;
type ParserKind = "gemini" | "opencode" | "cursor-agent";

function isRecord(value: unknown): value is JsonValue {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function stringifyContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractCursorText(message: unknown): string {
  const content = isRecord(message) ? message.content : undefined;
  const blocks = Array.isArray(content) ? content : [];
  return blocks
    .filter(
      (block): block is { type: "text"; text: string } =>
        isRecord(block) && block.type === "text" && typeof block.text === "string",
    )
    .map((block) => block.text)
    .join("");
}

function emitCursorDelta(
  text: string,
  state: { cursorTextSoFar: string },
  onEvent: (ev: AgentStreamEvent) => void,
): void {
  if (!state.cursorTextSoFar) {
    state.cursorTextSoFar = text;
    onEvent({ type: "text_delta", delta: text });
    return;
  }
  if (text === state.cursorTextSoFar) return;
  if (text.startsWith(state.cursorTextSoFar)) {
    const delta = text.slice(state.cursorTextSoFar.length);
    state.cursorTextSoFar = text;
    if (delta) onEvent({ type: "text_delta", delta });
    return;
  }
  state.cursorTextSoFar = text;
  onEvent({ type: "text_delta", delta: text });
}

export function createJsonEventStreamParser(
  kind: ParserKind,
  onEvent: (ev: AgentStreamEvent) => void,
) {
  let buffer = "";
  const state = {
    cursorTextSoFar: "",
  };

  function handleGemini(obj: JsonValue): boolean {
    if (obj.type === "init") {
      const model = typeof obj.model === "string" ? obj.model : "";
      onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: model ? `初始化 · ${model}` : "初始化",
      });
      return true;
    }

    if (
      obj.type === "message" &&
      obj.role === "assistant" &&
      typeof obj.content === "string" &&
      obj.content.length > 0
    ) {
      onEvent({ type: "text_delta", delta: obj.content });
      return true;
    }

    if (obj.type === "error") {
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.error === "string"
            ? obj.error
            : "Gemini CLI error";
      onEvent({ type: "error", message, code: "gemini_error" });
      return true;
    }

    return false;
  }

  function handleOpenCode(obj: JsonValue): boolean {
    const part = isRecord(obj.part) ? obj.part : {};
    if (obj.type === "step_start") {
      onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: "运行中",
      });
      return true;
    }
    if (obj.type === "text" && typeof part.text === "string" && part.text.length > 0) {
      onEvent({ type: "text_delta", delta: part.text });
      return true;
    }
    if (obj.type === "tool_use" && typeof part.tool === "string") {
      const callId = typeof part.callID === "string" ? part.callID : undefined;
      onEvent({
        type: "tool_progress",
        tool: part.tool,
        status: "running",
        message: callId ? `call:${callId}` : part.tool,
        callId,
        input: part.input,
      });
      const partState = isRecord(part.state) ? part.state : null;
      if (partState?.status === "completed") {
        onEvent({
          type: "tool_progress",
          tool: part.tool,
          status: "done",
          message: stringifyContent(partState.output).slice(0, 200),
          callId,
          output: partState.output,
        });
      }
      return true;
    }
    if (obj.type === "error") {
      const message =
        typeof obj.error === "string"
          ? obj.error
          : typeof obj.message === "string"
            ? obj.message
            : "OpenCode error";
      onEvent({ type: "error", message, code: "opencode_error" });
      return true;
    }
    return false;
  }

  function handleCursor(obj: JsonValue): boolean {
    if (obj.type === "system" && obj.subtype === "init") {
      const model = typeof obj.model === "string" ? obj.model : "";
      onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: model ? `初始化 · ${model}` : "初始化",
      });
      return true;
    }
    if (obj.type === "assistant" && obj.message) {
      const text = extractCursorText(obj.message);
      if (!text) return false;
      emitCursorDelta(text, state, onEvent);
      return true;
    }
    if (obj.type === "error") {
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.error === "string"
            ? obj.error
            : "Cursor Agent error";
      onEvent({ type: "error", message, code: "cursor_agent_error" });
      return true;
    }
    return false;
  }

  function handle(obj: unknown) {
    if (!isRecord(obj)) return;
    if (kind === "gemini") {
      handleGemini(obj);
      return;
    }
    if (kind === "opencode") {
      handleOpenCode(obj);
      return;
    }
    if (kind === "cursor-agent") {
      handleCursor(obj);
    }
  }

  return {
    feed(chunk: string) {
      buffer += chunk;
      let nl = -1;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        try {
          handle(JSON.parse(line));
        } catch {
          /* ignore non-json noise */
        }
      }
    },
    flush() {
      const rem = buffer.trim();
      buffer = "";
      if (!rem) return;
      try {
        handle(JSON.parse(rem));
      } catch {
        /* ignore */
      }
    },
  };
}

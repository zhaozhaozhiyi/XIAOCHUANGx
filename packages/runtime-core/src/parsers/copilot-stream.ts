import type { AgentStreamEvent } from "../types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringifyResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return value == null ? "" : JSON.stringify(value);
  if (typeof value.content === "string") return value.content;
  if (typeof value.detailedContent === "string") return value.detailedContent;
  return JSON.stringify(value);
}

export function createCopilotStreamParser(
  onEvent: (ev: AgentStreamEvent) => void,
) {
  let buffer = "";

  function handle(obj: unknown) {
    if (!isRecord(obj) || typeof obj.type !== "string") return;
    const data = isRecord(obj.data) ? obj.data : {};

    switch (obj.type) {
      case "session.tools_updated": {
        const model = typeof data.model === "string" ? data.model : "";
        onEvent({
          type: "tool_progress",
          tool: "lifecycle",
          status: "running",
          message: model ? `初始化 · ${model}` : "初始化",
        });
        return;
      }
      case "assistant.reasoning_delta":
        if (typeof data.deltaContent === "string") {
          onEvent({ type: "narration", text: data.deltaContent });
        }
        return;
      case "assistant.message_delta":
        if (typeof data.deltaContent === "string") {
          onEvent({ type: "text_delta", delta: data.deltaContent });
        }
        return;
      case "tool.execution_start":
        onEvent({
          type: "tool_progress",
          tool:
            typeof data.toolName === "string" ? data.toolName : "tool.execution",
          status: "running",
          message:
            typeof data.toolCallId === "string" ? data.toolCallId : undefined,
          callId:
            typeof data.toolCallId === "string" ? data.toolCallId : undefined,
          input: data.input,
        });
        return;
      case "tool.execution_complete":
        onEvent({
          type: "tool_progress",
          tool:
            typeof data.toolName === "string" ? data.toolName : "tool.execution",
          status: data.success === false ? "failed" : "done",
          message: stringifyResult(data.result).slice(0, 200),
          callId:
            typeof data.toolCallId === "string" ? data.toolCallId : undefined,
          output: data.result,
        });
        return;
      case "error": {
        const message =
          typeof obj.message === "string"
            ? obj.message
            : typeof data.message === "string"
              ? data.message
              : "Copilot CLI error";
        onEvent({ type: "error", message, code: "copilot_error" });
      }
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
          /* ignore */
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

import type { AgentStreamEvent } from "../types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textFromContentBlock(block: unknown): string {
  if (!isRecord(block)) return "";
  if (block.type === "text" && typeof block.text === "string") return block.text;
  if (typeof block.text === "string") return block.text;
  return "";
}

function errorMessage(error: unknown): string {
  if (isRecord(error) && typeof error.message === "string") return error.message;
  if (typeof error === "string" && error.length > 0) return error;
  return "Qoder CLI error";
}

export function createQoderStreamParser(
  onEvent: (ev: AgentStreamEvent) => void,
) {
  let buffer = "";

  function handle(obj: unknown) {
    if (!isRecord(obj)) return;

    if (obj.type === "system" && obj.subtype === "init") {
      const model = typeof obj.model === "string" ? obj.model : "";
      onEvent({
        type: "tool_progress",
        tool: "lifecycle",
        status: "running",
        message: model ? `初始化 · ${model}` : "初始化",
      });
      return;
    }

    if (obj.type === "assistant" && isRecord(obj.message)) {
      const content = Array.isArray(obj.message.content) ? obj.message.content : [];
      let emitted = false;
      for (const block of content) {
        const text = textFromContentBlock(block);
        if (text.length > 0) {
          emitted = true;
          onEvent({ type: "text_delta", delta: text });
          continue;
        }
        if (
          isRecord(block) &&
          block.type === "thinking" &&
          typeof block.thinking === "string" &&
          block.thinking.length > 0
        ) {
          onEvent({ type: "narration", text: block.thinking });
        }
      }
      if (!emitted && typeof obj.message.content === "string") {
        onEvent({ type: "text_delta", delta: obj.message.content });
      }
      if (obj.error && !emitted) {
        onEvent({
          type: "error",
          message: errorMessage(obj.error),
          code: "qoder_error",
        });
      }
      return;
    }

    if (obj.type === "result" && Boolean(obj.is_error)) {
      const message =
        typeof obj.message === "string"
          ? obj.message
          : typeof obj.error === "string"
            ? obj.error
            : "Qoder run failed";
      onEvent({ type: "error", message, code: "qoder_result_error" });
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

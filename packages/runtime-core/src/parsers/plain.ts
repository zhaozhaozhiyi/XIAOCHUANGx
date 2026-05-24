import type { AgentStreamEvent } from "../types.js";

/** Hermes `-Q` 等：整段 stdout 作为正文 */
export function createPlainParser(onEvent: (ev: AgentStreamEvent) => void) {
  let buffer = "";

  return {
    feed(chunk: string) {
      buffer += chunk;
    },
    flush() {
      const text = buffer.trim();
      buffer = "";
      if (text) {
        onEvent({ type: "text_delta", delta: text });
      }
    },
  };
}

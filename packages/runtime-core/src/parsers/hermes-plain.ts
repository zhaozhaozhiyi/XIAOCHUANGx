import type { AgentStreamEvent } from "../types.js";

const HERMES_ERROR_PATTERNS = [
  /^API call failed after \d+ retries:/i,
  /^Hermes (?:API|Gateway) error:/i,
  /^Authentication failed:/i,
];

export function createHermesPlainParser(
  onEvent: (event: AgentStreamEvent) => void,
) {
  let buffer = "";

  return {
    feed(chunk: string) {
      buffer += chunk;
    },
    flush() {
      const text = buffer.trim();
      buffer = "";
      if (!text) return;
      if (HERMES_ERROR_PATTERNS.some((pattern) => pattern.test(text))) {
        onEvent({ type: "error", message: text, code: "hermes_cli_error" });
        return;
      }
      onEvent({ type: "text_delta", delta: text });
    },
  };
}

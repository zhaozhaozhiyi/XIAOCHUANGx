import type { AgentStreamEvent } from "../types.js";
import { progressFromPhase, progressFromToolUse } from "../map-tool-progress.js";

type Handler = (ev: AgentStreamEvent) => void;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function itemPhase(item: Record<string, unknown>): string | undefined {
  return typeof item.phase === "string"
    ? item.phase
    : typeof item.message_phase === "string"
      ? item.message_phase
      : undefined;
}

function extractErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string") return value;
  if (isRecord(value)) {
    if (typeof value.message === "string" && value.message) return value.message;
    if (typeof value.detail === "string" && value.detail) return value.detail;
    if (typeof value.error === "string" && value.error) return value.error;
  }
  return fallback;
}

/** Codex `exec --json` stdout parser → text_delta + tool_progress + status */
export function createCodexJsonParser(onEvent: Handler) {
  let buffer = "";
  let errorEmitted = false;
  let prevAgentMsg = false;
  let lastEndedNewline = false;
  const commandIds = new Set<string>();

  function emitCommand(
    item: Record<string, unknown>,
    phase: "start" | "end",
  ) {
    const command = typeof item.command === "string" ? item.command : "";
    if (!command) return;
    const failed =
      phase === "end" &&
      (typeof item.exit_code === "number"
        ? item.exit_code !== 0
        : item.status === "failed");
    const progress = progressFromToolUse(
      "Bash",
      { command },
      phase === "start" ? "start" : "end",
      failed,
    );
    onEvent({
      type: "tool_progress",
      tool: progress.tool,
      status: progress.status,
      message: command.slice(0, 200),
    });
  }

  function handle(obj: unknown) {
    if (!isRecord(obj)) return;

    if (obj.type === "error" || obj.type === "turn.failed") {
      const message = extractErrorMessage(
        obj.message ?? obj.error,
        obj.type === "turn.failed" ? "Codex turn failed" : "Codex error",
      );
      if (
        typeof message === "string" &&
        message.includes("Reconnecting...") &&
        message.includes("timeout waiting for child process to exit")
      ) {
        onEvent({ type: "tool_progress", ...progressFromPhase(message) });
        return;
      }
      if (!errorEmitted) {
        errorEmitted = true;
        onEvent({ type: "error", message, code: "codex_error" });
      }
      return;
    }

    if (obj.type === "thread.started") {
      const threadId =
        typeof obj.thread_id === "string"
          ? obj.thread_id
          : isRecord(obj.thread) && typeof obj.thread.id === "string"
            ? obj.thread.id
            : undefined;
      if (threadId) onEvent({ type: "thread_started", threadId });
      onEvent({ type: "tool_progress", ...progressFromPhase("初始化") });
      return;
    }

    if (obj.type === "turn.started") {
      prevAgentMsg = false;
      lastEndedNewline = false;
      onEvent({ type: "tool_progress", ...progressFromPhase("运行中") });
      return;
    }

    if (obj.type === "item.started" && isRecord(obj.item)) {
      const item = obj.item;
      if (item.type === "command_execution") {
        prevAgentMsg = false;
        lastEndedNewline = false;
        const id = typeof item.id === "string" ? item.id : null;
        if (id && commandIds.has(id)) return;
        if (id) commandIds.add(id);
        emitCommand(item, "start");
      }
      return;
    }

    if (obj.type === "item.completed" && isRecord(obj.item)) {
      const item = obj.item;
      if (item.type === "command_execution") {
        prevAgentMsg = false;
        lastEndedNewline = false;
        const id = typeof item.id === "string" ? item.id : null;
        if (id && !commandIds.has(id)) {
          commandIds.add(id);
          emitCommand(item, "start");
        }
        emitCommand(item, "end");
        if (id) commandIds.add(id);
        return;
      }
    }

    if (
      obj.type === "item.completed" &&
      isRecord(obj.item) &&
      obj.item.type === "agent_message" &&
      typeof obj.item.text === "string" &&
      obj.item.text.length > 0
    ) {
      const text = obj.item.text;
      const phase = itemPhase(obj.item);
      onEvent({ type: "narration", text });
      if (phase === "commentary") {
        prevAgentMsg = false;
        lastEndedNewline = false;
        return;
      }
      const needsBoundary =
        prevAgentMsg && !lastEndedNewline && !text.startsWith("\n");
      onEvent({ type: "text_delta", delta: needsBoundary ? `\n${text}` : text });
      prevAgentMsg = true;
      lastEndedNewline = text.endsWith("\n");
    }
  }

  function feed(chunk: string) {
    buffer += chunk;
    let nl: number;
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
  }

  function flush() {
    const rem = buffer.trim();
    buffer = "";
    if (!rem) return;
    try {
      handle(JSON.parse(rem));
    } catch {
      /* ignore */
    }
  }

  return { feed, flush };
}

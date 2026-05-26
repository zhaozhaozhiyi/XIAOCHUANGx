import type { AgentStreamEvent } from "../types.js";
import {
  progressFromPhase,
  progressFromReasoning,
  progressFromToolUse,
} from "../map-tool-progress.js";

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
  let pendingAgentText = "";
  const activeToolItems = new Map<string, { tool: string; input: unknown }>();

  function itemId(item: Record<string, unknown>): string | null {
    return typeof item.id === "string" ? item.id : null;
  }

  function itemInput(item: Record<string, unknown>): unknown {
    if (isRecord(item.input)) return item.input;
    if (isRecord(item.arguments)) return item.arguments;
    if (item.type === "web_search") {
      return {
        query: typeof item.query === "string" ? item.query : undefined,
        action: item.action,
      };
    }
    return item;
  }

  function itemOutput(item: Record<string, unknown>): unknown {
    if (item.output !== undefined) return item.output;
    if (item.result !== undefined) return item.result;
    if (item.content !== undefined) return item.content;
    if (item.error !== undefined) return { error: item.error };
    return undefined;
  }

  function stringifyText(value: unknown): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (typeof item === "string") return item;
          if (isRecord(item) && typeof item.text === "string") return item.text;
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  function reasoningText(item: Record<string, unknown>): string {
    return (
      stringifyText(item.text) ||
      stringifyText(item.reasoning) ||
      stringifyText(item.thinking) ||
      stringifyText(item.summary) ||
      stringifyText(item.content)
    ).trim();
  }

  function emitCommand(
    item: Record<string, unknown>,
    phase: "start" | "end",
  ) {
    const command = typeof item.command === "string" ? item.command : "";
    if (!command) return;
    const id = itemId(item);
    const input = { command };
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
      callId: id ?? undefined,
      input,
      output: phase === "end" ? itemOutput(item) : undefined,
    });
  }

  function emitToolItem(
    item: Record<string, unknown>,
    phase: "start" | "end",
  ) {
    flushAgentText();
    const rawType = typeof item.type === "string" ? item.type : "";
    if (!rawType || rawType === "agent_message") {
      return;
    }

    if (rawType === "reasoning" || rawType === "thinking") {
      const id = itemId(item);
      const text = reasoningText(item);
      onEvent({
        type: "tool_progress",
        ...progressFromReasoning(text || "思考中", phase === "start" ? "start" : "end"),
      });
      if (id && phase === "start") {
        activeToolItems.set(id, { tool: rawType, input: item });
      } else if (id && phase === "end") {
        activeToolItems.delete(id);
      }
      return;
    }

    if (rawType === "command_execution") {
      const id = itemId(item);
      emitCommand(item, phase);
      if (id && phase === "start") {
        activeToolItems.set(id, { tool: "Bash", input: item });
      } else if (id && phase === "end") {
        activeToolItems.delete(id);
      }
      return;
    }

    const id = itemId(item);
    const stored = id ? activeToolItems.get(id) : undefined;
    const tool = stored?.tool ?? rawType;
    const input = itemInput(item);
    const failed =
      phase === "end" &&
      (item.status === "failed" ||
        item.status === "error" ||
        item.error != null);
    const progress = progressFromToolUse(tool, input, phase, failed);
    onEvent({
      type: "tool_progress",
      tool: progress.tool,
      status: progress.status,
      message: progress.message,
      callId: id ?? undefined,
      input,
      output: phase === "end" ? itemOutput(item) : undefined,
    });

    if (id && phase === "start") {
      activeToolItems.set(id, { tool, input });
    } else if (id && phase === "end") {
      activeToolItems.delete(id);
    }
  }

  function queueAgentText(text: string) {
    const needsBoundary =
      pendingAgentText.length > 0 &&
      !pendingAgentText.endsWith("\n") &&
      !text.startsWith("\n");
    pendingAgentText += needsBoundary ? `\n${text}` : text;
  }

  function flushAgentText() {
    if (!pendingAgentText) return;
    onEvent({ type: "text_delta", delta: pendingAgentText });
    prevAgentMsg = true;
    lastEndedNewline = pendingAgentText.endsWith("\n");
    pendingAgentText = "";
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
      flushAgentText();
      onEvent({ type: "tool_progress", ...progressFromPhase("运行中") });
      return;
    }

    if (obj.type === "item.started" && isRecord(obj.item)) {
      const item = obj.item;
      if (item.type && item.type !== "agent_message") {
        prevAgentMsg = false;
        lastEndedNewline = false;
        flushAgentText();
        const id = itemId(item);
        if (id && activeToolItems.has(id)) return;
        emitToolItem(item, "start");
      }
      return;
    }

    if (obj.type === "item.completed" && isRecord(obj.item)) {
      const item = obj.item;
      if (item.type && item.type !== "agent_message") {
        prevAgentMsg = false;
        lastEndedNewline = false;
        flushAgentText();
        const id = itemId(item);
        if (id && !activeToolItems.has(id)) {
          emitToolItem(item, "start");
        }
        emitToolItem(item, "end");
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
        flushAgentText();
        return;
      }
      queueAgentText(text);
      return;
    }

    if (
      obj.type === "turn.completed" ||
      obj.type === "turn.finished" ||
      obj.type === "result"
    ) {
      flushAgentText();
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
    if (!rem) {
      flushAgentText();
      return;
    }
    try {
      handle(JSON.parse(rem));
    } catch {
      /* ignore */
    }
    flushAgentText();
  }

  return { feed, flush };
}

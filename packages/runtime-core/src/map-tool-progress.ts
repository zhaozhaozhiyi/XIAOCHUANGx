/** Maps Agent CLI tool_use names + input to Companion/Web tool.progress payloads. */

export type ToolProgressPayload = {
  tool: string;
  status?: string;
  message?: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
};

const SEARCH_TOOLS = new Set([
  "WebSearch",
  "web_search",
  "search",
  "choice_query",
]);

const READ_TOOLS = new Set(["Read", "read_file", "read"]);

const WRITE_TOOLS = new Set(["Write", "create_file", "write_file"]);

const EDIT_TOOLS = new Set([
  "Edit",
  "str_replace_edit",
  "MultiEdit",
  "multi_edit",
  "edit_file",
]);

const BASH_TOOLS = new Set([
  "Bash",
  "bash",
  "run_terminal",
  "shell",
  "terminal",
  "run_terminal_cmd",
]);

const GREP_TOOLS = new Set(["Grep", "grep", "Glob", "glob", "list_dir"]);

const FETCH_TOOLS = new Set(["WebFetch", "web_extract", "fetch"]);

const TODO_TOOLS = new Set(["TodoWrite", "todowrite"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickString(input: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Canonical tool id for SSE / reducer (see web/docs/agent-cli-activity-mapping.md). */
export function canonicalToolName(wireName: string): string {
  if (SEARCH_TOOLS.has(wireName)) return "search";
  if (READ_TOOLS.has(wireName)) return "read_file";
  if (WRITE_TOOLS.has(wireName)) return "write_file";
  if (EDIT_TOOLS.has(wireName)) return "edit_file";
  if (BASH_TOOLS.has(wireName)) return "Bash";
  if (GREP_TOOLS.has(wireName)) return "grep";
  if (FETCH_TOOLS.has(wireName)) return "web_extract";
  if (TODO_TOOLS.has(wireName)) return "todo";
  if (wireName.startsWith("mcp__")) return "mcp";
  return wireName;
}

/** Human-readable one-line summary for Activity rows. */
export function toolUseMessage(wireName: string, input: unknown): string | undefined {
  if (!isRecord(input)) {
    return wireName.startsWith("mcp__") ? wireName : undefined;
  }

  if (SEARCH_TOOLS.has(wireName)) {
    return (
      pickString(input, ["query", "q", "search_term", "search"]) ??
      pickString(input, ["url"])
    );
  }

  if (READ_TOOLS.has(wireName) || WRITE_TOOLS.has(wireName) || EDIT_TOOLS.has(wireName)) {
    return pickString(input, [
      "file_path",
      "path",
      "relative_path",
      "target_file",
      "notebook_path",
    ]);
  }

  if (BASH_TOOLS.has(wireName)) {
    return (
      pickString(input, ["command", "cmd"]) ??
      (typeof input.description === "string" ? input.description : undefined)
    );
  }

  if (GREP_TOOLS.has(wireName)) {
    return (
      pickString(input, ["pattern", "query", "glob", "path"]) ??
      pickString(input, ["include"])
    );
  }

  if (FETCH_TOOLS.has(wireName)) {
    return pickString(input, ["url", "uri"]);
  }

  if (TODO_TOOLS.has(wireName)) {
    const todos = input.todos;
    if (Array.isArray(todos)) {
      return `${todos.length} 项任务`;
    }
  }

  if (wireName.startsWith("mcp__")) {
    const parts = wireName.split("__").filter(Boolean);
    return parts.length >= 3 ? `${parts[1]} · ${parts[2]}` : wireName;
  }

  try {
    const s = JSON.stringify(input);
    return s.length <= 120 ? s : `${s.slice(0, 117)}…`;
  } catch {
    return undefined;
  }
}

export function progressFromToolUse(
  wireName: string,
  input: unknown,
  phase: "start" | "end",
  isError = false,
): ToolProgressPayload {
  const tool = canonicalToolName(wireName);
  const message = toolUseMessage(wireName, input) ?? wireName;
  if (phase === "start") {
    return { tool, status: "running", message };
  }
  return {
    tool,
    status: isError ? "error" : "success",
    message,
  };
}

export function progressFromPhase(label: string, running = true): ToolProgressPayload {
  return {
    tool: "phase",
    status: running ? "running" : "success",
    message: label,
  };
}

export function progressFromReasoning(
  text: string,
  phase: "start" | "end",
): ToolProgressPayload {
  const slice = text.trim().slice(0, 160) || "思考中";
  return {
    tool: "reasoning",
    status: phase === "start" ? "running" : "success",
    message: slice,
  };
}

/** Hermes Gateway SSE `hermes.tool.progress` payload → Web/Companion tool.progress */
export function hermesGatewayEventToProgress(
  json: unknown,
  labelByCallId?: Map<string, string>,
): ToolProgressPayload | null {
  if (!isRecord(json)) return null;
  const wireName =
    typeof json.tool === "string"
      ? json.tool
      : typeof json.name === "string"
        ? json.name
        : "tool";
  if (wireName.startsWith("_")) return null;

  const toolCallId =
    typeof json.toolCallId === "string" ? json.toolCallId : undefined;
  const rawStatus = typeof json.status === "string" ? json.status : "running";
  const status =
    rawStatus === "completed" || rawStatus === "complete"
      ? "success"
      : rawStatus === "failed" || rawStatus === "error"
        ? "error"
        : rawStatus === "running" || rawStatus === "pending"
          ? rawStatus
          : "running";

  let message =
    typeof json.label === "string" && json.label.trim()
      ? json.label.trim()
      : typeof json.message === "string" && json.message.trim()
        ? json.message.trim()
        : toolUseMessage(wireName, json.input ?? json.arguments);

  if (toolCallId && status === "running" && message) {
    labelByCallId?.set(toolCallId, message);
  }
  if (toolCallId && (status === "success" || status === "error")) {
    message = labelByCallId?.get(toolCallId) ?? message;
    labelByCallId?.delete(toolCallId);
  }

  return {
    tool: canonicalToolName(wireName),
    status,
    message: message ?? wireName,
    callId: toolCallId,
    input: json.input ?? json.arguments,
    output: json.output,
  };
}

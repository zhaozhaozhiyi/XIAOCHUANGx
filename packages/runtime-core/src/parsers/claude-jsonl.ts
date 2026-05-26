import type { AgentStreamEvent } from "../types.js";
import {
  progressFromPhase,
  progressFromReasoning,
  progressFromToolUse,
  toolUseMessage,
} from "../map-tool-progress.js";

type Handler = (ev: AgentStreamEvent) => void;

type BlockState = {
  type?: unknown;
  name?: unknown;
  id?: unknown;
  inputJson: string;
  initialInput?: unknown;
};

type AskUserQuestionInput = {
  questions?: unknown;
  question?: unknown;
};

type NormalizedQuestion = {
  id: string;
  question: string;
  header?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function isAskUserQuestionTool(wireName: string): boolean {
  return wireName === "AskUserQuestion" || wireName === "ask_user_question";
}

function normalizeAskUserQuestions(input: AskUserQuestionInput): NormalizedQuestion[] {
  if (typeof input.question === "string" && input.question.trim()) {
    return [{ id: "question", question: input.question.trim() }];
  }

  const questions = Array.isArray(input.questions) ? input.questions : null;
  if (!questions) return [];

  return questions.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const question =
      typeof item.question === "string"
        ? item.question.trim()
        : typeof item.header === "string"
          ? item.header.trim()
          : "";
    if (!question) return [];

    const options: Array<{ label: string; description?: string }> = [];
    if (Array.isArray(item.options)) {
      for (const option of item.options) {
        if (!isRecord(option) || typeof option.label !== "string") continue;
        const label = option.label.trim();
        if (!label) continue;
        options.push({
          label,
          description:
            typeof option.description === "string"
              ? option.description.trim()
              : undefined,
        });
      }
    }
    return [
      {
        id:
          typeof item.id === "string" && item.id.trim()
            ? item.id.trim()
            : `q${index + 1}`,
        question,
        header:
          typeof item.header === "string" && item.header.trim()
            ? item.header.trim()
            : undefined,
        options,
        multiSelect: item.multiSelect === true,
      },
    ];
  });
}

/**
 * Claude Code `--output-format stream-json` parser.
 * Emits text_delta, tool_progress (search/read/bash/…), status, error.
 */
export function createClaudeJsonlParser(onEvent: Handler) {
  let buffer = "";
  const blocks = new Map<string, BlockState>();
  const streamedToolUseIds = new Set<string>();
  const toolUseMeta = new Map<
    string,
    { wireName: string; input: unknown; message?: string }
  >();
  const textStreamed = new Set<string>();
  let currentMessageId: string | null = null;
  let reasoningOpen = false;

  function blockKey(index: unknown): string {
    return `${currentMessageId ?? "anon"}:${index}`;
  }

  function emitToolUse(wireName: string, input: unknown, id?: string) {
    if (id && streamedToolUseIds.has(id)) return;
    if (isAskUserQuestionTool(wireName)) {
      const questions = isRecord(input) ? normalizeAskUserQuestions(input) : [];
      onEvent({
        type: "user_input_request",
        toolUseId: id ?? `ask-user-${Date.now()}`,
        toolName: wireName,
        input,
        questions:
          questions.length > 0
            ? questions
            : [{ id: "question", question: "请补充更多信息后继续。" }],
      });
      if (id) streamedToolUseIds.add(id);
      return;
    }
    if (id) streamedToolUseIds.add(id);
    const progress = progressFromToolUse(wireName, input, "start");
    if (id) {
      toolUseMeta.set(id, {
        wireName,
        input,
        message: progress.message,
      });
    }
    onEvent({
      type: "tool_progress",
      ...progress,
      callId: id,
      input,
    });
  }

  function emitToolResult(
    toolUseId: string,
    isError: boolean,
    output?: unknown,
  ) {
    const meta = toolUseMeta.get(toolUseId);
    if (!meta) return;
    const progress = progressFromToolUse(
      meta.wireName,
      meta.input,
      "end",
      isError,
    );
    onEvent({
      type: "tool_progress",
      tool: progress.tool,
      status: progress.status,
      message: meta.message ?? progress.message,
      callId: toolUseId,
      input: meta.input,
      output,
    });
    toolUseMeta.delete(toolUseId);
  }

  function toolResultOutput(block: Record<string, unknown>): unknown {
    const content = block.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) return content;
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (isRecord(item) && typeof item.text === "string") return item.text;
        if (isRecord(item) && typeof item.content === "string") {
          return item.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function handleStreamEvent(ev: Record<string, unknown>) {
    if (ev.type === "message_start") {
      currentMessageId =
        isRecord(ev.message) && typeof ev.message.id === "string"
          ? ev.message.id
          : null;
      return;
    }

    if (ev.type === "content_block_start" && isRecord(ev.content_block)) {
      const block = ev.content_block;
      blocks.set(blockKey(ev.index), {
        type: block.type,
        name: block.name,
        id: block.id,
        inputJson: "",
        initialInput: block.input,
      });
      if (block.type === "thinking") {
        reasoningOpen = true;
        onEvent({
          type: "tool_progress",
          ...progressFromReasoning("思考中", "start"),
        });
      }
      return;
    }

    if (ev.type === "content_block_delta" && isRecord(ev.delta)) {
      const state = blocks.get(blockKey(ev.index));
      const delta = ev.delta;

      if (delta.type === "text_delta" && typeof delta.text === "string") {
        if (currentMessageId) textStreamed.add(currentMessageId);
        onEvent({ type: "text_delta", delta: delta.text });
        return;
      }

      if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        if (currentMessageId) textStreamed.add(currentMessageId);
        onEvent({
          type: "tool_progress",
          ...progressFromReasoning(delta.thinking, "start"),
        });
        reasoningOpen = true;
        return;
      }

      if (
        delta.type === "input_json_delta" &&
        typeof delta.partial_json === "string" &&
        state?.type === "tool_use"
      ) {
        state.inputJson += delta.partial_json;
      }
      return;
    }

    if (ev.type === "content_block_stop") {
      const key = blockKey(ev.index);
      const state = blocks.get(key);
      if (state?.type === "tool_use" && typeof state.id === "string") {
        let parsed: unknown = state.initialInput ?? null;
        if (state.inputJson.trim()) {
          try {
            parsed = JSON.parse(state.inputJson);
          } catch {
            parsed = state.initialInput ?? null;
          }
        }
        const wireName = typeof state.name === "string" ? state.name : "tool";
        if (parsed !== null) {
          emitToolUse(wireName, parsed, state.id);
        } else if (typeof state.name === "string") {
          emitToolUse(wireName, {}, state.id);
        }
      }
      if (state?.type === "thinking" && reasoningOpen) {
        onEvent({
          type: "tool_progress",
          ...progressFromReasoning("思考中", "end"),
        });
        reasoningOpen = false;
      }
      blocks.delete(key);
    }
  }

  function handle(obj: unknown) {
    if (!isRecord(obj)) return;

    if (obj.type === "system" && obj.subtype === "init") {
      const model = typeof obj.model === "string" ? obj.model : "";
      onEvent({
        type: "tool_progress",
        ...progressFromPhase(model ? `初始化 · ${model}` : "初始化"),
      });
      return;
    }

    if (obj.type === "system" && obj.subtype === "status") {
      const label = typeof obj.status === "string" ? obj.status : "working";
      onEvent({ type: "tool_progress", ...progressFromPhase(label) });
      return;
    }

    if (obj.type === "stream_event" && isRecord(obj.event)) {
      handleStreamEvent(obj.event);
      return;
    }

    if (obj.type === "assistant" && isRecord(obj.message)) {
      currentMessageId =
        typeof obj.message.id === "string" ? obj.message.id : currentMessageId;
      const msgId = typeof obj.message.id === "string" ? obj.message.id : null;
      const alreadyStreamed = msgId ? textStreamed.has(msgId) : false;
      const content = obj.message.content;
      if (!Array.isArray(content)) return;

      for (const block of content) {
        if (!isRecord(block)) continue;
        if (block.type === "tool_use") {
          const id = typeof block.id === "string" ? block.id : undefined;
          const wireName = typeof block.name === "string" ? block.name : "tool";
          if (id && streamedToolUseIds.has(id)) {
            streamedToolUseIds.delete(id);
            continue;
          }
          emitToolUse(wireName, block.input ?? {}, id);
        } else if (
          !alreadyStreamed &&
          block.type === "text" &&
          typeof block.text === "string" &&
          block.text.length > 0
        ) {
          onEvent({ type: "text_delta", delta: block.text });
          if (msgId) textStreamed.add(msgId);
        } else if (
          !alreadyStreamed &&
          block.type === "thinking" &&
          typeof block.thinking === "string" &&
          block.thinking.length > 0
        ) {
          onEvent({
            type: "tool_progress",
            ...progressFromReasoning(block.thinking, "start"),
          });
          onEvent({
            type: "tool_progress",
            ...progressFromReasoning(block.thinking, "end"),
          });
        }
      }

      const stopReason =
        typeof obj.message.stop_reason === "string"
          ? obj.message.stop_reason
          : null;
      if (stopReason && stopReason !== "tool_use") {
        onEvent({ type: "status", label: "turn_end" });
      }
      return;
    }

    if (obj.type === "user" && isRecord(obj.message) && Array.isArray(obj.message.content)) {
      for (const block of obj.message.content) {
        if (!isRecord(block) || block.type !== "tool_result") continue;
        const toolUseId =
          typeof block.tool_use_id === "string" ? block.tool_use_id : "";
        if (!toolUseId) continue;
        emitToolResult(toolUseId, Boolean(block.is_error), toolResultOutput(block));
      }
      return;
    }

    if (obj.type === "result") {
      if (reasoningOpen) {
        onEvent({
          type: "tool_progress",
          ...progressFromReasoning("思考中", "end"),
        });
        reasoningOpen = false;
      }
      onEvent({ type: "status", label: "turn_end" });
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
        /* ignore non-json */
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

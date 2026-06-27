/** Shared SSE consumer for Hermes OpenAI chunks and Companion run events. */

import { hermesGatewayEventToProgress } from "@jlc/runtime-core/map-tool-progress";
import type {
  CanonicalEvent,
  CanonicalOutputPayload,
  CanonicalTurnOutput,
  ChatPart,
} from "@/lib/chat-parts";
import type { TodoItem } from "@/lib/chat-parts";
import {
  parseRunStartedPayload,
  type RunStartedPayload,
} from "@/lib/chat-run-started";

export type ToolProgressPayload = {
  tool: string;
  status?: string;
  message?: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
};

export type ClarificationPayload = {
  runId: string;
  clarificationId: string;
  toolUseId: string;
  toolName?: string;
  question: string;
  questions: Array<{
    id: string;
    question: string;
    header?: string;
    options?: Array<{ label: string; description?: string }>;
    multiSelect?: boolean;
  }>;
  input?: unknown;
};

export type ChatStreamCallbacks = {
  onStreamStart?: () => void;
  onRunStarted?: (payload: RunStartedPayload) => void;
  onDelta: (content: string) => void;
  onInterimAssistant?: (payload: {
    text: string;
    alreadyStreamed?: boolean;
  }) => void;
  onCanonicalEvent?: (event: CanonicalEvent) => void;
  onCanonicalOutput?: (output: CanonicalTurnOutput) => void;
  onToolProgress?: (payload: ToolProgressPayload) => void;
  onClarificationRequired?: (payload: ClarificationPayload) => void;
  onPartAppend?: (part: ChatPart) => void;
  onPartPatch?: (patch: { id: string; merge: Record<string, unknown> }) => void;
  onTodoUpdate?: (items: TodoItem[]) => void;
  onStatus?: (label: string, phase?: string) => void;
  onRunFinished?: () => void;
  onRunError?: (message: string, code?: string) => void;
  onRunCancelled?: () => void;
};

function parseOpenAiDelta(data: string): string | null {
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

function parseStreamError(data: string): { message: string; code?: string } {
  try {
    const json = JSON.parse(data) as { error?: unknown; message?: unknown };
    const message =
      typeof json.message === "string"
        ? json.message
        : typeof json.error === "string"
          ? json.error
          : "stream terminated";
    return {
      message,
      code: typeof json.error === "string" ? json.error : undefined,
    };
  } catch {
    return { message: data || "stream terminated" };
  }
}

function parseCompanionPayload(
  eventName: string,
  data: string,
): {
  canonicalEvent?: CanonicalEvent;
  canonicalOutput?: CanonicalTurnOutput;
  delta?: string;
  interim?: { text: string; alreadyStreamed?: boolean };
  tool?: ToolProgressPayload;
  clarification?: ClarificationPayload;
  part?: ChatPart;
  partPatch?: { id: string; merge: Record<string, unknown> };
  todoItems?: TodoItem[];
  runStarted?: RunStartedPayload;
  status?: { label: string; phase?: string };
  error?: string;
  code?: string;
} | null {
  try {
    const json = JSON.parse(data) as Record<string, unknown>;
    if (eventName === "canonical.event" && typeof json.type === "string") {
      return { canonicalEvent: json as unknown as CanonicalEvent };
    }
    if (
      eventName === "canonical.output" &&
      json.canonicalOutput &&
      typeof json.canonicalOutput === "object"
    ) {
      const payload = json as unknown as CanonicalOutputPayload;
      return { canonicalOutput: payload.canonicalOutput };
    }
    if (eventName === "run.accepted") {
      const message =
        typeof json.message === "string"
          ? json.message
          : "正在准备运行环境…";
      return { status: { label: message, phase: "accepted" } };
    }
    if (eventName === "run.started") {
      return { runStarted: parseRunStartedPayload(json) };
    }
    if (eventName === "run.status") {
      const label =
        typeof json.label === "string" ? json.label : "";
      if (!label) return null;
      return {
        status: {
          label,
          phase:
            typeof json.phase === "string" ? json.phase : undefined,
        },
      };
    }
    if (eventName === "message.delta") {
      const content =
        typeof json.content === "string"
          ? json.content
          : typeof json.delta === "string"
            ? json.delta
            : typeof json.text === "string"
              ? json.text
            : null;
      return content ? { delta: content } : null;
    }
    if (
      eventName === "interim_assistant" ||
      eventName === "message.interim"
    ) {
      const text = typeof json.text === "string" ? json.text.trim() : "";
      const alreadyStreamed =
        json.already_streamed === true || json.alreadyStreamed === true;
      if (!text && !alreadyStreamed) return null;
      return {
        interim: {
          text,
          alreadyStreamed,
        },
      };
    }
    if (eventName === "tool.progress") {
      return {
        tool: {
          tool: String(json.tool ?? json.name ?? "tool"),
          status:
            typeof json.status === "string" ? json.status : undefined,
          message:
            typeof json.message === "string" ? json.message : undefined,
          callId: typeof json.callId === "string" ? json.callId : undefined,
          input: json.input,
          output: json.output,
        },
      };
    }
    if (eventName === "clarification.required") {
      const runId = typeof json.runId === "string" ? json.runId : "";
      const toolUseId =
        typeof json.toolUseId === "string"
          ? json.toolUseId
          : typeof json.clarificationId === "string"
            ? json.clarificationId
            : "";
      if (!runId || !toolUseId) return null;
      const questions: ClarificationPayload["questions"] = [];
      if (Array.isArray(json.questions)) {
        json.questions.forEach((item, index) => {
          if (!item || typeof item !== "object") return;
          const q = item as Record<string, unknown>;
          const question =
            typeof q.question === "string" ? q.question.trim() : "";
          if (!question) return;
          const options: Array<{ label: string; description?: string }> = [];
          if (Array.isArray(q.options)) {
            for (const option of q.options) {
              if (!option || typeof option !== "object") continue;
              const o = option as Record<string, unknown>;
              const label =
                typeof o.label === "string" ? o.label.trim() : "";
              if (!label) continue;
              options.push({
                label,
                description:
                  typeof o.description === "string"
                    ? o.description
                    : undefined,
              });
            }
          }
          questions.push({
            id: typeof q.id === "string" ? q.id : `q${index + 1}`,
            question,
            header: typeof q.header === "string" ? q.header : undefined,
            options,
            multiSelect: q.multiSelect === true,
          });
        });
      }
      const question =
        typeof json.question === "string"
          ? json.question
          : questions.map((q) => q.question).join("\n");
      return {
        clarification: {
          runId,
          clarificationId: toolUseId,
          toolUseId,
          toolName:
            typeof json.toolName === "string" ? json.toolName : undefined,
          question,
          questions:
            questions.length > 0
              ? questions
              : [{ id: "question", question: question || "请补充信息" }],
          input: json.input,
        },
      };
    }
    if (eventName === "run.waiting_user") {
      const question =
        typeof json.question === "string" ? json.question : "请补充信息后继续";
      return { status: { label: question, phase: "waiting_user" } };
    }
    if (eventName === "run.resumed") {
      return {
        status: {
          label: "已收到补充信息，正在继续执行…",
          phase: "running",
        },
      };
    }
    if (eventName === "run.error") {
      return {
        error:
          typeof json.message === "string"
            ? json.message
            : "Companion run failed",
        code: typeof json.code === "string" ? json.code : undefined,
      };
    }
    if (eventName === "part.append" && json.part && typeof json.part === "object") {
      return { part: json.part as ChatPart };
    }
    if (eventName === "part.patch" && typeof json.id === "string") {
      const merge =
        json.merge && typeof json.merge === "object"
          ? (json.merge as Record<string, unknown>)
          : {};
      return { partPatch: { id: json.id, merge } };
    }
    if (eventName === "todo.update" && Array.isArray(json.items)) {
      return { todoItems: json.items as TodoItem[] };
    }
    if (eventName === "run.finished" || eventName === "run.cancelled") {
      return {};
    }
    return null;
  } catch {
    return null;
  }
}

const hermesLabelByCallId = new Map<string, string>();

function parseHermesToolProgress(data: string): ToolProgressPayload | null {
  try {
    const json = JSON.parse(data) as unknown;
    return hermesGatewayEventToProgress(json, hermesLabelByCallId);
  } catch {
    return null;
  }
}

export async function consumeChatSse(
  body: ReadableStream<Uint8Array>,
  callbacks: ChatStreamCallbacks,
  options?: { format?: "openai" | "companion" },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const format = options?.format ?? "openai";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let streamStarted = false;

  const notifyStreamStart = () => {
    if (streamStarted) return;
    streamStarted = true;
    hermesLabelByCallId.clear();
    callbacks.onStreamStart?.();
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      notifyStreamStart();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          callbacks.onRunFinished?.();
          return { ok: true };
        }

        if (eventName === "error") {
          const parsed = parseStreamError(data);
          callbacks.onRunError?.(parsed.message, parsed.code);
          return { ok: false, error: parsed.message };
        }

        if (format === "companion") {
          const parsed = parseCompanionPayload(eventName, data);
          if (eventName === "run.error" && parsed?.error) {
            callbacks.onRunError?.(parsed.error, parsed.code);
            return { ok: false, error: parsed.error };
          }
          if (parsed?.canonicalEvent) {
            callbacks.onCanonicalEvent?.(parsed.canonicalEvent);
          }
          if (parsed?.canonicalOutput) {
            callbacks.onCanonicalOutput?.(parsed.canonicalOutput);
          }
          if (eventName === "run.accepted" && parsed?.status) {
            callbacks.onStatus?.(parsed.status.label, parsed.status.phase);
          }
          if (eventName === "run.started" && parsed?.runStarted) {
            callbacks.onRunStarted?.(parsed.runStarted);
          }
          if (eventName === "run.status" && parsed?.status) {
            callbacks.onStatus?.(parsed.status.label, parsed.status.phase);
          }
          if (parsed?.delta) callbacks.onDelta(parsed.delta);
          if (parsed?.interim) {
            callbacks.onInterimAssistant?.(parsed.interim);
          }
          if (parsed?.tool) callbacks.onToolProgress?.(parsed.tool);
          if (parsed?.clarification) {
            callbacks.onClarificationRequired?.(parsed.clarification);
          }
          if (parsed?.part) callbacks.onPartAppend?.(parsed.part);
          if (parsed?.partPatch) callbacks.onPartPatch?.(parsed.partPatch);
          if (parsed?.todoItems) callbacks.onTodoUpdate?.(parsed.todoItems);
          if (eventName === "run.finished") callbacks.onRunFinished?.();
          if (eventName === "run.cancelled") callbacks.onRunCancelled?.();
          eventName = "message";
          continue;
        }

        if (eventName === "hermes.tool.progress") {
          const tool = parseHermesToolProgress(data);
          if (tool) callbacks.onToolProgress?.(tool);
          eventName = "message";
          continue;
        }
        if (
          eventName === "part.append" ||
          eventName === "part.patch" ||
          eventName === "todo.update"
        ) {
          const parsed = parseCompanionPayload(eventName, data);
          if (parsed?.part) callbacks.onPartAppend?.(parsed.part);
          if (parsed?.partPatch) callbacks.onPartPatch?.(parsed.partPatch);
          if (parsed?.todoItems) callbacks.onTodoUpdate?.(parsed.todoItems);
          eventName = "message";
          continue;
        }

        const content = parseOpenAiDelta(data);
        if (content) callbacks.onDelta(content);
        eventName = "message";
      }
    }
    callbacks.onRunFinished?.();
    return { ok: true };
  } finally {
    reader.releaseLock();
  }
}

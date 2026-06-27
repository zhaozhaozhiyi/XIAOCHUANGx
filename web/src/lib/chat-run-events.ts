import type { RunEvent, RunRecord } from "@jlc/contracts";
import {
  applyPartsStateToMessage,
  initAssistantPartsState,
  reduceClarificationRequired,
  reduceInterimAssistant,
  reduceRunStarted,
  reduceStatusLabel,
  reduceStreamCancelled,
  reduceStreamError,
  reduceStreamFinished,
  reduceTextDelta,
  reduceTodoItems,
  reduceToolProgress,
  type AssistantPartsState,
} from "@/lib/chat-parts-reducer";
import { withAssistantContentSnapshot } from "@/lib/chat-parts-utils";
import type { ChatMessage } from "@/lib/chat";

function applyRunEvent(
  state: AssistantPartsState,
  event: RunEvent,
): AssistantPartsState {
  switch (event.type) {
    case "run.accepted":
      return reduceStatusLabel(
        reduceRunStarted(state, event.runId),
        event.message ?? "正在准备运行环境...",
        "accepted",
      );
    case "run.started":
      return reduceRunStarted(state, {
        runId: event.runId,
        baseProcessSkill: event.baseProcessSkill ?? null,
        processSkill: event.processSkill ?? null,
        platformNormSkill: event.platformNormSkill ?? null,
        orchestrationMode: event.orchestrationMode ?? null,
        catalogVersion: event.catalogVersion ?? null,
        catalogSlugs: event.catalogSlugs ?? null,
        injectedSkills: event.injectedSkills ?? event.capabilities ?? null,
      });
    case "run.status":
      return reduceStatusLabel(state, event.label, event.phase);
    case "message.delta":
      return reduceTextDelta(state, event.text);
    case "message.interim":
      return reduceInterimAssistant(state, {
        text: event.text,
        alreadyStreamed: event.alreadyStreamed,
      });
    case "tool.progress":
      return reduceToolProgress(state, {
        tool: event.tool,
        status:
          event.status === "done"
            ? "success"
            : event.status === "failed"
              ? "error"
              : event.status,
        message: event.message,
        callId: event.toolCallId,
      });
    case "todo.update":
      return reduceTodoItems(
        state,
        event.items.map((item) => ({
          id: item.id,
          content: item.content,
          status:
            item.status === "completed"
              ? "completed"
              : item.status === "cancelled"
                ? "cancelled"
                : item.status === "in_progress"
                  ? "in_progress"
                  : "pending",
        })),
      );
    case "clarification.required":
      return reduceClarificationRequired(state, {
        runId: event.runId,
        clarificationId: event.clarificationId,
        toolUseId: event.clarificationId,
        question: event.question,
        questions: [
          {
            id: "question",
            question: event.question,
            options: event.options?.map((label) => ({ label })),
          },
        ],
      });
    case "run.waiting_user":
      return reduceStatusLabel(state, "请补充信息后继续", "waiting_user");
    case "run.resumed":
      return reduceStatusLabel(state, "已收到补充信息，正在继续执行...", "running");
    case "run.finished":
    case "canonical.output":
      return reduceStreamFinished(state);
    case "run.cancelled":
      return reduceStreamCancelled(state);
    case "run.error":
      return reduceStreamError(state, event.message, event.code);
    default:
      return state;
  }
}

function statusFromRecord(record: RunRecord): ChatMessage["status"] {
  if (record.status === "failed") return "error";
  if (record.status === "cancelled") return "cancelled";
  if (record.status === "completed" || record.status === "waiting_user") {
    return "complete";
  }
  return "streaming";
}

export function applyRunEventsToMessage(
  message: ChatMessage,
  events: RunEvent[],
  record?: RunRecord,
): ChatMessage {
  if (message.role !== "assistant" || !message.runId || events.length === 0) {
    return message;
  }
  const state = events.reduce(
    applyRunEvent,
    initAssistantPartsState(),
  );
  const fromParts = applyPartsStateToMessage(message, state);
  const finalAnswer = record?.canonicalOutput?.finalAnswer.markdown.trim();
  return withAssistantContentSnapshot({
    ...fromParts,
    status: record ? statusFromRecord(record) : fromParts.status,
    canonicalOutput: record?.canonicalOutput ?? fromParts.canonicalOutput,
    content: finalAnswer || fromParts.content,
  });
}

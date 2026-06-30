import type { ChatMessage } from "@/lib/chat";
import { getSeedMessages } from "@/lib/chat";
import {
  loadChatSessionMessages,
  sanitizeMessages,
  saveChatSessionMessages,
} from "@/lib/chat-session-messages";
import type { CompanionRunRecord } from "@/lib/companion/types";
import {
  fetchCompanionSessionMessages,
  saveCompanionSessionMessages,
} from "@/lib/companion/session-messages";
import { fetchRunEvents, fetchRunRecord } from "@/lib/companion/runtime";
import { applyRunEventsToMessage } from "@/lib/chat-run-events";

export type LoadedSessionMessages = {
  messages: ChatMessage[];
  projectId?: string | null;
};

function statusFromRunRecord(
  record: CompanionRunRecord,
  message?: ChatMessage,
): ChatMessage["status"] {
  if (record.status === "failed") return "error";
  if (record.status === "cancelled") return "cancelled";
  const submittedClarification = message?.parts?.some(
    (part) => part.kind === "clarification" && part.submitted,
  );
  if (submittedClarification) return "complete";
  if (record.status === "completed" || record.status === "waiting_user") {
    return "complete";
  }
  return "streaming";
}

export function applyRunRecordToMessage(
  message: ChatMessage,
  record: CompanionRunRecord,
): ChatMessage {
  if (message.role !== "assistant") return message;
  const status = statusFromRunRecord(record, message);
  const canonicalOutput = record.canonicalOutput ?? message.canonicalOutput;
  const finalAnswer = canonicalOutput?.finalAnswer.markdown.trim();
  return {
    ...message,
    status,
    canonicalOutput,
    content: finalAnswer || message.content,
  };
}

async function restoreInflightMessages(
  messages: ChatMessage[],
): Promise<ChatMessage[]> {
  const runBacked = messages.filter(
    (message) =>
      message.role === "assistant" &&
      !!message.runId &&
      ((message.status === "loading" || message.status === "streaming") ||
        !message.parts?.length),
  );
  if (runBacked.length === 0) return messages;

  const records = await Promise.all(
    runBacked.map(async (message) => {
      try {
        return [message.runId, await fetchRunRecord(message.runId!)] as const;
      } catch {
        return [message.runId, null] as const;
      }
    }),
  );
  const byRunId = new Map(records);
  const events = await Promise.all(
    runBacked.map(async (message) => {
      try {
        return [message.runId, await fetchRunEvents(message.runId!)] as const;
      } catch {
        return [message.runId, null] as const;
      }
    }),
  );
  const eventsByRunId = new Map(events);

  return messages.map((message) => {
    if (!message.runId) return message;
    const record = byRunId.get(message.runId);
    const runEvents = eventsByRunId.get(message.runId);
    if (runEvents?.items?.length) {
      return applyRunEventsToMessage(
        message,
        runEvents.items,
        record ?? undefined,
      );
    }
    return record ? applyRunRecordToMessage(message, record) : message;
  });
}

/** Companion 优先 → localStorage → demo seed */
export async function loadSessionMessagesHybrid(
  sessionId: string,
): Promise<LoadedSessionMessages> {
  const remote = await fetchCompanionSessionMessages(sessionId);
  if (remote?.messages?.length) {
    const sanitizedRemote = sanitizeMessages(remote.messages, {
      preserveInflight: true,
    });
    const restored = await restoreInflightMessages(sanitizedRemote);
    saveChatSessionMessages(sessionId, restored, { preserveInflight: true });
    return { messages: restored, projectId: remote.projectId };
  }
  const local = loadChatSessionMessages(sessionId);
  if (local?.length) {
    const restored = await restoreInflightMessages(local);
    saveChatSessionMessages(sessionId, restored, { preserveInflight: true });
    return { messages: restored };
  }
  return { messages: getSeedMessages(sessionId) ?? [] };
}

export async function saveSessionMessagesHybrid(
  sessionId: string,
  messages: ChatMessage[],
  projectId?: string,
): Promise<void> {
  const localSnapshot = sanitizeMessages(messages, { preserveInflight: true });
  saveChatSessionMessages(sessionId, localSnapshot, { preserveInflight: true });
  const hasInflight = localSnapshot.some(
    (message) => message.status === "loading" || message.status === "streaming",
  );
  if (hasInflight) return;
  const remoteSnapshot = sanitizeMessages(messages);
  await saveCompanionSessionMessages(sessionId, remoteSnapshot, projectId);
}

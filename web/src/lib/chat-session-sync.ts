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
import { fetchRunRecord } from "@/lib/companion/runtime";

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
  const inflight = messages.filter(
    (message) =>
      message.role === "assistant" &&
      (message.status === "loading" || message.status === "streaming") &&
      !!message.runId,
  );
  if (inflight.length === 0) return messages;

  const records = await Promise.all(
    inflight.map(async (message) => {
      try {
        return [message.runId, await fetchRunRecord(message.runId!)] as const;
      } catch {
        return [message.runId, null] as const;
      }
    }),
  );
  const byRunId = new Map(records);
  return messages.map((message) => {
    if (!message.runId) return message;
    const record = byRunId.get(message.runId);
    return record ? applyRunRecordToMessage(message, record) : message;
  });
}

/** Companion 优先 → localStorage → demo seed */
export async function loadSessionMessagesHybrid(
  sessionId: string,
): Promise<ChatMessage[]> {
  const remote = await fetchCompanionSessionMessages(sessionId);
  if (remote?.messages?.length) {
    const sanitizedRemote = sanitizeMessages(remote.messages, {
      preserveInflight: true,
    });
    const restored = await restoreInflightMessages(sanitizedRemote);
    saveChatSessionMessages(sessionId, restored, { preserveInflight: true });
    return restored;
  }
  const local = loadChatSessionMessages(sessionId);
  if (local?.length) {
    const restored = await restoreInflightMessages(local);
    saveChatSessionMessages(sessionId, restored, { preserveInflight: true });
    return restored;
  }
  return getSeedMessages(sessionId) ?? [];
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

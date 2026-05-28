import type { ChatMessage } from "@/lib/chat";
import { withAssistantContentSnapshot } from "@/lib/chat-parts-utils";

const MESSAGES_PREFIX = "jlc-chat-messages-";

function storageKey(sessionId: string): string {
  return `${MESSAGES_PREFIX}${sessionId}`;
}

function terminalTiming(message: ChatMessage): {
  finishedAt?: number;
  durationMs?: number;
} {
  const turnMeta = message.parts?.find((part) => part.kind === "turn_meta");
  if (turnMeta?.kind === "turn_meta") {
    return {
      finishedAt: turnMeta.completedAt,
      durationMs: turnMeta.durationMs,
    };
  }
  return {};
}

function finalizeCanonicalOutput(message: ChatMessage): ChatMessage {
  if (message.role !== "assistant" || !message.canonicalOutput) {
    return message;
  }

  const existingDebug = message.canonicalOutput.debug;
  const canonicalOutput = {
    ...message.canonicalOutput,
    finalAnswer: {
      ...message.canonicalOutput.finalAnswer,
      markdown:
        message.canonicalOutput.finalAnswer.markdown.trim() || !message.content.trim()
          ? message.canonicalOutput.finalAnswer.markdown
          : message.content.trim(),
    },
    debug: {
      ...existingDebug,
      assistantDeltaCount:
        existingDebug?.assistantDeltaCount ??
        (message.content.trim() ? 1 : 0),
      toolFinishedCount:
        existingDebug?.toolFinishedCount ??
        existingDebug?.toolCallCount ??
        0,
      latestStatus:
        existingDebug?.latestStatus ??
        (message.status === "complete"
          ? "completed"
          : message.status === "cancelled"
            ? "cancelled"
            : message.status === "error"
              ? "failed"
              : undefined),
    },
  };

  const normalizedStatus =
    message.status === "complete"
      ? "success"
      : message.status === "cancelled"
        ? "cancelled"
        : message.status === "error"
          ? "failed"
          : null;

  if (!normalizedStatus) {
    return { ...message, canonicalOutput };
  }

  const { finishedAt, durationMs } = terminalTiming(message);
  const resolvedFinishedAt =
    canonicalOutput.outcome.finishedAt ?? finishedAt ?? Date.now();

  return {
    ...message,
    canonicalOutput: {
      ...canonicalOutput,
      debug: {
        ...canonicalOutput.debug,
        latestStatus:
          normalizedStatus === "success"
            ? "completed"
            : normalizedStatus === "cancelled"
              ? "cancelled"
              : normalizedStatus === "failed"
                ? "failed"
                : canonicalOutput.debug?.latestStatus,
      },
      outcome: {
        ...canonicalOutput.outcome,
        status: normalizedStatus,
        finishedAt: resolvedFinishedAt,
        durationMs:
          canonicalOutput.outcome.durationMs ??
          durationMs ??
          (message.runStartedAt != null
            ? Math.max(0, resolvedFinishedAt - message.runStartedAt)
            : undefined),
      },
      nextAction: { type: "none" },
    },
  };
}

type SanitizeOptions = {
  preserveInflight?: boolean;
};

function freezeInflightParts(msg: ChatMessage): ChatMessage {
  const parts = msg.parts?.map((p) => ({
    ...p,
    streaming: false,
    completedAt: p.completedAt ?? Date.now(),
  }));
  return withAssistantContentSnapshot({
    ...msg,
    status: msg.status === "loading" ? "cancelled" : "complete",
    parts,
  });
}

function preserveInflightMessage(msg: ChatMessage): ChatMessage {
  return withAssistantContentSnapshot({
    ...msg,
    canonicalEvents: undefined,
  });
}

function stripTransientAttachmentPayloads(msg: ChatMessage): ChatMessage {
  if (msg.role !== "user" || !msg.attachments?.length) return msg;
  return {
    ...msg,
    attachments: msg.attachments.map((attachment) => {
      const rest = { ...attachment };
      delete rest.contentBase64;
      return rest;
    }),
  };
}

export function sanitizeMessage(
  msg: ChatMessage,
  options?: SanitizeOptions,
): ChatMessage | null {
  const base = stripTransientAttachmentPayloads({
    ...msg,
    canonicalEvents: undefined,
  });
  if (msg.role === "assistant" && msg.status === "loading" && !msg.content?.trim()) {
    const hasParts = (msg.parts?.length ?? 0) > 0;
    if (!hasParts) return null;
  }

  if (msg.status === "streaming" || msg.status === "loading") {
    if (options?.preserveInflight) {
      return preserveInflightMessage(base);
    }
    return finalizeCanonicalOutput(freezeInflightParts(base));
  }

  return finalizeCanonicalOutput(withAssistantContentSnapshot(base));
}

export function sanitizeMessages(
  messages: ChatMessage[],
  options?: SanitizeOptions,
): ChatMessage[] {
  const sanitized = messages
    .map((message) => sanitizeMessage(message, options))
    .filter((message): message is ChatMessage => message != null);
  return dedupeMessages(sanitized);
}

function attachmentKey(message: ChatMessage): string {
  return JSON.stringify(
    (message.attachments ?? []).map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      path: attachment.path,
      size: attachment.size,
      lastModified: attachment.lastModified,
    })),
  );
}

function duplicateUserKey(message: ChatMessage): string | null {
  if (message.role !== "user") return null;
  return `${message.content.trim()}\u0000${attachmentKey(message)}`;
}

function dedupeMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  const seenIds = new Set<string>();
  let lastUserKey: string | null = null;

  for (const message of messages) {
    if (seenIds.has(message.id)) continue;

    const userKey = duplicateUserKey(message);
    if (userKey && userKey === lastUserKey) {
      seenIds.add(message.id);
      continue;
    }

    result.push(message);
    seenIds.add(message.id);
    lastUserKey = userKey;
  }

  return result;
}

export function loadChatSessionMessages(sessionId: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const restored = sanitizeMessages(parsed, { preserveInflight: true });
    return restored.length > 0 ? restored : null;
  } catch {
    return null;
  }
}

export function saveChatSessionMessages(
  sessionId: string,
  messages: ChatMessage[],
  options?: SanitizeOptions,
): void {
  if (typeof window === "undefined") return;
  const toSave = sanitizeMessages(messages, options);
  if (toSave.length === 0) {
    localStorage.removeItem(storageKey(sessionId));
    return;
  }
  try {
    localStorage.setItem(storageKey(sessionId), JSON.stringify(toSave));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function clearChatSessionMessages(sessionId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(sessionId));
}

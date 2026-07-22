import type { ChatMessage } from "@/lib/chat";
import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import type { CompanionSessionSummary } from "@/lib/companion/types";

export type SessionMessagesResponse = {
  sessionId: string;
  messages: ChatMessage[];
  updatedAt: string | null;
  projectId?: string | null;
  source?: string;
};

export async function fetchCompanionSessions(): Promise<
  CompanionSessionSummary[] | null
> {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return null;
  }
  try {
    const res = await fetch("/api/sessions", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: CompanionSessionSummary[] };
    return Array.isArray(body.items) ? body.items : null;
  } catch {
    return null;
  }
}

export async function fetchCompanionSessionMessages(
  sessionId: string,
): Promise<SessionMessagesResponse | null> {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return null;
  }
  try {
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as SessionMessagesResponse;
  } catch {
    return null;
  }
}

export async function saveCompanionSessionMessages(
  sessionId: string,
  messages: ChatMessage[],
  projectId?: string,
): Promise<boolean> {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return false;
  }
  try {
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, projectId }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

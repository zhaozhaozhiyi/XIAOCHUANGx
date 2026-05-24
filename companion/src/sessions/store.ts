import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "complete" | "loading" | "streaming" | "error" | "cancelled";
  parts?: unknown[];
  activityCollapse?: string;
  runId?: string;
  runStartedAt?: number;
  canonicalOutput?: unknown;
};

export type SessionMessagesRecord = {
  sessionId: string;
  projectId?: string;
  messages: StoredChatMessage[];
  updatedAt: string;
};

function sessionsDir(): string {
  return join(config.dataDir, "sessions");
}

function sessionFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(sessionsDir(), `${safe}.json`);
}

async function ensureSessionsDir(): Promise<void> {
  await mkdir(sessionsDir(), { recursive: true });
}

export async function loadSessionMessages(
  sessionId: string,
): Promise<SessionMessagesRecord | null> {
  await ensureSessionsDir();
  try {
    const raw = await readFile(sessionFile(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionMessagesRecord;
    if (parsed.sessionId !== sessionId || !Array.isArray(parsed.messages)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSessionMessages(
  sessionId: string,
  messages: StoredChatMessage[],
  projectId?: string,
): Promise<SessionMessagesRecord> {
  await ensureSessionsDir();
  const record: SessionMessagesRecord = {
    sessionId,
    projectId,
    messages,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(sessionFile(sessionId), JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function appendSessionMessages(
  sessionId: string,
  nextMessages: StoredChatMessage[],
  projectId?: string,
): Promise<SessionMessagesRecord> {
  const prev = await loadSessionMessages(sessionId);
  const messages = [...(prev?.messages ?? []), ...nextMessages];
  return saveSessionMessages(
    sessionId,
    messages,
    projectId ?? prev?.projectId,
  );
}

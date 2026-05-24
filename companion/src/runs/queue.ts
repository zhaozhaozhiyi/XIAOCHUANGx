import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";
import type { CreateRunRequest } from "../types.js";
export type QueuedRunControl = {
  id: string;
  runId: string;
  sessionId: string;
  action: "enqueue";
  text: string;
  attachments?: Array<{ fileId: string }>;
  request: CreateRunRequest;
  createdAt: string;
};

export type SessionRunQueueRecord = {
  sessionId: string;
  items: QueuedRunControl[];
  updatedAt: string;
};

function queueDir(): string {
  return join(config.dataDir, "run-queues");
}

function queueFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(queueDir(), `${safe}.json`);
}

async function ensureQueueDir(): Promise<void> {
  await mkdir(queueDir(), { recursive: true });
}

export async function loadSessionRunQueue(
  sessionId: string,
): Promise<SessionRunQueueRecord> {
  await ensureQueueDir();
  try {
    const raw = await readFile(queueFile(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionRunQueueRecord;
    if (parsed.sessionId !== sessionId || !Array.isArray(parsed.items)) {
      throw new Error("invalid queue record");
    }
    return parsed;
  } catch {
    return {
      sessionId,
      items: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

async function saveSessionRunQueue(
  record: SessionRunQueueRecord,
): Promise<SessionRunQueueRecord> {
  await ensureQueueDir();
  const next: SessionRunQueueRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(queueFile(record.sessionId), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function enqueueSessionRunControl(
  item: QueuedRunControl,
): Promise<SessionRunQueueRecord> {
  const record = await loadSessionRunQueue(item.sessionId);
  record.items.push(item);
  return saveSessionRunQueue(record);
}

export async function dequeueSessionRunControl(
  sessionId: string,
): Promise<QueuedRunControl | null> {
  const record = await loadSessionRunQueue(sessionId);
  const item = record.items.shift() ?? null;
  await saveSessionRunQueue(record);
  return item;
}

export async function peekSessionRunQueue(
  sessionId: string,
): Promise<QueuedRunControl[]> {
  const record = await loadSessionRunQueue(sessionId);
  return record.items;
}

export async function replaceSessionRunQueue(
  sessionId: string,
  items: QueuedRunControl[],
): Promise<SessionRunQueueRecord> {
  return saveSessionRunQueue({
    sessionId,
    items,
    updatedAt: new Date().toISOString(),
  });
}

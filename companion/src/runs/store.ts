import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  runEventSchema,
  runRecordSchema,
  type CanonicalTurnOutput,
  type RunEvent,
  type RunRecord,
  type RunStatus,
} from "@jlc/contracts";
import { config } from "../config.js";

type RunEventsRecord = {
  runId: string;
  items: RunEvent[];
  updatedAt: string;
};

type SessionRunsIndex = {
  sessionId: string;
  runIds: string[];
  updatedAt: string;
};

function runsDir(): string {
  return join(config.dataDir, "runs");
}

function recordsDir(): string {
  return join(runsDir(), "records");
}

function eventsDir(): string {
  return join(runsDir(), "events");
}

function sessionsDir(): string {
  return join(runsDir(), "sessions");
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function runRecordFile(runId: string): string {
  return join(recordsDir(), `${safeId(runId)}.json`);
}

function runEventsFile(runId: string): string {
  return join(eventsDir(), `${safeId(runId)}.json`);
}

function sessionRunsFile(sessionId: string): string {
  return join(sessionsDir(), `${safeId(sessionId)}.json`);
}

async function ensureDirs(): Promise<void> {
  await mkdir(recordsDir(), { recursive: true });
  await mkdir(eventsDir(), { recursive: true });
  await mkdir(sessionsDir(), { recursive: true });
}

export async function loadRunRecord(runId: string): Promise<RunRecord | null> {
  await ensureDirs();
  try {
    const raw = await readFile(runRecordFile(runId), "utf8");
    const parsed = runRecordSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadSessionRunsIndex(
  sessionId: string,
): Promise<SessionRunsIndex> {
  await ensureDirs();
  try {
    const raw = await readFile(sessionRunsFile(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionRunsIndex;
    if (parsed.sessionId !== sessionId || !Array.isArray(parsed.runIds)) {
      throw new Error("invalid session run index");
    }
    return parsed;
  } catch {
    return {
      sessionId,
      runIds: [],
      updatedAt: new Date().toISOString(),
    };
  }
}

async function saveSessionRunsIndex(index: SessionRunsIndex): Promise<void> {
  await ensureDirs();
  const next: SessionRunsIndex = {
    ...index,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(
    sessionRunsFile(index.sessionId),
    JSON.stringify(next, null, 2),
    "utf8",
  );
}

async function ensureSessionRunIndexed(
  sessionId: string,
  runId: string,
): Promise<void> {
  const index = await loadSessionRunsIndex(sessionId);
  if (index.runIds.includes(runId)) return;
  index.runIds.push(runId);
  await saveSessionRunsIndex(index);
}

export async function saveRunRecord(record: RunRecord): Promise<RunRecord> {
  await ensureDirs();
  const parsed = runRecordSchema.parse(record);
  await writeFile(
    runRecordFile(parsed.runId),
    JSON.stringify(parsed, null, 2),
    "utf8",
  );
  await ensureSessionRunIndexed(parsed.sessionId, parsed.runId);
  return parsed;
}

export async function upsertRunRecord(
  input: RunRecord,
): Promise<RunRecord> {
  const existing = await loadRunRecord(input.runId);
  if (!existing) {
    return saveRunRecord(input);
  }
  const merged: RunRecord = {
    ...existing,
    ...input,
    createdAt: existing.createdAt,
    startedAt: input.startedAt ?? existing.startedAt,
    finishedAt: input.finishedAt ?? existing.finishedAt,
    parentRunId: input.parentRunId ?? existing.parentRunId,
    resumeToken: input.resumeToken ?? existing.resumeToken,
  };
  return saveRunRecord(merged);
}

export async function patchRunRecord(
  runId: string,
  patch: Partial<RunRecord> & { canonicalOutput?: CanonicalTurnOutput },
): Promise<RunRecord | null> {
  const existing = await loadRunRecord(runId);
  if (!existing) return null;
  const next: RunRecord = {
    ...existing,
    ...patch,
    runId: existing.runId,
    createdAt: existing.createdAt,
  };
  return saveRunRecord(next);
}

export async function updateRunStatus(
  runId: string,
  status: RunStatus,
  extra?: { startedAt?: string; finishedAt?: string },
): Promise<RunRecord | null> {
  return patchRunRecord(runId, {
    status,
    startedAt: extra?.startedAt,
    finishedAt: extra?.finishedAt,
  });
}

export async function loadRunEvents(runId: string): Promise<RunEvent[]> {
  await ensureDirs();
  try {
    const raw = await readFile(runEventsFile(runId), "utf8");
    const parsed = JSON.parse(raw) as RunEventsRecord;
    if (parsed.runId !== runId || !Array.isArray(parsed.items)) {
      throw new Error("invalid run events");
    }
    return parsed.items
      .map((item) => runEventSchema.safeParse(item))
      .filter((result): result is { success: true; data: RunEvent } => result.success)
      .map((result) => result.data);
  } catch {
    return [];
  }
}

export async function appendRunEvent(
  runId: string,
  event: RunEvent,
): Promise<RunEventsRecord> {
  await ensureDirs();
  const existing = await loadRunEvents(runId);
  const next: RunEventsRecord = {
    runId,
    items: [...existing, runEventSchema.parse(event)],
    updatedAt: new Date().toISOString(),
  };
  await writeFile(runEventsFile(runId), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function listSessionRunRecords(
  sessionId: string,
): Promise<RunRecord[]> {
  const index = await loadSessionRunsIndex(sessionId);
  const items = await Promise.all(index.runIds.map((runId) => loadRunRecord(runId)));
  return items
    .filter((item): item is RunRecord => item != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

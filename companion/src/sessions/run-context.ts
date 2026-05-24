import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { config } from "../config.js";

export type SessionRunContext = {
  sessionId: string;
  lastWorkspaceProjectId?: string;
  lastAgentId?: string;
  updatedAt: string;
};

function contextDir(): string {
  return join(config.dataDir, "session-run-context");
}

function contextFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(contextDir(), `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(contextDir(), { recursive: true });
}

export async function loadSessionRunContext(
  sessionId: string,
): Promise<SessionRunContext | null> {
  await ensureDir();
  try {
    const raw = await readFile(contextFile(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionRunContext;
    if (parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSessionRunContext(
  sessionId: string,
  patch: { lastWorkspaceProjectId?: string; lastAgentId?: string },
): Promise<SessionRunContext> {
  await ensureDir();
  const prev = (await loadSessionRunContext(sessionId)) ?? {
    sessionId,
    updatedAt: new Date().toISOString(),
  };
  const record: SessionRunContext = {
    sessionId,
    lastWorkspaceProjectId:
      patch.lastWorkspaceProjectId ?? prev.lastWorkspaceProjectId,
    lastAgentId: patch.lastAgentId ?? prev.lastAgentId,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(contextFile(sessionId), JSON.stringify(record, null, 2), "utf8");
  return record;
}

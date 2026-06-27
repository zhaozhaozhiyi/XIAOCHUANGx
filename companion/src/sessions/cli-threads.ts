import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { config } from "../config.js";

export type AgentThreadRecord = {
  sessionId: string;
  agentId: string;
  cwd: string;
  cwdKey: string;
  threadId: string;
  updatedAt: string;
};

function threadsDir(): string {
  return join(config.dataDir, "cli-threads");
}

function threadFile(sessionId: string, agentId: string): string {
  const safe = `${sessionId}_${agentId}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(threadsDir(), `${safe}.json`);
}

export function cwdKey(cwd: string): string {
  return createHash("sha256").update(cwd).digest("hex").slice(0, 16);
}

async function ensureDir(): Promise<void> {
  await mkdir(threadsDir(), { recursive: true });
}

export async function loadCodexThread(
  sessionId: string,
  agentId: string,
  cwd: string,
): Promise<string | null> {
  await ensureDir();
  try {
    const raw = await readFile(threadFile(sessionId, agentId), "utf8");
    const parsed = JSON.parse(raw) as AgentThreadRecord;
    if (parsed.cwdKey !== cwdKey(cwd)) return null;
    return parsed.threadId;
  } catch {
    return null;
  }
}

export async function loadAgentThread(
  sessionId: string,
  agentId: string,
  cwd: string,
): Promise<string | null> {
  return loadCodexThread(sessionId, agentId, cwd);
}

export async function saveCodexThread(
  sessionId: string,
  agentId: string,
  cwd: string,
  threadId: string,
): Promise<void> {
  await ensureDir();
  const record: AgentThreadRecord = {
    sessionId,
    agentId,
    cwd,
    cwdKey: cwdKey(cwd),
    threadId,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(
    threadFile(sessionId, agentId),
    JSON.stringify(record, null, 2),
    "utf8",
  );
}

export async function saveAgentThread(
  sessionId: string,
  agentId: string,
  cwd: string,
  threadId: string,
): Promise<void> {
  return saveCodexThread(sessionId, agentId, cwd, threadId);
}

export async function clearCodexThread(
  sessionId: string,
  agentId: string,
): Promise<void> {
  await ensureDir();
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(threadFile(sessionId, agentId));
  } catch {
    /* missing */
  }
}

export async function clearAgentThread(
  sessionId: string,
  agentId: string,
): Promise<void> {
  return clearCodexThread(sessionId, agentId);
}

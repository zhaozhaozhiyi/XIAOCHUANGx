import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunStatus } from "@jlc/contracts";
import type {
  CreateRunBinding,
  ModuleId,
  RunTimeoutProfile,
} from "../types.js";
import { config } from "../config.js";

export type SessionRuntimeRecord = {
  sessionId: string;
  projectId?: string;
  workspaceProjectId?: string;
  resolvedCwd?: string;
  resolvedCwdSource?: "session_runtime" | "workspace_project" | "lazy_default_workspace";
  agentId?: string;
  agentModel?: string;
  moduleId?: ModuleId;
  binding?: CreateRunBinding;
  processSkill?: string | null;
  platformNormSkill?: string | null;
  injectedSkills?: string[];
  orchestrationMode?: string | null;
  catalogVersion?: string | null;
  catalogSlugs?: string[] | null;
  stablePromptHash?: string;
  skillsRoot?: string;
  promptsRoot?: string;
  agentKitPath?: string | null;
  timeoutProfile?: RunTimeoutProfile;
  timeoutMs?: number;
  idleTimeoutMs?: number;
  lastRunId?: string;
  lastRunStatus?: RunStatus;
  lastStatusLabel?: string;
  createdAt: string;
  updatedAt: string;
};

function runtimeDir(): string {
  return join(config.dataDir, "session-runtime");
}

function runtimeFile(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(runtimeDir(), `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  await mkdir(runtimeDir(), { recursive: true });
}

async function saveSessionRuntime(
  record: SessionRuntimeRecord,
): Promise<SessionRuntimeRecord> {
  await ensureDir();
  await writeFile(
    runtimeFile(record.sessionId),
    JSON.stringify(record, null, 2),
    "utf8",
  );
  return record;
}

export async function loadSessionRuntime(
  sessionId: string,
): Promise<SessionRuntimeRecord | null> {
  await ensureDir();
  try {
    const raw = await readFile(runtimeFile(sessionId), "utf8");
    const parsed = JSON.parse(raw) as SessionRuntimeRecord;
    if (parsed.sessionId !== sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function patchSessionRuntime(
  sessionId: string,
  patch: Partial<SessionRuntimeRecord>,
): Promise<SessionRuntimeRecord> {
  const prev = (await loadSessionRuntime(sessionId)) ?? {
    sessionId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const next: SessionRuntimeRecord = {
    ...prev,
    ...patch,
    sessionId,
    createdAt: prev.createdAt,
    updatedAt: new Date().toISOString(),
  };
  return saveSessionRuntime(next);
}

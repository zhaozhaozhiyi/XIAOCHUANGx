import {
  loadSessionRuntime,
  patchSessionRuntime,
} from "./runtime.js";

export type SessionRunContext = {
  sessionId: string;
  lastWorkspaceProjectId?: string;
  lastAgentId?: string;
  updatedAt: string;
};

export async function loadSessionRunContext(
  sessionId: string,
): Promise<SessionRunContext | null> {
  const runtime = await loadSessionRuntime(sessionId);
  if (!runtime) return null;
  return {
    sessionId,
    lastWorkspaceProjectId: runtime.workspaceProjectId,
    lastAgentId: runtime.agentId,
    updatedAt: runtime.updatedAt,
  };
}

export async function saveSessionRunContext(
  sessionId: string,
  patch: { lastWorkspaceProjectId?: string; lastAgentId?: string },
): Promise<SessionRunContext> {
  const runtime = await patchSessionRuntime(sessionId, {
    workspaceProjectId: patch.lastWorkspaceProjectId,
    agentId: patch.lastAgentId,
  });
  return {
    sessionId,
    lastWorkspaceProjectId: runtime.workspaceProjectId,
    lastAgentId: runtime.agentId,
    updatedAt: runtime.updatedAt,
  };
}

/** Server-side Companion daemon settings (BFF → localhost Companion). */

function envBool(name: string, defaultValue = false): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return defaultValue;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

export type ChatExecutionMode = "hermes" | "companion";

export function chatExecutionMode(): ChatExecutionMode {
  const v = (process.env.CHAT_EXECUTION ?? "companion").toLowerCase();
  return v === "hermes" ? "hermes" : "companion";
}

export const companionConfig = {
  baseUrl: (process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477").replace(
    /\/$/,
    "",
  ),
  apiToken: process.env.COMPANION_API_TOKEN ?? "",
  /** Mock Companion + mock CLI spawn (no daemon). */
  useMock: envBool("COMPANION_USE_MOCK", false),
} as const;

export function companionUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${companionConfig.baseUrl}${p}`;
}

export function companionHealthUrl(): string {
  return companionUrl("/v1/health");
}

export function companionAgentsUrl(): string {
  return companionUrl("/v1/agents");
}

export function companionAgentsDetectUrl(): string {
  return companionUrl("/v1/agents/detect");
}

export function companionAgentTestUrl(): string {
  return companionUrl("/v1/agents/test");
}

export function companionRunsUrl(): string {
  return companionUrl("/v1/runs");
}

export function companionRunCancelUrl(runId: string): string {
  return companionUrl(`/v1/runs/${encodeURIComponent(runId)}/cancel`);
}

export function companionRunControlUrl(runId: string): string {
  return companionUrl(`/v1/runs/${encodeURIComponent(runId)}/control`);
}

export function companionRunClarificationUrl(runId: string): string {
  return companionUrl(`/v1/runs/${encodeURIComponent(runId)}/clarification`);
}

export function companionProjectsUrl(): string {
  return companionUrl("/v1/projects");
}

export function companionProjectsEnsureUrl(): string {
  return companionUrl("/v1/projects/ensure");
}

export function companionProjectsImportFolderUrl(): string {
  return companionUrl("/v1/projects/import-folder");
}

export function companionProjectsEnsureDefaultTaskUrl(): string {
  return companionUrl("/v1/projects/ensure-default-task-project");
}

export function companionProjectTreeUrl(
  projectId: string,
  relPath?: string,
): string {
  const base = `/v1/projects/${encodeURIComponent(projectId)}/tree`;
  if (!relPath?.trim()) return companionUrl(base);
  const q = new URLSearchParams({ path: relPath.trim() });
  return companionUrl(`${base}?${q}`);
}

export function companionProjectFilesIndexUrl(
  projectId: string,
  query?: string,
): string {
  const base = `/v1/projects/${encodeURIComponent(projectId)}/files-index`;
  if (!query?.trim()) return companionUrl(base);
  const q = new URLSearchParams({ q: query.trim() });
  return companionUrl(`${base}?${q}`);
}

export function companionProjectFileUrl(
  projectId: string,
  relPath: string,
): string {
  const q = new URLSearchParams({ path: relPath });
  return companionUrl(
    `/v1/projects/${encodeURIComponent(projectId)}/files?${q}`,
  );
}

export function companionProjectUploadUrl(projectId: string): string {
  return companionUrl(`/v1/projects/${encodeURIComponent(projectId)}/uploads`);
}

export function companionSessionMessagesUrl(sessionId: string): string {
  return companionUrl(
    `/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
  );
}

export function companionSessionRunsUrl(sessionId: string): string {
  return companionUrl(`/v1/sessions/${encodeURIComponent(sessionId)}/runs`);
}

export function companionSessionQueueUrl(sessionId: string): string {
  return companionUrl(`/v1/sessions/${encodeURIComponent(sessionId)}/queue`);
}

export function companionRunRecordUrl(runId: string): string {
  return companionUrl(`/v1/runs/${encodeURIComponent(runId)}`);
}

export function companionRunEventsUrl(runId: string): string {
  return companionUrl(`/v1/runs/${encodeURIComponent(runId)}/events`);
}

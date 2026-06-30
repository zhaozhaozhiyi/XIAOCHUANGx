import {
  companionAgentsUrl,
  companionConfig,
  companionHealthUrl,
  companionProjectFileUrl,
  companionProjectFilesUrl,
  companionProjectEntriesUrl,
  companionProjectFilesIndexUrl,
  companionProjectUploadUrl,
  companionProjectTreeUrl,
  companionProjectsEnsureUrl,
  companionProjectsEnsureDefaultTaskUrl,
  companionProjectsImportFolderUrl,
  companionProjectsUrl,
  companionUrl,
} from "@/lib/companion/config";
import type { WorkspaceKind } from "@/lib/companion/types";
import type {
  CompanionAgentsResponse,
  CompanionHealthResponse,
  CompanionProjectSummary,
} from "@/lib/companion/types";

export type CompanionFileTreeNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  relativePath?: string;
  children?: CompanionFileTreeNode[];
};

export type CompanionProjectTreeResponse = {
  projectId: string;
  root: string;
  tree: CompanionFileTreeNode[];
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }
  return headers;
}

export async function companionFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : companionUrl(path);
  return fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
}

export async function fetchCompanionHealth(): Promise<CompanionHealthResponse> {
  const res = await companionFetch(companionHealthUrl());
  return (await res.json()) as CompanionHealthResponse;
}

export async function fetchCompanionAgents(): Promise<CompanionAgentsResponse> {
  const res = await companionFetch(companionAgentsUrl());
  return (await res.json()) as CompanionAgentsResponse;
}

export async function fetchCompanionProjects(): Promise<{
  projects: CompanionProjectSummary[];
}> {
  const res = await companionFetch(companionProjectsUrl());
  return (await res.json()) as { projects: CompanionProjectSummary[] };
}

export async function createCompanionProject(input: {
  workspaceKind: WorkspaceKind;
  name: string;
  baseDir?: string;
}): Promise<CompanionProjectSummary> {
  const res = await companionFetch(companionProjectsUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `create_failed_${res.status}`);
  }
  const payload = (await res.json()) as CompanionProjectSummary;
  return payload;
}

export async function importCompanionFolder(input: {
  name?: string;
  baseDir: string;
}): Promise<CompanionProjectSummary> {
  const res = await companionFetch(companionProjectsImportFolderUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `import_failed_${res.status}`);
  }
  return (await res.json()) as CompanionProjectSummary;
}

export async function ensureCompanionDefaultTaskProject(input: {
  moduleId: string;
  taskTitle?: string;
  taskId?: string;
}): Promise<CompanionProjectSummary> {
  const res = await companionFetch(companionProjectsEnsureDefaultTaskUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `ensure_default_failed_${res.status}`);
  }
  return (await res.json()) as CompanionProjectSummary;
}

export async function ensureCompanionProject(input: {
  projectId: string;
  workspaceKind: WorkspaceKind;
  name: string;
  baseDir?: string;
  bindingSource?: "user_picked" | "platform_default";
}): Promise<CompanionProjectSummary> {
  const res = await companionFetch(companionProjectsEnsureUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `ensure_failed_${res.status}`);
  }
  const payload = (await res.json()) as { project: CompanionProjectSummary };
  return payload.project;
}

export async function fetchCompanionProjectTree(
  projectId: string,
  relPath?: string,
): Promise<CompanionProjectTreeResponse> {
  const res = await companionFetch(companionProjectTreeUrl(projectId, relPath));
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `tree_failed_${res.status}`);
  }
  return (await res.json()) as CompanionProjectTreeResponse;
}

export async function fetchCompanionProjectTreeChildren(
  projectId: string,
  relPath: string,
): Promise<{ nodes: CompanionFileTreeNode[] }> {
  const res = await companionFetch(companionProjectTreeUrl(projectId, relPath));
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `tree_children_failed_${res.status}`);
  }
  const json = (await res.json()) as {
    nodes?: CompanionFileTreeNode[];
  };
  return { nodes: json.nodes ?? [] };
}

export async function fetchCompanionProjectFilesIndex(
  projectId: string,
  query?: string,
): Promise<{ files: string[] }> {
  const res = await companionFetch(
    companionProjectFilesIndexUrl(projectId, query),
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `files_index_failed_${res.status}`);
  }
  const json = (await res.json()) as { files?: string[] };
  return { files: json.files ?? [] };
}

export async function fetchCompanionProjectFile(
  projectId: string,
  relPath: string,
): Promise<{ content: string; mime?: string; encoding?: string }> {
  const res = await companionFetch(companionProjectFileUrl(projectId, relPath));
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `file_failed_${res.status}`);
  }
  return (await res.json()) as {
    content: string;
    mime?: string;
    encoding?: string;
  };
}

export async function writeCompanionProjectFile(input: {
  projectId: string;
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
}): Promise<{ projectId: string; path: string; mime?: string; size: number }> {
  const res = await companionFetch(companionProjectFilesUrl(input.projectId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: input.path,
      content: input.content,
      encoding: input.encoding ?? "utf8",
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(err.message ?? err.error ?? `file_write_failed_${res.status}`);
  }
  return (await res.json()) as {
    projectId: string;
    path: string;
    mime?: string;
    size: number;
  };
}

export async function createCompanionProjectEntry(input: {
  projectId: string;
  type: "file" | "folder";
  path: string;
  content?: string;
}): Promise<{
  projectId: string;
  type: "file" | "folder";
  path: string;
  mime?: string;
  size?: number;
}> {
  const res = await companionFetch(companionProjectEntriesUrl(input.projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: input.type,
      path: input.path,
      content: input.content ?? "",
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(err.message ?? err.error ?? `entry_create_failed_${res.status}`);
  }
  return (await res.json()) as {
    projectId: string;
    type: "file" | "folder";
    path: string;
    mime?: string;
    size?: number;
  };
}

export async function uploadCompanionProjectFile(input: {
  projectId: string;
  name: string;
  bytes: ArrayBuffer | Uint8Array;
}): Promise<{ projectId: string; path: string; size: number }> {
  const bytes =
    input.bytes instanceof ArrayBuffer
      ? new Uint8Array(input.bytes)
      : input.bytes;
  const contentBase64 = Buffer.from(bytes).toString("base64");
  const res = await companionFetch(companionProjectUploadUrl(input.projectId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      contentBase64,
    }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(err.message ?? err.error ?? `upload_failed_${res.status}`);
  }
  return (await res.json()) as {
    projectId: string;
    path: string;
    size: number;
  };
}

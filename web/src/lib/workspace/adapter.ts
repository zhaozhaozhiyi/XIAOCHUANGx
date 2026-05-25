import type { CompanionFileTreeNode } from "@/lib/companion/client";
import type { WorkspaceFileNode } from "@/lib/workspace";

function inferLanguage(
  relPath?: string,
): WorkspaceFileNode["language"] | undefined {
  if (!relPath) return undefined;
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".pptx")) return "pptx";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "text";
}

export function mapCompanionTreeNodes(
  nodes: CompanionFileTreeNode[],
): WorkspaceFileNode[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    relativePath: n.relativePath,
    language: n.type === "file" ? inferLanguage(n.relativePath) : undefined,
    children: n.children ? mapCompanionTreeNodes(n.children) : undefined,
  }));
}

/** 将 Companion `getProjectTree` 结果包装为 UI 根节点 */
export function buildWorkspaceRoot(
  tree: CompanionFileTreeNode[],
  label: string,
): WorkspaceFileNode {
  const mapped = mapCompanionTreeNodes(tree);
  const inner = mapped[0];
  const children =
    inner?.id === "." && inner.type === "folder"
      ? inner.children ?? []
      : mapped;

  return {
    id: "root",
    name: label,
    type: "folder",
    children,
  };
}

export type WorkspaceTreePayload = {
  projectId: string;
  diskRoot?: string;
  root: WorkspaceFileNode;
};

export async function fetchWorkspaceTree(
  workspaceProjectId: string,
): Promise<WorkspaceTreePayload> {
  const res = await fetch(
    `/api/projects/${encodeURIComponent(workspaceProjectId)}/tree`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as {
    projectId?: string;
    root?: string;
    tree?: CompanionFileTreeNode[];
    rootNode?: WorkspaceFileNode;
    label?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `tree_http_${res.status}`);
  }
  if (json.rootNode) {
    return {
      projectId: json.projectId ?? workspaceProjectId,
      diskRoot: json.root,
      root: json.rootNode,
    };
  }
  const label = json.label ?? workspaceProjectId;
  return {
    projectId: json.projectId ?? workspaceProjectId,
    diskRoot: json.root,
    root: buildWorkspaceRoot(json.tree ?? [], label),
  };
}

export async function fetchWorkspaceFolderChildren(
  workspaceProjectId: string,
  folderRelativePath: string,
): Promise<WorkspaceFileNode[]> {
  const q = new URLSearchParams({ path: folderRelativePath });
  const res = await fetch(
    `/api/projects/${encodeURIComponent(workspaceProjectId)}/tree?${q}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as {
    nodes?: CompanionFileTreeNode[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? `tree_children_http_${res.status}`);
  }
  return mapCompanionTreeNodes(json.nodes ?? []);
}

export async function fetchWorkspaceFileIndex(
  workspaceProjectId: string,
  query?: string,
): Promise<string[]> {
  const q = query?.trim() ? new URLSearchParams({ q: query.trim() }) : null;
  const suffix = q ? `?${q}` : "";
  const res = await fetch(
    `/api/projects/${encodeURIComponent(workspaceProjectId)}/files-index${suffix}`,
    { cache: "no-store" },
  );
  const json = (await res.json()) as { files?: string[]; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `files_index_http_${res.status}`);
  }
  return json.files ?? [];
}

export async function fetchWorkspaceFileContent(
  workspaceProjectId: string,
  relativePath: string,
): Promise<string> {
  const q = new URLSearchParams({
    projectId: workspaceProjectId,
    path: relativePath,
  });
  const res = await fetch(`/api/workspace/file?${q}`, { cache: "no-store" });
  const json = (await res.json()) as { content?: string; error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? `file_http_${res.status}`);
  }
  return json.content ?? "";
}

export type WorkspaceTab = "files" | "terminal" | "browser";

/** 中间对话区最小宽度（px） */
export const CHAT_MIN_WIDTH = 480;

export const SIDEBAR_WIDTH_EXPANDED = 240;
export const SIDEBAR_WIDTH_COLLAPSED = 56;
export const WORKSPACE_RESIZE_HANDLE_WIDTH = 4;

export const WORKSPACE_WIDTH_KEY = "jlcresearch-workspace-width";
export const WORKSPACE_WIDTH_DEFAULT = 380;
export const WORKSPACE_WIDTH_MIN = 280;

export function getSidebarWidth(collapsed: boolean): number {
  return collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
}

/** 工作区最大宽度 = 视口 − 侧栏 − 对话区最小宽度 − 拖拽条 */
export function getWorkspaceWidthMax(
  sidebarCollapsed: boolean,
  viewportWidth: number = typeof window !== "undefined" ? window.innerWidth : 1280,
): number {
  const sidebar = getSidebarWidth(sidebarCollapsed);
  return Math.max(
    WORKSPACE_WIDTH_MIN,
    viewportWidth -
      sidebar -
      CHAT_MIN_WIDTH -
      WORKSPACE_RESIZE_HANDLE_WIDTH,
  );
}

export const WORKSPACE_TREE_WIDTH_KEY = "jlcresearch-workspace-tree-width";
export const WORKSPACE_TREE_WIDTH_DEFAULT = 168;
export const WORKSPACE_TREE_WIDTH_MIN = 120;
export const WORKSPACE_TREE_WIDTH_MAX = 360;

export function clampWorkspaceTreeWidth(px: number, hostWidth?: number): number {
  const max = hostWidth
    ? Math.min(WORKSPACE_TREE_WIDTH_MAX, Math.floor(hostWidth * 0.55))
    : WORKSPACE_TREE_WIDTH_MAX;
  return Math.min(max, Math.max(WORKSPACE_TREE_WIDTH_MIN, px));
}

export function readStoredWorkspaceTreeWidth(): number {
  if (typeof window === "undefined") return WORKSPACE_TREE_WIDTH_DEFAULT;
  const raw = localStorage.getItem(WORKSPACE_TREE_WIDTH_KEY);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? clampWorkspaceTreeWidth(n) : WORKSPACE_TREE_WIDTH_DEFAULT;
}

export function clampWorkspaceWidth(
  px: number,
  sidebarCollapsed = false,
  viewportWidth?: number,
): number {
  const max = getWorkspaceWidthMax(sidebarCollapsed, viewportWidth);
  return Math.min(max, Math.max(WORKSPACE_WIDTH_MIN, px));
}

/** 无用户拖拽记录时，工作区默认占满可用宽度 */
export function getDefaultWorkspaceWidth(
  sidebarCollapsed = false,
  viewportWidth?: number,
): number {
  return getWorkspaceWidthMax(sidebarCollapsed, viewportWidth);
}

export function readStoredWorkspaceWidth(sidebarCollapsed = false): number {
  if (typeof window === "undefined") {
    return getDefaultWorkspaceWidth(sidebarCollapsed, 1280);
  }
  const raw = localStorage.getItem(WORKSPACE_WIDTH_KEY);
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  // 旧版默认 380px 视为未手动调整，展开时用最大宽度
  if (!Number.isFinite(n) || n === WORKSPACE_WIDTH_DEFAULT) {
    return getDefaultWorkspaceWidth(sidebarCollapsed);
  }
  return clampWorkspaceWidth(n, sidebarCollapsed);
}

export type WorkspaceFileNode = {
  id: string;
  name: string;
  type: "file" | "folder";
  /** 相对项目根目录路径，用于 API 读取 */
  relativePath?: string;
  language?:
    | "markdown"
    | "json"
    | "sql"
    | "typescript"
    | "javascript"
    | "yaml"
    | "shell"
    | "css"
    | "toml"
    | "text"
    | "pptx"
    | "html"
    | "python";
  content?: string;
  children?: WorkspaceFileNode[];
};

/** 原型仓库目录树（左树右预览） */
export const WORKSPACE_ROOT: WorkspaceFileNode = {
  id: "root",
  name: "原型",
  type: "folder",
  children: [
    { id: "dir-docs", name: "docs", type: "folder", children: [] },
    { id: "dir-hermes-agent", name: "hermes-agent", type: "folder", children: [] },
    { id: "dir-hermes-webui", name: "hermes-webui", type: "folder", children: [] },
    {
      id: "dir-web",
      name: "web",
      type: "folder",
      children: [
        {
          id: "web-hermes-doc",
          name: "hermes-client.md",
          type: "file",
          language: "markdown",
          relativePath: "web/docs/hermes-client.md",
        },
      ],
    },
    {
      id: "file-features",
      name: "功能清单.md",
      type: "file",
      language: "markdown",
      relativePath: "功能清单.md",
    },
    {
      id: "file-requirements",
      name: "需求整理.md",
      type: "file",
      language: "markdown",
      relativePath: "需求整理.md",
    },
    {
      id: "file-prd",
      name: "PRD-小窗.md",
      type: "file",
      language: "markdown",
      relativePath: "PRD-小窗.md",
    },
  ],
};

/** 定位文件时展开其所在目录路径 */
export function collectAncestorFolderIds(
  nodes: WorkspaceFileNode[],
  targetId: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return ancestors;
    if (node.children?.length) {
      const nextAncestors =
        node.type === "folder" ? [...ancestors, node.id] : ancestors;
      const found = collectAncestorFolderIds(
        node.children,
        targetId,
        nextAncestors,
      );
      if (found) return found;
    }
  }
  return null;
}

export function findWorkspaceFile(
  nodes: WorkspaceFileNode[],
  id: string,
): WorkspaceFileNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findWorkspaceFile(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** 路径过长时保留首尾，中间用 … */
export function truncatePathMiddle(path: string, maxChars = 36): string {
  if (path.length <= maxChars) return path;
  const keep = maxChars - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${path.slice(0, head)}…${path.slice(-tail)}`;
}

export function getWorkspaceFileDisplayPath(
  file: WorkspaceFileNode | null,
): string {
  if (!file || file.type !== "file") return "原型";
  return file.relativePath ?? file.name;
}

/** 收集目录树中所有文件夹 id，用于展开全部目录 */
export function collectWorkspaceFolderIds(
  nodes: WorkspaceFileNode[],
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      ids.push(node.id);
      if (node.children?.length) {
        ids.push(...collectWorkspaceFolderIds(node.children));
      }
    }
  }
  return ids;
}

export function flattenWorkspaceFiles(
  nodes: WorkspaceFileNode[],
): WorkspaceFileNode[] {
  const out: WorkspaceFileNode[] = [];
  for (const node of nodes) {
    if (node.type === "file") out.push(node);
    if (node.children) out.push(...flattenWorkspaceFiles(node.children));
  }
  return out;
}

/** 文件夹子项未加载时为 undefined；已加载空目录为 [] */
export function isWorkspaceFolderUnloaded(node: WorkspaceFileNode): boolean {
  return node.type === "folder" && node.children === undefined;
}

export function mergeWorkspaceFolderChildren(
  root: WorkspaceFileNode,
  folderId: string,
  children: WorkspaceFileNode[],
): WorkspaceFileNode {
  if (root.id === folderId) {
    return { ...root, children };
  }
  if (!root.children?.length) return root;

  let changed = false;
  const nextChildren = root.children.map((child) => {
    if (child.type !== "folder") return child;
    const merged = mergeWorkspaceFolderChildren(child, folderId, children);
    if (merged !== child) changed = true;
    return merged;
  });
  return changed ? { ...root, children: nextChildren } : root;
}

export function collectUnloadedFolderIds(
  nodes: WorkspaceFileNode[],
): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      if (node.children === undefined) ids.push(node.id);
      else if (node.children.length) {
        ids.push(...collectUnloadedFolderIds(node.children));
      }
    }
  }
  return ids;
}

/** 按路径深度排序，便于自浅向深 hydrate */
export function sortFolderIdsByDepth(ids: string[]): string[] {
  return [...ids].sort(
    (a, b) => a.split("/").length - b.split("/").length,
  );
}

export function workspaceFileFromRelativePath(
  relativePath: string,
): WorkspaceFileNode {
  const name = relativePath.split("/").pop() ?? relativePath;
  return {
    id: relativePath,
    name,
    type: "file",
    relativePath,
  };
}

export async function hydrateWorkspaceFolders(
  root: WorkspaceFileNode,
  folderIds: Iterable<string>,
  loadChildren: (folderRelativePath: string) => Promise<WorkspaceFileNode[]>,
): Promise<WorkspaceFileNode> {
  let next = root;
  const sorted = sortFolderIdsByDepth(
    [...folderIds].filter((id) => id !== "root" && id !== "."),
  );

  for (const folderId of sorted) {
    const folder = findWorkspaceFile(next.children ?? [], folderId);
    if (!folder || folder.type !== "folder") continue;
    if (!isWorkspaceFolderUnloaded(folder)) continue;
    const rel = folder.relativePath ?? folderId;
    const children = await loadChildren(rel);
    next = mergeWorkspaceFolderChildren(next, folderId, children);
  }
  return next;
}

export async function hydrateAllWorkspaceFolders(
  root: WorkspaceFileNode,
  loadChildren: (folderRelativePath: string) => Promise<WorkspaceFileNode[]>,
): Promise<WorkspaceFileNode> {
  let next = root;
  for (let pass = 0; pass < 64; pass += 1) {
    const pending = collectUnloadedFolderIds(next.children ?? []);
    if (!pending.length) break;
    next = await hydrateWorkspaceFolders(next, pending, loadChildren);
  }
  return next;
}

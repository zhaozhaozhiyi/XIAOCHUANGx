"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchWorkspaceFileIndex,
  fetchWorkspaceFolderChildren,
  fetchWorkspaceTree,
} from "@/lib/workspace/adapter";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import {
  WORKSPACE_ROOT,
  WORKSPACE_TREE_WIDTH_DEFAULT,
  clampWorkspaceTreeWidth,
  clampWorkspaceWidth,
  collectAncestorFolderIds,
  collectWorkspaceFolderIds,
  findWorkspaceFile,
  hydrateAllWorkspaceFolders,
  hydrateWorkspaceFolders,
  isWorkspaceFolderUnloaded,
  mergeWorkspaceFolderChildren,
  getDefaultWorkspaceWidth,
  getWorkspaceWidthMax,
  readStoredWorkspaceTreeWidth,
  readStoredWorkspaceWidth,
  type WorkspaceFileNode,
} from "@/lib/workspace";
import {
  createDefaultBrowserState,
  createTabId,
  findFileNodeInRoot,
  getBrowserTabLabel,
  getFileTabLabel,
  type BrowserTabState,
  type WorkspaceEditorTab,
} from "@/lib/workspace-tabs";
import {
  loadWorkspaceSessionCache,
  saveWorkspaceSessionCache,
} from "@/lib/workspace-session-cache";
import { loadSettings } from "@/lib/settings";
import {
  parseFileRef,
  resolveFileInTree,
  resolveFileMessage,
} from "@/lib/file-path-resolve";

export type FileViewMode = "preview" | "source";

type FileCacheEntry = {
  content: string | null;
  binaryBase64: string | null;
  loading: boolean;
  error: string | null;
};

type TerminalApi = {
  createSession: () => string;
  closeSession: (sessionId: string) => void;
  selectSession: (sessionId: string) => void;
  getSessionTitle: (sessionId: string) => string;
};

type WorkspaceContextValue = {
  sessionKey: string;
  setSessionKey: (key: string) => void;
  hasTabs: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  openTabs: WorkspaceEditorTab[];
  activeTabId: string;
  activeTab: WorkspaceEditorTab | null;
  setActiveTabId: (id: string) => void;
  openFileTab: (fileId: string) => void;
  openExplorerTab: () => void;
  openTerminalTab: (sessionId?: string) => void;
  openBrowserTab: (url?: string) => void;
  expandAllFolders: () => void;
  closeTab: (tabId: string) => void;
  registerTerminalApi: (api: TerminalApi | null) => void;
  expandedFolders: Set<string>;
  loadingFolders: Set<string>;
  toggleFolder: (id: string) => void;
  selectedFileId: string | null;
  selectedFile: WorkspaceFileNode | null;
  selectFile: (id: string | null) => void;
  root: WorkspaceFileNode;
  workspaceProjectId: string;
  treeLoading: boolean;
  treeError: string | null;
  refreshTree: () => void;
  panelWidth: number;
  setPanelWidth: (width: number) => void;
  resetPanelWidth: () => void;
  treePaneOpen: boolean;
  toggleTreePane: () => void;
  treePaneWidth: number;
  setTreePaneWidth: (width: number) => void;
  canFileNavBack: boolean;
  canFileNavForward: boolean;
  fileNavBack: () => void;
  fileNavForward: () => void;
  fileViewMode: FileViewMode;
  setFileViewMode: (mode: FileViewMode) => void;
  fileContent: string | null;
  fileBinaryBase64: string | null;
  fileLoading: boolean;
  fileError: string | null;
  getBrowserState: (tabId: string) => BrowserTabState;
  updateBrowserState: (tabId: string, patch: Partial<BrowserTabState>) => void;
  /** F-QA-010：从对话区打开项目内文件并可定位行号 */
  openFileAt: (input: {
    relativePath: string;
    line?: number;
    endLine?: number;
  }) => Promise<boolean>;
  pendingReveal: { fileId: string; line?: number; endLine?: number } | null;
  clearPendingReveal: () => void;
  fileActionMessage: string | null;
  clearFileActionMessage: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const DEFAULT_EXPANDED = new Set(["root"]);

type IndexedPathResolveResult =
  | { ok: true; path: string }
  | { ok: false; reason: "not_found" | "ambiguous" };

function normalizeLookupPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function basename(path: string): string {
  const normalized = normalizeLookupPath(path);
  return normalized.split("/").pop() ?? normalized;
}

function isAbsoluteLookupPath(path: string): boolean {
  const normalized = normalizeLookupPath(path);
  return normalized.startsWith("/") || /^[A-Za-z]:\//i.test(normalized);
}

function findWorkspaceFileByRelativePath(
  nodes: WorkspaceFileNode[],
  relativePath: string,
): WorkspaceFileNode | null {
  const target = normalizeLookupPath(relativePath);
  for (const node of nodes) {
    if (
      node.type === "file" &&
      normalizeLookupPath(node.relativePath ?? "") === target
    ) {
      return node;
    }
    if (node.children) {
      const found = findWorkspaceFileByRelativePath(node.children, target);
      if (found) return found;
    }
  }
  return null;
}

function resolveIndexedPath(
  paths: string[],
  rawPath: string,
): IndexedPathResolveResult {
  const normalized = normalizeLookupPath(rawPath);
  if (!normalized) return { ok: false, reason: "not_found" };

  const lower = normalized.toLowerCase();
  const indexed = paths.map((path) => ({
    path,
    lower: normalizeLookupPath(path).toLowerCase(),
  }));

  const exact = indexed.filter((item) => item.lower === lower);
  if (exact.length === 1) return { ok: true, path: exact[0]!.path };
  if (exact.length > 1) return { ok: false, reason: "ambiguous" };

  const absolute = isAbsoluteLookupPath(normalized);
  const suffix = indexed.filter((item) => {
    if (lower.endsWith(`/${item.lower}`)) return true;
    return !absolute && item.lower.endsWith(`/${lower}`);
  });
  if (suffix.length === 1) return { ok: true, path: suffix[0]!.path };
  if (suffix.length > 1) return { ok: false, reason: "ambiguous" };
  if (absolute) return { ok: false, reason: "not_found" };

  const fileName = basename(normalized).toLowerCase();
  const byName = indexed.filter(
    (item) => basename(item.path).toLowerCase() === fileName,
  );
  if (byName.length === 1) return { ok: true, path: byName[0]!.path };
  if (byName.length > 1) return { ok: false, reason: "ambiguous" };

  return { ok: false, reason: "not_found" };
}

async function hydrateParentFoldersForPath(
  root: WorkspaceFileNode,
  relativePath: string,
  loadChildren: (folderRelativePath: string) => Promise<WorkspaceFileNode[]>,
): Promise<WorkspaceFileNode> {
  const parts = normalizeLookupPath(relativePath).split("/").filter(Boolean);
  let next = root;
  let current = "";

  for (const segment of parts.slice(0, -1)) {
    current = current ? `${current}/${segment}` : segment;
    const folder = findWorkspaceFile(next.children ?? [], current);
    if (!folder || folder.type !== "folder") break;
    if (!isWorkspaceFolderUnloaded(folder)) continue;

    const children = await loadChildren(folder.relativePath ?? current);
    next = mergeWorkspaceFolderChildren(next, folder.id, children);
  }

  return next;
}

function emptyWorkspaceState() {
  return {
    openTabs: [] as WorkspaceEditorTab[],
    activeTabId: "",
    browserStates: {} as Record<string, BrowserTabState>,
    expandedFolders: new Set(DEFAULT_EXPANDED),
    selectedFileId: null as string | null,
    fileNavHistory: [null] as (string | null)[],
    fileNavIndex: 0,
  };
}

type WorkspaceProviderProps = {
  children: ReactNode;
  sidebarCollapsed?: boolean;
};

export function WorkspaceProvider({
  children,
  sidebarCollapsed = false,
}: WorkspaceProviderProps) {
  const { workspaceProjectId, projectLabel } = useWorkspaceProject();
  const [sessionKey, setSessionKey] = useState("_global");
  const [root, setRoot] = useState<WorkspaceFileNode>(WORKSPACE_ROOT);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const treeRequestRef = useRef(0);
  const openFileRequestRef = useRef(0);
  const [open, setOpen] = useState(() =>
    typeof window !== "undefined" ? loadSettings().workspaceOpenByDefault : false,
  );
  const [openTabs, setOpenTabs] = useState<WorkspaceEditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [browserStates, setBrowserStates] = useState<Record<string, BrowserTabState>>(
    {},
  );
  const terminalApiRef = useRef<TerminalApi | null>(null);
  const [expandedFolders, setExpandedFolders] =
    useState<Set<string>>(DEFAULT_EXPANDED);
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(
    () => new Set(),
  );
  const expandedFoldersRef = useRef(expandedFolders);
  expandedFoldersRef.current = expandedFolders;
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [panelWidth, setPanelWidthState] = useState(() =>
    readStoredWorkspaceWidth(sidebarCollapsed),
  );
  const [treePaneOpen, setTreePaneOpen] = useState(true);
  const [treePaneWidth, setTreePaneWidthState] = useState(
    readStoredWorkspaceTreeWidth,
  );
  const [fileNavHistory, setFileNavHistory] = useState<(string | null)[]>([null]);
  const [fileNavIndex, setFileNavIndex] = useState(0);
  const fileNavIndexRef = useRef(0);
  useEffect(() => {
    fileNavIndexRef.current = fileNavIndex;
  }, [fileNavIndex]);
  const [fileViewMode, setFileViewMode] = useState<FileViewMode>("preview");
  const [fileCache, setFileCache] = useState<Record<string, FileCacheEntry>>({});
  const fileCacheRef = useRef(fileCache);
  fileCacheRef.current = fileCache;

  const [pendingReveal, setPendingReveal] = useState<{
    fileId: string;
    line?: number;
    endLine?: number;
  } | null>(null);
  const [fileActionMessage, setFileActionMessage] = useState<string | null>(
    null,
  );

  const hasTabs = openTabs.length > 0;

  const activeTab = useMemo(
    () =>
      openTabs.find((t) => t.id === activeTabId) ??
      (openTabs[0] ?? null),
    [openTabs, activeTabId],
  );

  useEffect(() => {
    const snapshot = loadWorkspaceSessionCache(sessionKey);
    const empty = emptyWorkspaceState();
    if (snapshot?.openTabs?.length) {
      const tabs = snapshot.openTabs;
      const active =
        snapshot.activeTabId && tabs.some((t) => t.id === snapshot.activeTabId)
          ? snapshot.activeTabId
          : tabs[0]!.id;
      setOpenTabs(tabs);
      setActiveTabId(active);
      setBrowserStates(snapshot.browserStates ?? {});
      setExpandedFolders(
        new Set(snapshot.expandedFolders ?? [...DEFAULT_EXPANDED]),
      );
      setSelectedFileId(snapshot.selectedFileId ?? null);
      setFileNavHistory([snapshot.selectedFileId ?? null]);
      setFileNavIndex(0);
      fileNavIndexRef.current = 0;
    } else {
      setOpenTabs(empty.openTabs);
      setActiveTabId(empty.activeTabId);
      setBrowserStates(empty.browserStates);
      setExpandedFolders(empty.expandedFolders);
      setSelectedFileId(empty.selectedFileId);
      setFileNavHistory(empty.fileNavHistory);
      setFileNavIndex(empty.fileNavIndex);
      fileNavIndexRef.current = 0;
    }
  }, [sessionKey]);

  const persistSessionKeyRef = useRef(sessionKey);
  persistSessionKeyRef.current = sessionKey;

  useEffect(() => {
    const key = sessionKey;
    const timer = window.setTimeout(() => {
      if (persistSessionKeyRef.current !== key) return;
      saveWorkspaceSessionCache(key, {
        openTabs,
        activeTabId: activeTabId || null,
        browserStates,
        expandedFolders: [...expandedFolders],
        selectedFileId,
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    sessionKey,
    openTabs,
    activeTabId,
    browserStates,
    expandedFolders,
    selectedFileId,
  ]);

  const findFile = useCallback(
    (fileId: string) => findFileNodeInRoot(root, fileId),
    [root],
  );

  const loadFolderChildrenByPath = useCallback(
    async (relPath: string) =>
      fetchWorkspaceFolderChildren(workspaceProjectId, relPath),
    [workspaceProjectId],
  );

  const refreshTree = useCallback(() => {
    const reqId = ++treeRequestRef.current;
    setTreeLoading(true);
    setTreeError(null);
    void fetchWorkspaceTree(workspaceProjectId)
      .then(async (payload) => {
        if (treeRequestRef.current !== reqId) return;
        let nextRoot = payload.root;
        const expanded = expandedFoldersRef.current;
        if (expanded.size > 0) {
          nextRoot = await hydrateWorkspaceFolders(
            nextRoot,
            expanded,
            loadFolderChildrenByPath,
          );
        }
        setRoot(nextRoot);
        setTreeLoading(false);
        setFileCache({});
      })
      .catch((err) => {
        if (treeRequestRef.current !== reqId) return;
        setTreeError(err instanceof Error ? err.message : "加载目录失败");
        setTreeLoading(false);
        setRoot({
          id: "root",
          name: projectLabel,
          type: "folder",
          children: [],
        });
      });
  }, [workspaceProjectId, projectLabel, loadFolderChildrenByPath]);

  useEffect(() => {
    refreshTree();
    setFileCache({});
  }, [workspaceProjectId, refreshTree]);

  const selectedFile = useMemo(() => {
    if (!selectedFileId || !root.children) return null;
    return findWorkspaceFile(root.children, selectedFileId);
  }, [selectedFileId, root]);

  const fileContent = selectedFileId ? fileCache[selectedFileId]?.content ?? null : null;
  const fileBinaryBase64 = selectedFileId
    ? fileCache[selectedFileId]?.binaryBase64 ?? null
    : null;
  const fileLoading = selectedFileId ? fileCache[selectedFileId]?.loading ?? false : false;
  const fileError = selectedFileId ? fileCache[selectedFileId]?.error ?? null : null;

  const registerTerminalApi = useCallback((api: TerminalApi | null) => {
    terminalApiRef.current = api;
  }, []);

  const setPanelWidth = useCallback(
    (width: number) => {
      setPanelWidthState(
        clampWorkspaceWidth(width, sidebarCollapsed, window.innerWidth),
      );
    },
    [sidebarCollapsed],
  );

  useEffect(() => {
    const sync = () => {
      setPanelWidthState((w) =>
        clampWorkspaceWidth(w, sidebarCollapsed, window.innerWidth),
      );
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [sidebarCollapsed]);

  const resetPanelWidth = useCallback(() => {
    setPanelWidthState(
      getDefaultWorkspaceWidth(sidebarCollapsed, window.innerWidth),
    );
  }, [sidebarCollapsed]);

  const setTreePaneWidth = useCallback((width: number) => {
    setTreePaneWidthState(clampWorkspaceTreeWidth(width));
  }, []);

  const loadFileContent = useCallback(async (fileId: string, node: WorkspaceFileNode) => {
    const projectId = workspaceProjectId;
    if (node.type !== "file") return;

    if (node.content !== undefined) {
      setFileCache((prev) => ({
        ...prev,
        [fileId]: {
          content: node.content ?? "",
          binaryBase64: null,
          loading: false,
          error: null,
        },
      }));
      return;
    }

    if (!node.relativePath) {
      setFileCache((prev) => ({
        ...prev,
        [fileId]: { content: "", binaryBase64: null, loading: false, error: null },
      }));
      return;
    }

    const cached = fileCacheRef.current[fileId];
    if (
      cached &&
      !cached.loading &&
      (cached.content !== null || cached.binaryBase64 !== null)
    ) {
      return;
    }

    setFileCache((prev) => ({
      ...prev,
      [fileId]: {
        content: prev[fileId]?.content ?? null,
        binaryBase64: prev[fileId]?.binaryBase64 ?? null,
        loading: true,
        error: null,
      },
    }));

    try {
      const q = new URLSearchParams({
        projectId,
        path: node.relativePath,
      });
      const res = await fetch(`/api/workspace/file?${q}`, { cache: "no-store" });
      const json = (await res.json()) as {
        content?: string;
        encoding?: string;
        error?: string;
      };
      if (!res.ok) {
        setFileCache((prev) => ({
          ...prev,
          [fileId]: {
            content: null,
            binaryBase64: null,
            loading: false,
            error: json.error ?? "读取失败",
          },
        }));
        return;
      }
      if (json.encoding === "base64") {
        setFileCache((prev) => ({
          ...prev,
          [fileId]: {
            content: null,
            binaryBase64: json.content ?? "",
            loading: false,
            error: null,
          },
        }));
      } else {
        setFileCache((prev) => ({
          ...prev,
          [fileId]: {
            content: json.content ?? "",
            binaryBase64: null,
            loading: false,
            error: null,
          },
        }));
      }
    } catch (err) {
      setFileCache((prev) => ({
        ...prev,
        [fileId]: {
          content: null,
          binaryBase64: null,
          loading: false,
          error: err instanceof Error ? err.message : "读取失败",
        },
      }));
    }
  }, [workspaceProjectId]);

  const expandPanelToMax = useCallback(() => {
    setPanelWidthState(
      getWorkspaceWidthMax(sidebarCollapsed, window.innerWidth),
    );
  }, [sidebarCollapsed]);

  const toggleOpen = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) expandPanelToMax();
      return !wasOpen;
    });
  }, [expandPanelToMax]);

  const loadFolderChildren = useCallback(
    async (folderId: string) => {
      const folder = findFileNodeInRoot(root, folderId);
      if (!folder || folder.type !== "folder") return;
      if (!isWorkspaceFolderUnloaded(folder)) return;

      setLoadingFolders((prev) => new Set(prev).add(folderId));
      const relPath = folder.relativePath ?? folderId;
      try {
        const children = await fetchWorkspaceFolderChildren(
          workspaceProjectId,
          relPath,
        );
        setRoot((prev) =>
          mergeWorkspaceFolderChildren(prev, folderId, children),
        );
      } catch (err) {
        setTreeError(
          err instanceof Error ? err.message : "加载子目录失败",
        );
      } finally {
        setLoadingFolders((prev) => {
          const next = new Set(prev);
          next.delete(folderId);
          return next;
        });
      }
    },
    [root, workspaceProjectId],
  );

  const toggleFolder = useCallback(
    (id: string) => {
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        const willExpand = !next.has(id);
        if (willExpand) {
          next.add(id);
          const folder = findFileNodeInRoot(root, id);
          if (folder?.type === "folder" && isWorkspaceFolderUnloaded(folder)) {
            void loadFolderChildren(id);
          }
        } else {
          next.delete(id);
        }
        return next;
      });
    },
    [root, loadFolderChildren],
  );

  const revealFileInTree = useCallback(
    (fileId: string) => {
      const ancestors = collectAncestorFolderIds(
        root.children ?? [],
        fileId,
      );
      if (!ancestors?.length) return;
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        for (const id of ancestors) next.add(id);
        return next;
      });
      void hydrateWorkspaceFolders(
        root,
        ancestors,
        loadFolderChildrenByPath,
      ).then((nextRoot) => {
        setRoot(nextRoot);
      });
    },
    [root, loadFolderChildrenByPath],
  );

  const expandAllFolders = useCallback(() => {
    setTreeLoading(true);
    void hydrateAllWorkspaceFolders(root, loadFolderChildrenByPath)
      .then((nextRoot) => {
        setRoot(nextRoot);
        setExpandedFolders(
          new Set([
            "root",
            ".",
            ...collectWorkspaceFolderIds(nextRoot.children ?? []),
          ]),
        );
      })
      .catch((err) => {
        setTreeError(err instanceof Error ? err.message : "展开目录失败");
      })
      .finally(() => setTreeLoading(false));
  }, [root, loadFolderChildrenByPath]);

  const activateTab = useCallback(
    (id: string, tabs: WorkspaceEditorTab[]) => {
      setActiveTabId(id);
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;
      if (tab.kind === "file") {
        setSelectedFileId(tab.fileId);
        revealFileInTree(tab.fileId);
        const node = findFile(tab.fileId);
        if (node?.type === "file") void loadFileContent(tab.fileId, node);
      }
      if (tab.kind === "explorer") {
        setSelectedFileId(null);
        setExpandedFolders(
          new Set([
            "root",
            ".",
            ...collectWorkspaceFolderIds(root.children ?? []),
          ]),
        );
      }
      if (tab.kind === "terminal") {
        terminalApiRef.current?.selectSession(tab.sessionId);
      }
    },
    [findFile, loadFileContent, revealFileInTree, root],
  );

  const previewFile = useCallback(
    (fileId: string) => {
      setSelectedFileId(fileId);
      revealFileInTree(fileId);
      const node = findFile(fileId);
      if (node?.type === "file") void loadFileContent(fileId, node);
    },
    [findFile, loadFileContent, revealFileInTree],
  );

  const focusExplorerTab = useCallback(() => {
    const existing = openTabs.find((t) => t.kind === "explorer");
    if (existing) {
      activateTab(existing.id, openTabs);
      return;
    }
    const tab: WorkspaceEditorTab = {
      id: createTabId("tab-explorer"),
      kind: "explorer",
    };
    const next = [...openTabs, tab];
    setOpenTabs(next);
    activateTab(tab.id, next);
  }, [openTabs, activateTab]);

  const pushFileNavEntry = useCallback((entry: string | null) => {
    setFileNavHistory((prev) => {
      const idx = fileNavIndexRef.current;
      if (prev[idx] === entry) return prev;
      const next = [...prev.slice(0, idx + 1), entry];
      const newIdx = next.length - 1;
      fileNavIndexRef.current = newIdx;
      setFileNavIndex(newIdx);
      return next;
    });
  }, []);

  const applyFileLocation = useCallback(
    (entry: string | null) => {
      if (entry === null) {
        focusExplorerTab();
        return;
      }
      previewFile(entry);
    },
    [focusExplorerTab, previewFile],
  );

  const goToFileLocation = useCallback(
    (entry: string | null, recordHistory = true) => {
      applyFileLocation(entry);
      if (recordHistory) pushFileNavEntry(entry);
    },
    [applyFileLocation, pushFileNavEntry],
  );

  const openFileTab = useCallback(
    (fileId: string) => goToFileLocation(fileId, true),
    [goToFileLocation],
  );

  const openFileTabById = useCallback(
    (fileId: string, recordHistory = true) => {
      const existing = openTabs.find(
        (t) => t.kind === "file" && t.fileId === fileId,
      );
      if (existing) {
        activateTab(existing.id, openTabs);
        if (recordHistory) pushFileNavEntry(fileId);
        return;
      }
      const tab: WorkspaceEditorTab = {
        id: createTabId("tab-file"),
        kind: "file",
        fileId,
      };
      const next = [...openTabs, tab];
      setOpenTabs(next);
      activateTab(tab.id, next);
      if (recordHistory) pushFileNavEntry(fileId);
    },
    [openTabs, activateTab, pushFileNavEntry],
  );

  const clearPendingReveal = useCallback(() => setPendingReveal(null), []);
  const clearFileActionMessage = useCallback(
    () => setFileActionMessage(null),
    [],
  );

  const openResolvedFileAt = useCallback(
    (
      node: WorkspaceFileNode,
      input: {
        line?: number;
        endLine?: number;
      },
    ) => {
      setOpen(true);
      expandPanelToMax();
      if (input.line != null) setFileViewMode("source");

      setPendingReveal({
        fileId: node.id,
        line: input.line,
        endLine: input.endLine,
      });
      openFileTabById(node.id);
      setFileActionMessage(null);
      return true;
    },
    [expandPanelToMax, openFileTabById],
  );

  const openFileAt = useCallback(
    async (input: { relativePath: string; line?: number; endLine?: number }) => {
      const openReqId = ++openFileRequestRef.current;
      const parsed = parseFileRef(input.relativePath);
      const path = parsed.path || input.relativePath;
      const line = input.line ?? parsed.line;
      const endLine = input.endLine ?? parsed.endLine;

      const resolved = resolveFileInTree(root, path);
      if (resolved.ok) {
        if (openFileRequestRef.current !== openReqId) return false;
        return openResolvedFileAt(resolved.node, { line, endLine });
      }
      if (resolved.reason !== "not_found") {
        setFileActionMessage(resolveFileMessage(resolved.reason));
        return false;
      }

      setFileActionMessage("正在刷新目录…");
      const isStaleOpenRequest = () => {
        return openFileRequestRef.current !== openReqId;
      };
      try {
        let nextRoot = (await fetchWorkspaceTree(workspaceProjectId)).root;
        if (isStaleOpenRequest()) return false;

        const expanded = expandedFoldersRef.current;
        if (expanded.size > 0) {
          nextRoot = await hydrateWorkspaceFolders(
            nextRoot,
            expanded,
            loadFolderChildrenByPath,
          );
          if (isStaleOpenRequest()) return false;
        }
        setRoot(nextRoot);
        setTreeError(null);
        setFileCache({});

        let refreshed = resolveFileInTree(nextRoot, path);
        if (!refreshed.ok && refreshed.reason === "not_found") {
          const indexedPaths = await fetchWorkspaceFileIndex(workspaceProjectId);
          if (isStaleOpenRequest()) return false;

          const indexed = resolveIndexedPath(
            indexedPaths,
            path,
          );
          if (!indexed.ok) {
            setFileActionMessage(resolveFileMessage(indexed.reason));
            return false;
          }
          nextRoot = await hydrateParentFoldersForPath(
            nextRoot,
            indexed.path,
            loadFolderChildrenByPath,
          );
          if (isStaleOpenRequest()) return false;

          setRoot(nextRoot);
          const indexedNode = findWorkspaceFileByRelativePath(
            nextRoot.children ?? [],
            indexed.path,
          );
          refreshed = indexedNode
            ? { ok: true, node: indexedNode }
            : { ok: false, reason: "not_found" };
        }
        if (!refreshed.ok) {
          setFileActionMessage(resolveFileMessage(refreshed.reason));
          return false;
        }
        if (isStaleOpenRequest()) return false;
        return openResolvedFileAt(refreshed.node, { line, endLine });
      } catch (err) {
        if (isStaleOpenRequest()) return false;
        setFileActionMessage(
          err instanceof Error ? err.message : "刷新目录失败",
        );
        return false;
      }
    },
    [
      root,
      workspaceProjectId,
      loadFolderChildrenByPath,
      openResolvedFileAt,
    ],
  );

  const openExplorerTab = useCallback(
    () => goToFileLocation(null, true),
    [goToFileLocation],
  );

  const canFileNavBack = fileNavIndex > 0;
  const canFileNavForward = fileNavIndex < fileNavHistory.length - 1;

  const fileNavBack = useCallback(() => {
    if (fileNavIndex <= 0) return;
    const nextIdx = fileNavIndex - 1;
    const entry = fileNavHistory[nextIdx] ?? null;
    fileNavIndexRef.current = nextIdx;
    setFileNavIndex(nextIdx);
    applyFileLocation(entry);
  }, [fileNavIndex, fileNavHistory, applyFileLocation]);

  const fileNavForward = useCallback(() => {
    if (fileNavIndex >= fileNavHistory.length - 1) return;
    const nextIdx = fileNavIndex + 1;
    const entry = fileNavHistory[nextIdx] ?? null;
    fileNavIndexRef.current = nextIdx;
    setFileNavIndex(nextIdx);
    applyFileLocation(entry);
  }, [fileNavIndex, fileNavHistory, applyFileLocation]);

  const toggleTreePane = useCallback(() => {
    setTreePaneOpen((v) => !v);
  }, []);

  const openTerminalTab = useCallback(
    (sessionId?: string) => {
      const api = terminalApiRef.current;
      let sid = sessionId;
      if (!sid && api) sid = api.createSession();
      if (!sid) sid = createTabId("session");

      const existing = openTabs.find(
        (t) => t.kind === "terminal" && t.sessionId === sid,
      );
      if (existing) {
        activateTab(existing.id, openTabs);
        api?.selectSession(sid!);
        return;
      }
      const tab: WorkspaceEditorTab = {
        id: createTabId("tab-terminal"),
        kind: "terminal",
        sessionId: sid!,
      };
      const next = [...openTabs, tab];
      setOpenTabs(next);
      activateTab(tab.id, next);
      api?.selectSession(sid!);
    },
    [openTabs, activateTab],
  );

  const openBrowserTab = useCallback(
    (url?: string) => {
      const tabId = createTabId("tab-browser");
      const startUrl = url ?? "";
      setBrowserStates((prev) => ({
        ...prev,
        [tabId]: url
          ? createDefaultBrowserState(url)
          : { inputUrl: "", currentUrl: null, history: [], historyIndex: -1 },
      }));
      const tab: WorkspaceEditorTab = { id: tabId, kind: "browser", url: startUrl };
      const next = [...openTabs, tab];
      setOpenTabs(next);
      activateTab(tabId, next);
    },
    [openTabs, activateTab],
  );

  const setActiveTabIdWrapped = useCallback(
    (id: string) => activateTab(id, openTabs),
    [activateTab, openTabs],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setOpenTabs((prev) => {
        const target = prev.find((t) => t.id === tabId);
        if (!target) return prev;

        if (target.kind === "browser" && /^blob:/i.test(target.url)) {
          URL.revokeObjectURL(target.url);
        }

        if (target.kind === "terminal" && target.sessionId.startsWith("user")) {
          terminalApiRef.current?.closeSession(target.sessionId);
        }

        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          setActiveTabId("");
          return next;
        }
        if (activeTabId === tabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const fallback = next[Math.min(idx, next.length - 1)] ?? next[0];
          if (fallback) activateTab(fallback.id, next);
        }
        return next;
      });

      setBrowserStates((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    },
    [activeTabId, activateTab],
  );

  const selectFile = useCallback(
    (id: string | null) => {
      if (id) goToFileLocation(id, true);
      else setSelectedFileId(null);
    },
    [goToFileLocation],
  );

  const getBrowserState = useCallback(
    (tabId: string): BrowserTabState => {
      return (
        browserStates[tabId] ?? {
          inputUrl: "",
          currentUrl: null,
          history: [],
          historyIndex: -1,
        }
      );
    },
    [browserStates],
  );

  const updateBrowserState = useCallback(
    (tabId: string, patch: Partial<BrowserTabState>) => {
      setBrowserStates((prev) => {
        const current = prev[tabId] ?? {
          inputUrl: "",
          currentUrl: null,
          history: [],
          historyIndex: -1,
        };
        return { ...prev, [tabId]: { ...current, ...patch } };
      });
    },
    [],
  );

  useEffect(() => {
    if (activeTab?.kind === "file") {
      setSelectedFileId(activeTab.fileId);
      const node = findFile(activeTab.fileId);
      if (node?.type === "file") void loadFileContent(activeTab.fileId, node);
    }
  }, [activeTab, findFile, loadFileContent]);

  const value = useMemo(
    () => ({
      sessionKey,
      setSessionKey,
      hasTabs,
      open,
      setOpen,
      toggleOpen,
      openTabs,
      activeTabId,
      activeTab,
      setActiveTabId: setActiveTabIdWrapped,
      openFileTab,
      openExplorerTab,
      openTerminalTab,
      openBrowserTab,
      closeTab,
      expandAllFolders,
      registerTerminalApi,
      expandedFolders,
      loadingFolders,
      toggleFolder,
      selectedFileId,
      selectedFile,
      selectFile,
      root,
      workspaceProjectId,
      treeLoading,
      treeError,
      refreshTree,
      panelWidth,
      setPanelWidth,
      resetPanelWidth,
      treePaneOpen,
      toggleTreePane,
      treePaneWidth,
      setTreePaneWidth,
      canFileNavBack,
      canFileNavForward,
      fileNavBack,
      fileNavForward,
      fileViewMode,
      setFileViewMode,
      fileContent,
      fileBinaryBase64,
      fileLoading,
      fileError,
      getBrowserState,
      updateBrowserState,
      openFileAt,
      pendingReveal,
      clearPendingReveal,
      fileActionMessage,
      clearFileActionMessage,
    }),
    [
      sessionKey,
      hasTabs,
      open,
      openTabs,
      activeTabId,
      activeTab,
      expandedFolders,
      loadingFolders,
      selectedFileId,
      selectedFile,
      root,
      workspaceProjectId,
      treeLoading,
      treeError,
      refreshTree,
      panelWidth,
      treePaneWidth,
      fileViewMode,
      fileContent,
      fileBinaryBase64,
      fileLoading,
      fileError,
      browserStates,
      toggleOpen,
      toggleFolder,
      selectFile,
      setPanelWidth,
      resetPanelWidth,
      treePaneOpen,
      toggleTreePane,
      setTreePaneWidth,
      canFileNavBack,
      canFileNavForward,
      fileNavBack,
      fileNavForward,
      setActiveTabIdWrapped,
      openFileTab,
      openExplorerTab,
      openTerminalTab,
      openBrowserTab,
      closeTab,
      expandAllFolders,
      registerTerminalApi,
      getBrowserState,
      updateBrowserState,
      openFileAt,
      pendingReveal,
      clearPendingReveal,
      fileActionMessage,
      clearFileActionMessage,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}

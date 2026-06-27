import type { BrowserTabState } from "@/lib/workspace-tabs";
import type { WorkspaceEditorTab } from "@/lib/workspace-tabs";

export type WorkspaceSessionSnapshot = {
  openTabs: WorkspaceEditorTab[];
  activeTabId: string | null;
  browserStates?: Record<string, BrowserTabState>;
  expandedFolders?: string[];
  selectedFileId?: string | null;
  fileViewModesByFileId?: Record<string, string>;
};

const CACHE_PREFIX = "jlc-workspace-session-v1:";

export function getWorkspaceSessionKey(pathname: string): string {
  const match = pathname.match(/^\/chat\/([^/]+)$/);
  if (match && match[1] !== "history") return match[1];
  if (pathname === "/chat" || pathname === "/chat/history") return pathname;
  return pathname || "_global";
}

function cacheKey(sessionKey: string): string {
  return `${CACHE_PREFIX}${sessionKey}`;
}

export function loadWorkspaceSessionCache(
  sessionKey: string,
): WorkspaceSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(sessionKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspaceSessionSnapshot;
    if (!Array.isArray(parsed.openTabs)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveWorkspaceSessionCache(
  sessionKey: string,
  snapshot: WorkspaceSessionSnapshot,
): void {
  if (typeof window === "undefined") return;
  if (snapshot.openTabs.length === 0) {
    localStorage.removeItem(cacheKey(sessionKey));
    return;
  }
  try {
    localStorage.setItem(cacheKey(sessionKey), JSON.stringify(snapshot));
  } catch {
    /* quota */
  }
}

export function clearWorkspaceSessionCache(sessionKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(cacheKey(sessionKey));
}

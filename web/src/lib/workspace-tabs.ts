import type { WorkspaceFileNode } from "./workspace";
import { findWorkspaceFile } from "./workspace";

export type WorkspaceEditorTab =
  | { id: string; kind: "file"; fileId: string }
  | { id: string; kind: "explorer" }
  | { id: string; kind: "terminal"; sessionId: string }
  | { id: string; kind: "browser"; url: string };

/** @deprecated 资源管理器页签改用当前 `projectLabel`，勿再用于展示 */
export const EXPLORER_TAB_LABEL = "";

export type BrowserTabState = {
  inputUrl: string;
  currentUrl: string | null;
  history: string[];
  historyIndex: number;
};

let tabCounter = 0;

export function createTabId(prefix: string): string {
  tabCounter += 1;
  return `${prefix}-${Date.now()}-${tabCounter}`;
}

export function getFileTabLabel(file: WorkspaceFileNode | null): string {
  if (!file || file.type !== "file") return "未命名";
  return file.name;
}

export function getBrowserTabLabel(url: string): string {
  if (/^blob:/i.test(url)) return "HTML 预览";
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      const port = u.port || (u.protocol === "https:" ? "443" : "80");
      return `小窗 :${port}`;
    }
    return host.replace(/^www\./, "");
  } catch {
    return url.slice(0, 24);
  }
}

export function getTerminalTabLabel(title: string): string {
  if (title.toLowerCase().includes("zsh") || title === "zsh") return "zsh";
  const short = title.length > 28 ? `${title.slice(0, 12)}…${title.slice(-10)}` : title;
  return short;
}

/** 新建会话默认无页签；历史会话从 cache 恢复 */
export function createSeedEditorTabs(): WorkspaceEditorTab[] {
  return [];
}

export function createDefaultBrowserState(url: string): BrowserTabState {
  return {
    inputUrl: url,
    currentUrl: url,
    history: [url],
    historyIndex: 0,
  };
}

export function findFileNodeInRoot(
  root: WorkspaceFileNode,
  fileId: string,
): WorkspaceFileNode | null {
  return findWorkspaceFile(root.children ?? [], fileId);
}

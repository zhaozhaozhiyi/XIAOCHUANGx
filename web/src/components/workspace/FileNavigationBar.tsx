"use client";

import { ArrowLeft, ArrowRight, List } from "lucide-react";
import {
  getWorkspaceFileDisplayPath,
  truncatePathMiddle,
} from "@/lib/workspace";
import { useWorkspace } from "./WorkspaceContext";
import { useWorkspaceProject } from "./WorkspaceProjectContext";

export function FileNavigationBar() {
  const {
    selectedFile,
    activeTab,
    treePaneOpen,
    toggleTreePane,
    canFileNavBack,
    canFileNavForward,
    fileNavBack,
    fileNavForward,
  } = useWorkspace();
  const { projectLabel } = useWorkspaceProject();

  const isExplorer = activeTab?.kind === "explorer";
  const explorerLabel = (() => {
    const name = projectLabel.trim();
    return name === "原型" ? "" : name;
  })();
  const displayPath = isExplorer
    ? selectedFile?.type === "file"
      ? getWorkspaceFileDisplayPath(selectedFile)
      : explorerLabel
    : getWorkspaceFileDisplayPath(selectedFile);
  const pathShort = truncatePathMiddle(displayPath, 48);

  return (
    <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
      <button
        type="button"
        className="btn-icon"
        onClick={toggleTreePane}
        aria-label={treePaneOpen ? "收起目录" : "展开目录"}
        title={treePaneOpen ? "收起目录" : "展开目录"}
      >
        <List className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="btn-icon"
        onClick={fileNavBack}
        disabled={!canFileNavBack}
        aria-label="上一个文件"
        title="上一个"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="btn-icon"
        onClick={fileNavForward}
        disabled={!canFileNavForward}
        aria-label="下一个文件"
        title="下一个"
      >
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <span
        className="min-w-0 flex-1 truncate px-1 font-mono text-xs text-[var(--fg-secondary)]"
        title={displayPath}
      >
        {pathShort}
      </span>
    </div>
  );
}

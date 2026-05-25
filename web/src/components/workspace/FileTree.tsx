"use client";

import {
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
} from "lucide-react";
import type { WorkspaceFileNode } from "@/lib/workspace";
import { useWorkspace } from "./WorkspaceContext";

function promptNewName(label: string, placeholder: string): string | null {
  const name = window.prompt(label, placeholder);
  if (name === null) return null;
  const trimmed = name.trim();
  return trimmed || null;
}

function TreeNode({
  node,
  depth = 0,
}: {
  node: WorkspaceFileNode;
  depth?: number;
}) {
  const {
    expandedFolders,
    loadingFolders,
    toggleFolder,
    selectedFileId,
    openFileTab,
  } = useWorkspace();

  if (node.type === "folder") {
    const expanded = expandedFolders.has(node.id);
    const loading = loadingFolders.has(node.id);
    const children = node.children;
    const unloaded = children === undefined;
    const hasChildren = unloaded || (children?.length ?? 0) > 0;
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleFolder(node.id)}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-[var(--fg)] hover:bg-[var(--sidebar-hover)]"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)] transition-transform ${
              expanded ? "rotate-90" : ""
            } ${!hasChildren ? "opacity-30" : ""}`}
            strokeWidth={1.75}
          />
          <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]" strokeWidth={1.75} />
          <span className="truncate">{node.name}</span>
          {loading && (
            <span className="ml-auto shrink-0 text-[10px] text-[var(--fg-tertiary)]">
              …
            </span>
          )}
        </button>
        {expanded && (
          <div>
            {loading && !children?.length && (
              <p
                className="py-1 text-xs text-[var(--fg-tertiary)]"
                style={{ paddingLeft: `${20 + depth * 12}px` }}
              >
                加载中…
              </p>
            )}
            {children?.map((child) => (
              <TreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
            {!loading && children && children.length === 0 && (
              <p
                className="py-1 text-xs text-[var(--fg-tertiary)]"
                style={{ paddingLeft: `${20 + depth * 12}px` }}
              >
                空文件夹
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  const active = selectedFileId === node.id;
  return (
    <button
      type="button"
      onClick={() => openFileTab(node.id)}
      className={`relative flex w-full items-center gap-1.5 py-1 text-left text-sm ${
        active
          ? "bg-[var(--sidebar-hover)] font-medium text-[var(--fg)]"
          : "text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
      }`}
      style={{ paddingLeft: `${24 + depth * 12}px`, paddingRight: "8px" }}
    >
      {active && (
        <span
          className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--focus)]"
          aria-hidden
        />
      )}
      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree() {
  const { root, treeLoading, treeError, refreshTree } = useWorkspace();

  const handleNewFile = () => {
    const name = promptNewName("新建文件", "untitled.md");
    if (!name) return;
    // 原型阶段：后续接入工作区 API 创建文件
    console.info("[workspace] create file:", name);
  };

  const handleNewFolder = () => {
    const name = promptNewName("新建文件夹", "new-folder");
    if (!name) return;
    console.info("[workspace] create folder:", name);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2 py-1.5">
        <span
          className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--fg)]"
          title={root.name}
        >
          {root.name}
        </span>
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0"
          onClick={handleNewFile}
          aria-label="新建文件"
          title="新建文件"
        >
          <FileCode2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0"
          onClick={handleNewFolder}
          aria-label="新建文件夹"
          title="新建文件夹"
        >
          <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {treeLoading && (
          <p className="px-3 py-2 text-xs text-[var(--fg-tertiary)]">加载目录…</p>
        )}
        {treeError && !treeLoading && (
          <div className="px-3 py-2 text-xs text-[var(--danger)]">
            <p>{treeError}</p>
            <button
              type="button"
              className="mt-1 underline"
              onClick={() => refreshTree()}
            >
              重试
            </button>
          </div>
        )}
        {!treeLoading &&
          root.children?.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))}
      </div>
    </div>
  );
}

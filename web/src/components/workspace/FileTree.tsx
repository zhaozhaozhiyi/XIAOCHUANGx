"use client";

import {
  Check,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  FolderPlus,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { WorkspaceFileNode } from "@/lib/workspace";
import { workspaceErrorMessage } from "@/lib/workspace-errors";
import { useWorkspace } from "./WorkspaceContext";

type CreateDraft = { type: "file" | "folder"; value: string };

function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = normalized.lastIndexOf("/");
  return idx > 0 ? normalized.slice(0, idx) : "";
}

function joinWorkspacePath(base: string, name: string): string {
  const cleanName = name.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!base) return cleanName;
  return `${base.replace(/\/+$/, "")}/${cleanName}`.replace(/\/+/g, "/");
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
          className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--accent)]"
          aria-hidden
        />
      )}
      <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export function FileTree() {
  const {
    root,
    treeLoading,
    treeError,
    refreshTree,
    selectedFile,
    createWorkspaceFile,
    createWorkspaceFolder,
  } = useWorkspace();
  const [creatingEntry, setCreatingEntry] = useState<"file" | "folder" | null>(
    null,
  );
  const [createDraft, setCreateDraft] = useState<CreateDraft | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const treeErrorText = workspaceErrorMessage(treeError);
  const hasNodes = (root.children?.length ?? 0) > 0;
  const selectedBasePath =
    selectedFile?.type === "folder"
      ? (selectedFile.relativePath ?? selectedFile.id)
      : selectedFile?.relativePath
        ? dirname(selectedFile.relativePath)
        : "";

  useEffect(() => {
    if (!createDraft) return;
    const id = window.setTimeout(() => {
      createInputRef.current?.focus();
      createInputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [createDraft]);

  const submitCreateDraft = async () => {
    if (creatingEntry) return;
    const draft = createDraft;
    if (!draft) return;
    const name = draft.value.trim();
    if (!name) return;
    const type = draft.type;
    setCreatingEntry(type);
    try {
      const create =
        type === "file" ? createWorkspaceFile : createWorkspaceFolder;
      const ok = await create(joinWorkspacePath(selectedBasePath, name));
      if (!ok) {
        window.alert(
          type === "file"
            ? "创建文件失败，请确认当前工作区可写后重试。"
            : "创建文件夹失败，请确认当前工作区可写后重试。",
        );
        return;
      }
      setCreateDraft(null);
    } finally {
      setCreatingEntry(null);
    }
  };

  const handleNewFile = () => {
    if (creatingEntry) return;
    setCreateDraft({ type: "file", value: "untitled.md" });
  };

  const handleNewFolder = async () => {
    if (creatingEntry) return;
    setCreateDraft({ type: "folder", value: "new-folder" });
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
          disabled={creatingEntry !== null}
          aria-label="新建文件"
          title={creatingEntry === "file" ? "正在创建文件" : "新建文件"}
        >
          <FileCode2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0"
          onClick={handleNewFolder}
          disabled={creatingEntry !== null}
          aria-label="新建文件夹"
          title={creatingEntry === "folder" ? "正在创建文件夹" : "新建文件夹"}
        >
          <FolderPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      {createDraft ? (
        <form
          className="mx-1.5 mt-1 flex shrink-0 items-center gap-1 rounded-md bg-[var(--sidebar-hover)] px-1.5 py-1"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCreateDraft();
          }}
        >
          {createDraft.type === "file" ? (
            <FileCode2
              className="h-3.5 w-3.5 shrink-0 text-[var(--fg-secondary)]"
              strokeWidth={1.75}
            />
          ) : (
            <FolderPlus
              className="h-3.5 w-3.5 shrink-0 text-[var(--fg-secondary)]"
              strokeWidth={1.75}
            />
          )}
          <input
            ref={createInputRef}
            className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-tertiary)]"
            value={createDraft.value}
            disabled={creatingEntry !== null}
            aria-label={createDraft.type === "file" ? "新建文件名" : "新建文件夹名"}
            onChange={(event) =>
              setCreateDraft((draft) =>
                draft ? { ...draft, value: event.target.value } : draft,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setCreateDraft(null);
              }
            }}
          />
          <button
            type="submit"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--fg-secondary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--fg)] disabled:opacity-40"
            disabled={creatingEntry !== null || !createDraft.value.trim()}
            aria-label={creatingEntry ? "正在创建" : "确认创建"}
            title={creatingEntry ? "正在创建" : "确认创建"}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--fg-tertiary)] hover:bg-[var(--surface-elevated)] hover:text-[var(--fg)] disabled:opacity-40"
            disabled={creatingEntry !== null}
            aria-label="取消新建"
            title="取消"
            onClick={() => setCreateDraft(null)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </form>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {treeLoading && (
          <p className="px-3 py-2 text-xs text-[var(--fg-tertiary)]">加载目录…</p>
        )}
        {treeErrorText && !treeLoading && (
          <div className="px-3 py-2 text-xs text-[var(--danger)]">
            <p>{treeErrorText}</p>
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
          !treeErrorText &&
          !hasNodes && (
            <p className="px-3 py-2 text-xs leading-relaxed text-[var(--fg-tertiary)]">
              工作区尚未创建或暂无文件。发送第一条消息后，生成文件会显示在这里。
            </p>
          )}
        {!treeLoading &&
          hasNodes &&
          root.children?.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} />
          ))}
      </div>
    </div>
  );
}

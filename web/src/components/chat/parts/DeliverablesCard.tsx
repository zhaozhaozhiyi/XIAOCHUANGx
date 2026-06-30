"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import type { DeliverableItem, DeliverablesPart } from "@/lib/chat-parts";
import { deliverableTypeLabel } from "@/lib/deliverable-mime";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { ExternalLink, FileText, Folder, FolderOpen, ImageIcon, Presentation } from "lucide-react";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import { getSessionProjectId, NO_PROJECT_ID } from "@/lib/research-projects";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function RowIcon({
  path,
  mime,
  kind,
  className,
}: {
  path: string;
  mime?: string;
  kind?: DeliverableItem["kind"];
  className?: string;
}) {
  if (kind === "directory") {
    return <Folder className={className} aria-hidden />;
  }
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return <ImageIcon className={className} aria-hidden />;
  }
  if (ext === "pptx" || ext === "ppt" || mime?.includes("presentation")) {
    return <Presentation className={className} aria-hidden />;
  }
  return <FileText className={className} aria-hidden />;
}

function isMarkdownPath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

function DeliverableRow({
  item,
  primary,
  showDocxExport,
  projectId,
  workspaceProjectId,
}: {
  item: DeliverableItem;
  primary?: boolean;
  showDocxExport?: boolean;
  projectId: string;
  workspaceProjectId?: string;
}) {
  const { openFileAt } = useOpenFileAt();
  const workspace = useWorkspaceOptional();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const label = item.label ?? basename(item.path);
  const typeLabel =
    item.kind === "directory" ? "目录" : deliverableTypeLabel(item.path, item.mime);
  const canExportDocx = showDocxExport && isMarkdownPath(item.path);
  const itemWorkspaceProjectId = item.workspaceProjectId ?? workspaceProjectId;
  const canOpenInSystem =
    item.kind !== "directory" &&
    Boolean(workspace?.openFileInSystemForProject || workspace?.openFileInSystem);
  const canOpenPreview = Boolean(item.previewUrl);

  const continueWithFile = useCallback((filePath: string) => {
    window.dispatchEvent(
      new CustomEvent("jlc-compose-prefill", {
        detail: {
          text: `请基于工作区文件 @${filePath} 继续迭代：\n\n`,
          append: false,
          focus: true,
        },
      }),
    );
  }, []);

  const openDeliverable = useCallback(
    async (filePath: string) => {
      if (!workspace) {
        setActionMessage("工作区面板尚未就绪");
        return;
      }
      setOpening(true);
      setActionMessage(null);
      try {
        workspace.refreshTree();
        const opened = await openFileAt(filePath);
        if (!opened) {
          setActionMessage("未能在当前工作区定位该文件，请确认文件已写入当前会话工作区");
          return;
        }
        setActionMessage(null);
      } catch (err) {
        setActionMessage(err instanceof Error ? err.message : "打开文件失败");
      } finally {
        setOpening(false);
      }
    },
    [openFileAt, workspace],
  );

  const exportDocx = useCallback(async () => {
    if (!canExportDocx || projectId === NO_PROJECT_ID) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/writing/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: item.path,
          projectId,
          writeToWorkspace: true,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(json.message ?? json.error ?? `导出失败 (${res.status})`);
      }
      const json = (await res.json()) as {
        path?: string;
        message?: string;
      };
      if (!json.path) {
        throw new Error(json.message ?? "未返回生成文件路径");
      }
      setGeneratedPath(json.path);
      workspace?.refreshTree();
      void openFileAt(json.path);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "生成 DOCX 失败");
    } finally {
      setExporting(false);
    }
  }, [canExportDocx, item.path, openFileAt, projectId, workspace]);

  const openInSystem = useCallback(async () => {
    if (!workspace?.openFileInSystemForProject && !workspace?.openFileInSystem) {
      setActionMessage("当前环境不支持系统打开文件");
      return;
    }
    const targetProjectId = itemWorkspaceProjectId ?? workspace?.workspaceProjectId;
    if (!targetProjectId) {
      setActionMessage("未找到该交付物所属工作区");
      return;
    }
    setActionMessage(null);
    const result = workspace.openFileInSystemForProject
      ? await workspace.openFileInSystemForProject(targetProjectId, item.path)
      : { ok: await workspace.openFileInSystem(item.path) };
    setActionMessage(
      result.ok
        ? "已请求系统打开"
        : (result.message ?? "系统打开失败，请查看右侧工作区提示"),
    );
    if (result.ok) {
      window.setTimeout(() => setActionMessage(null), 1500);
    }
  }, [item.path, itemWorkspaceProjectId, workspace]);

  const showInFolder = useCallback(async (filePath: string) => {
    if (!workspace?.showFileInFolder) {
      setActionMessage("当前环境不支持在文件夹中显示");
      return;
    }
    setActionMessage(null);
    const ok = await workspace.showFileInFolder(filePath);
    setActionMessage(ok ? "已在系统文件夹中定位" : "定位失败，请查看右侧工作区提示");
    if (ok) {
      window.setTimeout(() => setActionMessage(null), 1500);
    }
  }, [workspace]);

  return (
    <div className="flex flex-col gap-1">
    <div
      className={`chat-deliverable-row flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-3 py-2.5 text-left text-sm shadow-[0_1px_0_rgba(0,0,0,0.02)] transition-colors hover:bg-[var(--sidebar-hover)] ${
        primary
          ? "border-[color-mix(in_srgb,var(--accent)_22%,var(--border))]"
          : ""
      }`}
      title={item.path}
    >
      <RowIcon
        path={item.path}
        mime={item.mime}
        kind={item.kind}
        className={`h-4 w-4 shrink-0 ${primary ? "text-[var(--accent)]" : "text-[var(--fg-tertiary)]"}`}
      />
      <button
        type="button"
        className="group min-w-0 flex-1 truncate text-left"
        disabled={opening}
        onClick={() => void openDeliverable(item.path)}
        title={opening ? "打开中…" : `打开 ${label}`}
      >
        <span
          className={`group-hover:underline ${
            primary
              ? "font-medium text-[var(--fg)]"
              : "text-[var(--fg-secondary)]"
          }`}
        >
          {label}
        </span>
        <span className="ml-2 text-xs text-[var(--fg-tertiary)]">
          {opening ? "打开中…" : typeLabel}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        {canOpenPreview ? (
          <a
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-muted)]"
            href={item.previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开预览
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
        {canExportDocx ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
            disabled={exporting}
            onClick={() => void exportDocx()}
          >
            {exporting ? "生成中…" : "生成 DOCX"}
          </button>
        ) : null}
        {canOpenInSystem ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
            onClick={() => void openInSystem()}
            aria-label={`系统打开 ${label}`}
          >
            系统打开
          </button>
        ) : null}
        {item.kind !== "directory" ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
            onClick={() => continueWithFile(item.path)}
            aria-label={`继续迭代 ${label}`}
          >
            继续迭代
          </button>
        ) : null}
        {workspace?.showFileInFolder ? (
          <button
            type="button"
            className="btn-icon h-7 w-7"
            onClick={() => void showInFolder(item.path)}
            aria-label={`在文件夹中显示 ${label}`}
            title="在文件夹中显示"
          >
            <FolderOpen className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
      {exportError ? (
        <p className="px-1 text-xs text-[var(--danger)]">{exportError}</p>
      ) : null}
      {actionMessage ? (
        <p className="px-1 text-xs text-[var(--danger)]">{actionMessage}</p>
      ) : null}
      {generatedPath ? (
        <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-[var(--fg-tertiary)]">
          <span>已生成 {generatedPath}</span>
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => void openDeliverable(generatedPath)}
          >
            打开
          </button>
          {workspace?.showFileInFolder ? (
            <button
              type="button"
              className="text-[var(--accent)] hover:underline"
              onClick={() => void showInFolder(generatedPath)}
            >
              定位
            </button>
          ) : null}
            {workspace?.openFileInSystem ? (
              <button
                type="button"
                className="text-[var(--accent)] hover:underline"
                onClick={() => {
                  const targetProjectId =
                    itemWorkspaceProjectId ?? workspace.workspaceProjectId;
                  if (workspace.openFileInSystemForProject) {
                    void workspace.openFileInSystemForProject(
                      targetProjectId,
                      generatedPath,
                    );
                    return;
                  }
                  void workspace.openFileInSystem(generatedPath);
                }}
              >
                系统打开
              </button>
          ) : null}
          <button
            type="button"
            className="text-[var(--accent)] hover:underline"
            onClick={() => continueWithFile(generatedPath)}
          >
            继续迭代
          </button>
        </div>
      ) : null}
      {item.recordingUrl || item.devCommand ? (
        <div className="grid gap-1 px-1 text-xs leading-relaxed text-[var(--fg-tertiary)]">
          {item.previewUrl ? (
            <div>
              预览入口：{item.previewUrl}
              <span className="ml-1">
                {item.devServerStatus === "running"
                  ? "（dev server 已启动）"
                  : "（dev server 运行后可打开）"}
              </span>
            </div>
          ) : null}
          {item.recordingUrl ? (
            <div>录屏入口：{item.recordingUrl}</div>
          ) : null}
          {item.devCommand ? (
            <div>若预览打不开，先在项目目录运行：{item.devCommand}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function DeliverablesCard({ part }: { part: DeliverablesPart }) {
  const pathname = usePathname();
  const showDocxExport = pathname.startsWith("/writing");
  const sessionId =
    pathname.match(/^\/writing\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/ppt\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/3d\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/video\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/chat\/([^/]+)$/)?.[1];
  const projectId = sessionId
    ? getSessionProjectId(sessionId)
    : NO_PROJECT_ID;
  const primaryPath =
    part.primaryPath ??
    part.items.find((i) => i.kind === "primary")?.path ??
    part.items[0]?.path;

  const primary =
    primaryPath != null
      ? part.items.find((i) => i.path === primaryPath)
      : undefined;
  const rest = part.items.filter((i) => i.path !== primaryPath);

  return (
    <div className="chat-deliverables flex flex-col gap-2 text-sm">
      {primary ? (
        <DeliverableRow
          item={primary}
          primary
          showDocxExport={showDocxExport}
          projectId={projectId}
          workspaceProjectId={part.workspaceProjectId}
        />
      ) : null}
      {rest.map((item) => (
        <DeliverableRow
          key={item.path}
          item={item}
          showDocxExport={showDocxExport}
          projectId={projectId}
          workspaceProjectId={part.workspaceProjectId}
        />
      ))}
    </div>
  );
}

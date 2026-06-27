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

function isPptDownloadablePath(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return ["pptx", "ppt", "html", "htm"].includes(ext);
}

function DeliverableRow({
  item,
  primary,
  showDocxExport,
  showPptDownload,
  projectId,
}: {
  item: DeliverableItem;
  primary?: boolean;
  showDocxExport?: boolean;
  showPptDownload?: boolean;
  projectId: string;
}) {
  const { openFileAt } = useOpenFileAt();
  const workspace = useWorkspaceOptional();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const label = item.label ?? basename(item.path);
  const typeLabel =
    item.kind === "directory" ? "目录" : deliverableTypeLabel(item.path, item.mime);
  const canExportDocx = showDocxExport && isMarkdownPath(item.path);
  const canDownloadPpt =
    showPptDownload && isPptDownloadablePath(item.path);
  const canOpenPreview = Boolean(item.previewUrl);

  const exportDocx = useCallback(async () => {
    if (!canExportDocx || projectId === NO_PROJECT_ID) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/writing/export-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: item.path, projectId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(json.message ?? json.error ?? `导出失败 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${basename(item.path).replace(/\.md$/i, "")}.docx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }, [canExportDocx, item.path, projectId]);

  const downloadPpt = useCallback(async () => {
    if (!canDownloadPpt || projectId === NO_PROJECT_ID) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch("/api/ppt/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: item.path, projectId }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(json.message ?? json.error ?? `下载失败 (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = basename(item.path);
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "下载失败");
    } finally {
      setExporting(false);
    }
  }, [canDownloadPpt, item.path, projectId]);

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
        className="min-w-0 flex-1 truncate text-left"
        onClick={() => openFileAt(item.path)}
      >
        <span
          className={
            primary
              ? "font-medium text-[var(--fg)]"
              : "text-[var(--fg-secondary)]"
          }
        >
          {label}
        </span>
        <span className="ml-2 text-xs text-[var(--fg-tertiary)]">
          {typeLabel}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--accent-muted)]"
          onClick={() => openFileAt(item.path)}
        >
          {item.kind === "directory" ? "打开目录" : "打开"}
        </button>
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
            {exporting ? "导出中…" : "导出 DOCX"}
          </button>
        ) : null}
        {canDownloadPpt ? (
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)] disabled:opacity-50"
            disabled={exporting}
            onClick={() => void downloadPpt()}
          >
            {exporting
              ? "下载中…"
              : item.path.toLowerCase().endsWith(".html") ||
                  item.path.toLowerCase().endsWith(".htm")
                ? "下载 HTML"
                : "下载 PPTX"}
          </button>
        ) : null}
        {workspace?.showFileInFolder ? (
          <button
            type="button"
            className="btn-icon h-7 w-7"
            onClick={() => void workspace.showFileInFolder(item.path)}
            aria-label="在文件夹中显示"
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
      {item.recordingUrl || item.devCommand ? (
        <div className="px-1 text-xs leading-relaxed text-[var(--fg-tertiary)]">
          {item.recordingUrl ? (
            <span>录屏入口：{item.recordingUrl}</span>
          ) : null}
          {item.recordingUrl && item.devCommand ? <span> · </span> : null}
          {item.devCommand ? <span>启动命令：{item.devCommand}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function DeliverablesCard({ part }: { part: DeliverablesPart }) {
  const pathname = usePathname();
  const showDocxExport = pathname.startsWith("/writing");
  const showPptDownload = pathname.startsWith("/ppt");
  const sessionId =
    pathname.match(/^\/writing\/([^/]+)$/)?.[1] ??
    pathname.match(/^\/ppt\/([^/]+)$/)?.[1] ??
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
          showPptDownload={showPptDownload}
          projectId={projectId}
        />
      ) : null}
      {rest.map((item) => (
        <DeliverableRow
          key={item.path}
          item={item}
          showDocxExport={showDocxExport}
          showPptDownload={showPptDownload}
          projectId={projectId}
        />
      ))}
    </div>
  );
}

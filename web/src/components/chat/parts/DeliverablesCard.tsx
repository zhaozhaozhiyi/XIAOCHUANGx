"use client";

import type { DeliverableItem, DeliverablesPart } from "@/lib/chat-parts";
import { deliverableTypeLabel } from "@/lib/deliverable-mime";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { FileText, FolderOpen, ImageIcon, Presentation } from "lucide-react";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function RowIcon({
  path,
  mime,
  className,
}: {
  path: string;
  mime?: string;
  className?: string;
}) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return <ImageIcon className={className} aria-hidden />;
  }
  if (ext === "pptx" || ext === "ppt" || mime?.includes("presentation")) {
    return <Presentation className={className} aria-hidden />;
  }
  return <FileText className={className} aria-hidden />;
}

function DeliverableRow({
  item,
  primary,
}: {
  item: DeliverableItem;
  primary?: boolean;
}) {
  const { openFileAt } = useOpenFileAt();
  const workspace = useWorkspaceOptional();
  const label = item.label ?? basename(item.path);
  const typeLabel = deliverableTypeLabel(item.path, item.mime);

  return (
    <div
      className={`flex w-full items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 text-left text-sm first:border-t-0 hover:bg-[var(--sidebar-hover)] ${
        primary ? "bg-[var(--accent-muted)]/30" : ""
      }`}
      title={item.path}
    >
      <RowIcon
        path={item.path}
        mime={item.mime}
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
          打开
        </button>
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
  );
}

export function DeliverablesCard({ part }: { part: DeliverablesPart }) {
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
    <div className="chat-deliverables rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-sm">
      <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--fg-secondary)]">
        成品 · 本轮交付
      </div>
      {part.headline ? (
        <p className="px-3 pt-2 text-sm text-[var(--fg)]">{part.headline}</p>
      ) : null}
      {primary ? (
        <DeliverableRow item={primary} primary />
      ) : null}
      {rest.map((item) => (
        <DeliverableRow key={item.path} item={item} />
      ))}
    </div>
  );
}

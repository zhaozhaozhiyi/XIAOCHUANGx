"use client";

import type { DeliverableItem, DeliverablesPart } from "@/lib/chat-parts";
import { deliverableTypeLabel } from "@/lib/deliverable-mime";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { FileText, Image, Presentation } from "lucide-react";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function rowIcon(path: string, mime?: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return Image;
  }
  if (ext === "pptx" || ext === "ppt" || mime?.includes("presentation")) {
    return Presentation;
  }
  return FileText;
}

function DeliverableRow({
  item,
  primary,
}: {
  item: DeliverableItem;
  primary?: boolean;
}) {
  const { openFileAt } = useOpenFileAt();
  const label = item.label ?? basename(item.path);
  const Icon = rowIcon(item.path, item.mime);
  const typeLabel = deliverableTypeLabel(item.path, item.mime);

  return (
    <button
      type="button"
      className={`flex w-full items-center gap-3 border-t border-[var(--border)] px-3 py-2.5 text-left text-sm first:border-t-0 hover:bg-[var(--sidebar-hover)] ${
        primary ? "bg-[var(--accent-muted)]/30" : ""
      }`}
      onClick={() => openFileAt(item.path)}
      title={item.path}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${primary ? "text-[var(--accent)]" : "text-[var(--fg-tertiary)]"}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
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
      </span>
      <span className="shrink-0 text-xs text-[var(--accent)]">打开</span>
    </button>
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

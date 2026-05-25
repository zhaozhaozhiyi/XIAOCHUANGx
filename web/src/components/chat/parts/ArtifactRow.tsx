"use client";

import type { ArtifactPart } from "@/lib/chat-parts";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { FileText } from "lucide-react";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function ArtifactRow({ part }: { part: ArtifactPart }) {
  const { openFileAt } = useOpenFileAt();
  const label = part.label ?? basename(part.path);

  return (
    <button
      type="button"
      className="chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      onClick={() => openFileAt(part.path)}
      title={part.path}
    >
      <FileText className="h-4 w-4 shrink-0 text-[var(--accent)]" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-[var(--fg)]">{label}</span>
        {part.mime && (
          <span className="ml-2 text-xs text-[var(--fg-tertiary)]">
            {part.mime}
          </span>
        )}
      </span>
      <span className="text-xs text-[var(--accent)]">打开</span>
    </button>
  );
}

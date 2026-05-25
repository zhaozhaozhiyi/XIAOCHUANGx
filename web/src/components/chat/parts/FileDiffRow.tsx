"use client";

import type {
  DocumentEditPart,
  DocumentReadPart,
  FileEditPart,
  FileReadPart,
} from "@/lib/chat-parts";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { FilePen, FileText } from "lucide-react";

function basename(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function FileReadRow({ part }: { part: FileReadPart }) {
  const { openFileAt } = useOpenFileAt();
  const lineHint =
    part.lineRange != null
      ? ` · L${part.lineRange.start}${
          part.lineRange.end !== part.lineRange.start
            ? `–${part.lineRange.end}`
            : ""
        }`
      : "";

  return (
    <button
      type="button"
      className="chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      onClick={() =>
        openFileAt({
          path: part.path,
          line: part.lineRange?.start,
          endLine: part.lineRange?.end,
        })
      }
      title={part.path}
    >
      <FileText className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" />
      <span className="truncate font-mono text-[var(--fg)]">
        {basename(part.path)}
        {lineHint && (
          <span className="font-sans text-xs text-[var(--fg-tertiary)]">
            {lineHint}
          </span>
        )}
      </span>
      <span className="ml-auto text-xs text-[var(--fg-tertiary)]">读取</span>
    </button>
  );
}

export function FileEditRow({ part }: { part: FileEditPart }) {
  const { openFileAt } = useOpenFileAt();
  const adds = part.additions ?? 0;
  const dels = part.deletions ?? 0;

  return (
    <button
      type="button"
      className="chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      onClick={() => openFileAt(part.path)}
      title={part.path}
    >
      <FilePen className="h-4 w-4 shrink-0 text-[var(--accent)]" />
      <span className="truncate font-mono text-[var(--fg)]">
        {basename(part.path)}
      </span>
      <span className="ml-auto shrink-0 font-mono text-xs">
        {adds > 0 && <span className="text-[var(--success)]">+{adds}</span>}
        {dels > 0 && (
          <span className="ml-1 text-[var(--danger)]">-{dels}</span>
        )}
      </span>
    </button>
  );
}

export function DocumentReadRow({ part }: { part: DocumentReadPart }) {
  const { openFileAt } = useOpenFileAt();

  return (
    <button
      type="button"
      className="chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      onClick={() => openFileAt(part.path)}
      title={part.path}
    >
      <FileText className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" />
      <span className="truncate font-mono text-[var(--fg)]">{basename(part.path)}</span>
      <span className="ml-auto text-xs text-[var(--fg-tertiary)]">
        读取 {part.docType}
      </span>
    </button>
  );
}

export function DocumentEditRow({ part }: { part: DocumentEditPart }) {
  const { openFileAt } = useOpenFileAt();
  const adds = part.additions ?? 0;
  const dels = part.deletions ?? 0;

  return (
    <button
      type="button"
      className="chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      onClick={() => openFileAt(part.path)}
      title={part.path}
    >
      <FilePen className="h-4 w-4 shrink-0 text-[var(--accent)]" />
      <span className="truncate font-mono text-[var(--fg)]">{basename(part.path)}</span>
      <span className="ml-auto shrink-0 text-xs text-[var(--fg-tertiary)]">
        编辑 {part.docType}
        {adds > 0 || dels > 0 ? ` · +${adds}/-${dels}` : ""}
      </span>
    </button>
  );
}

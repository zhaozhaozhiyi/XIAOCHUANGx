"use client";

import type { PartPresentation } from "@/components/chat/parts/PartRenderer";
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

export function FileReadRow({
  part,
  presentation = "default",
}: {
  part: FileReadPart;
  presentation?: PartPresentation;
}) {
  const { openFileAt } = useOpenFileAt();
  const lineHint =
    part.lineRange != null
      ? ` · L${part.lineRange.start}${
          part.lineRange.end !== part.lineRange.start
            ? `–${part.lineRange.end}`
            : ""
        }`
      : "";
  const timelineClass =
    "chat-timeline-file flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]";

  return (
    <button
      type="button"
      className={
        presentation === "timeline"
          ? timelineClass
          : "chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      }
      onClick={() =>
        openFileAt({
          path: part.path,
          line: part.lineRange?.start,
          endLine: part.lineRange?.end,
        })
      }
      title={part.path}
      aria-label={`读取 ${basename(part.path)}`}
    >
      {presentation === "default" ? (
        <FileText className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" />
      ) : null}
      <span className="truncate font-mono text-[13px]">
        {basename(part.path)}
        {lineHint && (
          <span className="font-sans text-xs text-[var(--fg-tertiary)]">
            {lineHint}
          </span>
        )}
      </span>
      {presentation === "default" ? (
        <span className="ml-auto text-xs text-[var(--fg-tertiary)]">读取</span>
      ) : null}
    </button>
  );
}

export function FileEditRow({
  part,
  presentation = "default",
}: {
  part: FileEditPart;
  presentation?: PartPresentation;
}) {
  const { openFileAt } = useOpenFileAt();
  const adds = part.additions ?? 0;
  const dels = part.deletions ?? 0;

  return (
    <button
      type="button"
      className={
        presentation === "timeline"
          ? "chat-timeline-file flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]"
          : "chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      }
      onClick={() => openFileAt(part.path)}
      title={part.path}
      aria-label={`编辑 ${basename(part.path)}`}
    >
      {presentation === "default" ? (
        <FilePen className="h-4 w-4 shrink-0 text-[var(--accent)]" />
      ) : null}
      <span className="truncate font-mono text-[13px]">{basename(part.path)}</span>
      {(adds > 0 || dels > 0) && (
        <span className="ml-auto shrink-0 font-mono text-xs">
          {adds > 0 && <span className="text-[var(--success)]">+{adds}</span>}
          {dels > 0 && (
            <span className="ml-1 text-[var(--danger)]">-{dels}</span>
          )}
        </span>
      )}
    </button>
  );
}

export function DocumentReadRow({
  part,
  presentation = "default",
}: {
  part: DocumentReadPart;
  presentation?: PartPresentation;
}) {
  const { openFileAt } = useOpenFileAt();

  return (
    <button
      type="button"
      className={
        presentation === "timeline"
          ? "chat-timeline-file flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]"
          : "chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      }
      onClick={() => openFileAt(part.path)}
      title={part.path}
      aria-label={`读取 ${basename(part.path)}`}
    >
      {presentation === "default" ? (
        <FileText className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" />
      ) : null}
      <span className="truncate font-mono text-[13px]">{basename(part.path)}</span>
      {presentation === "default" ? (
        <span className="ml-auto text-xs text-[var(--fg-tertiary)]">
          读取 {part.docType}
        </span>
      ) : null}
    </button>
  );
}

export function DocumentEditRow({
  part,
  presentation = "default",
}: {
  part: DocumentEditPart;
  presentation?: PartPresentation;
}) {
  const { openFileAt } = useOpenFileAt();
  const adds = part.additions ?? 0;
  const dels = part.deletions ?? 0;

  return (
    <button
      type="button"
      className={
        presentation === "timeline"
          ? "chat-timeline-file flex w-full min-w-0 items-center gap-2 py-0.5 text-left text-sm text-[var(--fg-secondary)] hover:text-[var(--fg)]"
          : "chat-file-row flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
      }
      onClick={() => openFileAt(part.path)}
      title={part.path}
      aria-label={`编辑 ${basename(part.path)}`}
    >
      {presentation === "default" ? (
        <FilePen className="h-4 w-4 shrink-0 text-[var(--accent)]" />
      ) : null}
      <span className="truncate font-mono text-[13px]">{basename(part.path)}</span>
      {presentation === "default" ? (
        <span className="ml-auto shrink-0 text-xs text-[var(--fg-tertiary)]">
          编辑 {part.docType}
          {adds > 0 || dels > 0 ? ` · +${adds}/-${dels}` : ""}
        </span>
      ) : (
        (adds > 0 || dels > 0) && (
          <span className="ml-auto shrink-0 font-mono text-xs">
            {adds > 0 && <span className="text-[var(--success)]">+{adds}</span>}
            {dels > 0 && (
              <span className="ml-1 text-[var(--danger)]">-{dels}</span>
            )}
          </span>
        )
      )}
    </button>
  );
}

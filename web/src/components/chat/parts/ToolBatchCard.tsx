"use client";

import type { PartPresentation } from "@/components/chat/parts/PartRenderer";
import type { ToolBatchPart } from "@/lib/chat-parts";
import { toolStatusTextClass } from "@/lib/activity-status-tone";
import { toolDisplayName } from "@/lib/tool-family";
import { ChevronDown, ChevronRight, FolderSearch } from "lucide-react";
import { useState } from "react";

export function ToolBatchCard({
  part,
  presentation = "default",
}: {
  part: ToolBatchPart;
  presentation?: PartPresentation;
}) {
  const [open, setOpen] = useState(!!part.streaming);
  const displayOpen = part.streaming || open;

  if (presentation === "timeline") {
    return (
      <div className="chat-timeline-tool-batch min-w-0 text-sm">
        <button
          type="button"
          className={`w-full text-left ${part.streaming ? "cursor-default" : "cursor-pointer"}`}
          onClick={() => {
            if (part.streaming) return;
            setOpen((v) => !v);
          }}
          aria-expanded={displayOpen}
          aria-label={part.title}
        >
          <p className="text-[13px] leading-relaxed text-[var(--fg-secondary)]">
            {part.title}
          </p>
        </button>
        {displayOpen ? (
          <ul className="mt-2 space-y-1 text-xs text-[var(--fg-secondary)]">
            {part.items.map((item, i) => (
              <li key={`${item.tool}-${i}`} className="flex items-start gap-2 py-0.5">
                <span className="shrink-0 font-mono text-[var(--fg-tertiary)]">
                  {toolDisplayName(item.tool)}
                </span>
                {item.message ? (
                  <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                    {item.message}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="chat-tool-batch rounded-[var(--radius-md)] border border-[var(--border)]/80 bg-[var(--surface)]/80 text-sm">
      <button
        type="button"
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] ${part.streaming ? "cursor-default" : ""}`}
        onClick={() => {
          if (part.streaming) return;
          setOpen((v) => !v);
        }}
        aria-expanded={displayOpen}
      >
        {displayOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <FolderSearch className="h-4 w-4 shrink-0 text-[var(--fg-tertiary)]" aria-hidden />
        <span className="min-w-0 flex-1 break-words text-sm font-medium text-[var(--fg-secondary)]">
          {part.title}
        </span>
        {part.streaming && (
          <span className="text-xs text-[var(--accent)]">进行中</span>
        )}
      </button>
      {displayOpen && (
        <ul className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--fg-secondary)]">
          {part.items.map((item, i) => (
            <li key={`${item.tool}-${i}`} className="flex items-start gap-2 py-1">
              <span className="shrink-0 font-medium text-[var(--fg-tertiary)]">
                {toolDisplayName(item.tool)}
              </span>
              {item.message && (
                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[var(--fg-tertiary)]">
                  {item.message}
                </span>
              )}
              {item.status && (
                <span
                  className={`ml-auto shrink-0 text-xs ${toolStatusTextClass(item.status)}`}
                >
                  {item.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

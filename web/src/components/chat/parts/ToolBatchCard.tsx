"use client";

import type { ToolBatchPart } from "@/lib/chat-parts";
import { toolStatusTextClass } from "@/lib/activity-status-tone";
import { ChevronDown, ChevronRight, FolderSearch } from "lucide-react";
import { useState } from "react";

export function ToolBatchCard({ part }: { part: ToolBatchPart }) {
  const [open, setOpen] = useState(!!part.streaming);
  const displayOpen = part.streaming || open;

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
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--fg-secondary)]">
          {part.title}
        </span>
        {part.streaming && (
          <span className="text-xs text-[var(--accent)]">进行中</span>
        )}
      </button>
      {displayOpen && (
        <ul className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--fg-secondary)]">
          {part.items.map((item, i) => (
            <li key={`${item.tool}-${i}`} className="flex gap-2 py-1">
              <span className="font-medium text-[var(--fg-tertiary)]">
                {item.tool}
              </span>
              {item.message && (
                <span className="truncate text-[var(--fg-tertiary)]">
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

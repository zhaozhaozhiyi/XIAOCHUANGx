"use client";

import type { TurnMetaPart } from "@/lib/chat-parts";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import { formatDurationMs } from "@/lib/chat-parts-normalize";

export function TurnMetaBar({ part }: { part: TurnMetaPart }) {
  const [open, setOpen] = useState(false);
  const label =
    part.label ??
    (part.runStatus === "complete"
      ? "已完成"
      : part.runStatus === "waiting_user"
        ? "等待你继续"
        : "处理中…");
  const statusLabel =
    part.runStatus === "waiting_user"
      ? "待你处理"
      : part.runStatus === "cancelled"
        ? "已中断"
        : part.runStatus === "complete"
          ? "已完成"
          : "进行中";
  const statusClass =
    part.runStatus === "waiting_user"
      ? "text-[var(--warn)]"
      : part.runStatus === "cancelled"
        ? "text-[var(--warn)]"
        : part.runStatus === "complete"
          ? "text-[var(--fg-secondary)]"
          : "text-[var(--accent)]";

  return (
    <div className="chat-turn-meta text-xs text-[var(--fg-tertiary)]">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-[var(--sidebar-hover)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <Clock className="h-3 w-3" aria-hidden />
        <span>{label}</span>
        {part.runStatus && <span className={statusClass}>· {statusLabel}</span>}
      </button>
      {open && part.durationMs !== undefined && (
        <p className="mt-1 pl-5 text-[11px]">用时 {formatDurationMs(part.durationMs)}</p>
      )}
    </div>
  );
}

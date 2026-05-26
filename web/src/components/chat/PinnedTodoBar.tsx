"use client";

import type { TodoPart } from "@/lib/chat-parts";
import { TodoBlock } from "@/components/chat/parts/TodoBlock";
import { X } from "lucide-react";

type Props = {
  part: TodoPart;
  onDismiss?: () => void;
};

/** Composer 上方钉住的任务列表（逻辑对齐 Open Design PinnedTodoSlot，样式沿用 JLC） */
export function PinnedTodoBar({ part, onDismiss }: Props) {
  const allDone = part.items.every(
    (i) => i.status === "completed" || i.status === "cancelled",
  );
  const hasActive = part.items.some(
    (i) => i.status === "in_progress" || i.status === "pending",
  );

  if (allDone) {
    return (
      <div
        className="chat-pinned-todo chat-pinned-todo--done mb-2"
        role="region"
        aria-label="当前任务"
      >
        <span className="text-xs font-medium text-[var(--fg-secondary)]">
          当前任务已完成 · {part.items.length}/{part.items.length}
        </span>
        {onDismiss ? (
          <button
            type="button"
            className="rounded p-0.5 text-[var(--fg-tertiary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
            onClick={onDismiss}
            aria-label="收起任务列表"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="chat-pinned-todo mb-2" role="region" aria-label="当前任务">
      <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
        <span className="text-xs font-medium text-[var(--fg-secondary)]">
          当前任务
          {hasActive ? (
            <span className="ml-1.5 text-[var(--accent)]">进行中</span>
          ) : null}
        </span>
      </div>
      <TodoBlock part={part} />
    </div>
  );
}

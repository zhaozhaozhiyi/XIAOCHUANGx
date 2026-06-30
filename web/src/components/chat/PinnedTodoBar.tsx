"use client";

import type { TodoPart } from "@/lib/chat-parts";
import { TodoBlock } from "@/components/chat/parts/TodoBlock";
import { X } from "lucide-react";

type Props = {
  part: TodoPart;
  onDismiss?: () => void;
};

function statusLabel(status: TodoPart["items"][0]["status"]): string {
  if (status === "in_progress") return "执行中";
  if (status === "completed") return "完成";
  if (status === "cancelled") return "已取消";
  return "待执行";
}

function currentTask(part: TodoPart): TodoPart["items"][0] | undefined {
  return (
    part.items.find((i) => i.status === "in_progress") ??
    part.items.find((i) => i.status === "pending") ??
    [...part.items].reverse().find((i) => i.status === "completed") ??
    part.items[part.items.length - 1]
  );
}

/** Composer 上方钉住的任务列表（逻辑对齐 Open Design PinnedTodoSlot，样式沿用 JLC） */
export function PinnedTodoBar({ part, onDismiss }: Props) {
  const allDone = part.items.every(
    (i) => i.status === "completed" || i.status === "cancelled",
  );
  const activeTask = currentTask(part);
  const completedCount = part.items.filter(
    (i) => i.status === "completed" || i.status === "cancelled",
  ).length;

  if (allDone) {
    return (
      <div
        className="chat-pinned-todo chat-pinned-todo--done mb-2"
        role="region"
        aria-label="当前任务"
      >
        <span className="min-w-0 text-xs font-medium text-[var(--fg-secondary)]">
          <span>当前任务完成</span>
          {activeTask ? (
            <>
              <span className="mx-1 text-[var(--fg-tertiary)]">·</span>
              <span className="text-[var(--fg)]">{activeTask.content}</span>
            </>
          ) : null}
          <span className="ml-1.5 text-[var(--fg-tertiary)]">
            {completedCount}/{part.items.length}
          </span>
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
        <span className="min-w-0 text-xs font-medium text-[var(--fg-secondary)]">
          当前任务
          {activeTask ? (
            <>
              <span className="mx-1 text-[var(--fg-tertiary)]">·</span>
              <span className="text-[var(--fg)]">{activeTask.content}</span>
              <span className="ml-1.5 text-[var(--accent)]">
                {statusLabel(activeTask.status)}
              </span>
              <span className="ml-1.5 text-[var(--fg-tertiary)]">
                {completedCount}/{part.items.length}
              </span>
            </>
          ) : null}
        </span>
      </div>
      <TodoBlock part={part} />
    </div>
  );
}

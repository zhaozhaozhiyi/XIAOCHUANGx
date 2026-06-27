"use client";

import type { TodoPart } from "@/lib/chat-parts";
import { Check, Circle, Loader2 } from "lucide-react";

function TodoIcon({ status }: { status: TodoPart["items"][0]["status"] }) {
  if (status === "completed") {
    return <Check className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />;
  }
  if (status === "in_progress") {
    return (
      <Loader2
        className="h-3.5 w-3.5 animate-spin text-[var(--accent)]"
        aria-hidden
      />
    );
  }
  return <Circle className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" aria-hidden />;
}

export function TodoBlock({ part }: { part: TodoPart }) {
  const done = part.items.filter((i) => i.status === "completed").length;
  return (
    <div className="chat-todo-block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      <p className="mb-2 text-xs font-medium text-[var(--fg-secondary)]">
        任务 {done}/{part.items.length}
      </p>
      <ul className="space-y-1.5">
        {part.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <TodoIcon status={item.status} />
            <span
              className={
                item.status === "completed"
                  ? "text-[var(--fg-tertiary)] line-through"
                  : "text-[var(--fg)]"
              }
            >
              {item.content}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

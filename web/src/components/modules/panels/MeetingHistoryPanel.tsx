"use client";

import { Download, MoreHorizontal } from "lucide-react";
import { MOCK_MEETING_HISTORY } from "@/lib/module-mock-data";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  done: { text: "已完成", className: "bg-emerald-50 text-emerald-800" },
  processing: { text: "转写中", className: "bg-amber-50 text-amber-800" },
  failed: { text: "失败", className: "bg-red-50 text-red-800" },
};

export function MeetingHistoryPanel() {
  return (
    <div className="mx-auto max-w-4xl">
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
        {MOCK_MEETING_HISTORY.map((item) => {
          const status = STATUS_LABEL[item.status];
          return (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 hover:bg-[var(--sidebar-hover)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fg)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
                  {item.duration} · {item.speakers} 位发言人 · {item.updatedAt}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${status.className}`}
                >
                  {status.text}
                </span>
                {item.status === "done" && (
                  <button
                    type="button"
                    className="btn-icon"
                    title="导出纪要"
                    aria-label="导出纪要"
                  >
                    <Download className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
                <button type="button" className="btn-icon" aria-label="更多操作">
                  <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

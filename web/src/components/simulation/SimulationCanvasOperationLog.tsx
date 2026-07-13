"use client";

import { Clock3, X } from "lucide-react";
import type { CanvasOperationLogEntry } from "@/components/simulation/canvas/canvasTypes";

type SimulationCanvasOperationLogProps = {
  entries: CanvasOperationLogEntry[];
  onClose: () => void;
};

function timeLabel(createdAt: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(createdAt);
}

export function SimulationCanvasOperationLog({
  entries,
  onClose,
}: SimulationCanvasOperationLogProps) {
  return (
    <section
      data-simulation-operation-log="true"
      className="w-[min(19rem,calc(100vw-1.5rem))] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--fg)]">
          <Clock3 className="h-3.5 w-3.5 text-[var(--fg-tertiary)]" aria-hidden />
          最近操作
        </div>
        <button
          type="button"
          title="关闭最近操作"
          aria-label="关闭最近操作"
          data-simulation-operation-log-close="true"
          onClick={onClose}
          className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-tertiary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {entries.length > 0 ? (
        <div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.id}
              data-simulation-operation-log-entry="true"
              data-action-id={entry.actionId}
              data-creates-new-round={entry.createsNewRound ? "true" : "false"}
              data-requests-report={entry.requestsReport ? "true" : "false"}
              className="px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-xs font-medium text-[var(--fg)]">
                  {entry.title}
                </div>
                <time className="shrink-0 text-[10px] tabular-nums text-[var(--fg-tertiary)]">
                  {timeLabel(entry.createdAt)}
                </time>
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[var(--fg-tertiary)]">
                目标：{entry.targetLabel ?? entry.targetId ?? "画布"}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-[var(--fg-secondary)]">
                {entry.createsNewRound ? (
                  <span className="rounded-[var(--radius-sm)] bg-[var(--accent-muted)] px-1.5 py-0.5">
                    将生成新 Round
                  </span>
                ) : null}
                {entry.requestsReport ? (
                  <span className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-1.5 py-0.5">
                    请求报告
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-3 py-5 text-center text-xs text-[var(--fg-tertiary)]">
          暂无最近操作
        </div>
      )}
    </section>
  );
}

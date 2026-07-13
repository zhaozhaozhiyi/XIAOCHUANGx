"use client";

import { X } from "lucide-react";
import type { CanvasActionReceipt } from "@/components/simulation/canvas/canvasTypes";

const STATUS_LABEL: Record<CanvasActionReceipt["status"], string> = {
  queued: "已排队",
  sent: "已发送",
  running: "处理中",
  failed: "失败",
  done: "完成",
};

type SimulationActionReceiptProps = {
  receipt: CanvasActionReceipt;
  onDismiss?: () => void;
};

export function SimulationActionReceipt({
  receipt,
  onDismiss,
}: SimulationActionReceiptProps) {
  const summary = receipt.impactSummary;
  const impactSummary =
    summary &&
    `预计影响：${summary.nodes} 个节点、${summary.edges} 条边、${summary.paths} 条路径、${summary.scenarios} 个情景`;

  return (
    <div
      data-action-receipt="true"
      data-action-id={receipt.actionId}
      data-receipt-status={receipt.status}
      data-target-kind={receipt.targetKind}
      className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--accent)_34%,var(--border))] bg-[color-mix(in_srgb,var(--accent-muted)_42%,var(--surface-elevated))] px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[var(--fg)]">
              {receipt.title}
            </div>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] text-[var(--fg-secondary)]">
              {STATUS_LABEL[receipt.status]}
            </span>
          </div>
          {receipt.targetLabel ? (
            <div className="mt-1 text-xs text-[var(--fg-tertiary)]">
              目标：{receipt.targetLabel}
            </div>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            aria-label="关闭操作回执"
            data-action-receipt-close="true"
            onClick={onDismiss}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-tertiary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="mt-2 space-y-1 text-xs leading-5 text-[var(--fg-secondary)]">
        <div>{receipt.body}</div>
        {impactSummary ? <div>{impactSummary}</div> : null}
        {receipt.createsNewRound != null ? (
          <div>
            {receipt.createsNewRound
              ? "下一步：可能生成新 Round"
              : "下一步：不生成新 Round"}
            {receipt.oldRoundPreserved ? "，旧 Round 保留可回看" : ""}
          </div>
        ) : null}
      </div>
      {receipt.impactLines?.length ? (
        <div className="mt-2 space-y-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-[11px] leading-5 text-[var(--fg-tertiary)]">
          {receipt.impactLines.slice(0, 4).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

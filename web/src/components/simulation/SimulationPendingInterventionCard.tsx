"use client";

export type PendingIntervention = {
  title: string;
  targetNodeId: string;
  targetLabel: string;
  nextValue?: string;
  impactLines: string[];
  message: string;
  actionId?: string;
  targetKind?: string;
  createsNewRound?: boolean;
  oldRoundPreserved?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
};

type SimulationPendingInterventionCardProps = {
  intervention: PendingIntervention;
  onConfirm: () => void;
  onCancel: () => void;
};

export function SimulationPendingInterventionCard({
  intervention,
  onConfirm,
  onCancel,
}: SimulationPendingInterventionCardProps) {
  const roundEffect =
    intervention.createsNewRound === true
      ? "确认后会生成新 Round"
      : intervention.createsNewRound === false
        ? "不生成新 Round"
        : "可能生成新 Round，等待 Agent 返回后确认";
  const oldRoundEffect =
    intervention.oldRoundPreserved === false
      ? "旧 Round 可能被当前动作覆盖"
      : "旧 Round 保留可回看";

  return (
    <div
      data-pending-intervention="true"
      data-action-id={intervention.actionId}
      data-target-kind={intervention.targetKind}
      data-creates-new-round={
        intervention.createsNewRound == null
          ? undefined
          : String(intervention.createsNewRound)
      }
      className="rounded-[var(--radius-md)] border border-[var(--accent)]/40 bg-[var(--surface-elevated)] px-3 py-3 shadow-[var(--shadow-sm)]"
    >
      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
        待确认干预
      </div>
      <div className="mt-1 text-sm font-semibold text-[var(--fg)]">
        {intervention.title}
      </div>
      <div className="mt-1 text-xs leading-5 text-[var(--fg-secondary)]">
        目标：{intervention.targetLabel}
        {intervention.nextValue ? ` → ${intervention.nextValue}` : ""}
      </div>
      <div className="mt-2 space-y-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
        <div>{roundEffect}</div>
        <div>{oldRoundEffect}</div>
        {intervention.impactLines.map((line) => (
          <div key={line} className="break-words">
            {line}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-pending-confirm="true"
          onClick={onConfirm}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          {intervention.confirmLabel ?? "确认执行"}
        </button>
        <button
          type="button"
          data-pending-cancel="true"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          {intervention.cancelLabel ?? "取消"}
        </button>
      </div>
    </div>
  );
}

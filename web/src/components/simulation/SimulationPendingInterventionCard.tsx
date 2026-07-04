"use client";

export type PendingIntervention = {
  title: string;
  targetNodeId: string;
  targetLabel: string;
  nextValue?: string;
  impactLines: string[];
  message: string;
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
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--accent)]/40 bg-[var(--surface-elevated)] px-3 py-3 shadow-[var(--shadow-sm)]">
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
        {intervention.impactLines.map((line) => (
          <div key={line} className="break-words">
            {line}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          确认执行
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          取消
        </button>
      </div>
    </div>
  );
}

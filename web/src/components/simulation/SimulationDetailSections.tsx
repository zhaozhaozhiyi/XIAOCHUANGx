"use client";

export type SimulationDetailRow = {
  label: string;
  value: string;
};

export type SimulationImpactGroup = {
  label: string;
  items: Array<{ id: string; label?: string }>;
};

type SimulationStructuredInfoCardProps = {
  rows: SimulationDetailRow[];
};

type SimulationImpactPreviewCardProps = {
  groups: SimulationImpactGroup[];
};

function formatItemList(items: Array<{ id: string; label?: string }>, limit = 5) {
  const labels = items.map((item) => item.label ?? item.id);
  if (labels.length <= limit) return labels.join("、");
  return `${labels.slice(0, limit).join("、")} 等 ${labels.length} 项`;
}

export function SimulationStructuredInfoCard({
  rows,
}: SimulationStructuredInfoCardProps) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
        结构化信息
      </div>
      <div className="mt-2 divide-y divide-[var(--border)]">
        {rows.map((row) => (
          <div
            key={`${row.label}:${row.value}`}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 py-1.5 text-xs leading-5"
          >
            <div className="text-[var(--fg-tertiary)]">{row.label}</div>
            <div className="min-w-0 break-words text-[var(--fg-secondary)]">
              {row.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SimulationImpactPreviewCard({
  groups,
}: SimulationImpactPreviewCardProps) {
  if (groups.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
        干预影响预览
      </div>
      <div className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--fg-secondary)]">
        {groups.map((group) => (
          <div
            key={group.label}
            className="grid grid-cols-[72px_minmax(0,1fr)] gap-2"
          >
            <span className="text-[var(--fg-tertiary)]">{group.label}</span>
            <span className="min-w-0 break-words">
              {group.items.length > 0
                ? formatItemList(group.items)
                : "未明确，需要 AI 重新评估"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

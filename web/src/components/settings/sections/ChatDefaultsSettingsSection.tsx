export function ChatDefaultsSettingsSection() {
  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        预览能力：已可保存，将在 V1.1 正式纳入验收（F-SET-002）。
      </p>

      <div>
        <label className="text-sm font-medium text-[var(--fg)]">默认问答策略</label>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          新对话默认由基座 Skill 判断轻量回答或深度处理。
        </p>
        <div className="mt-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
          <div className="text-sm font-medium text-[var(--fg)]">自动</div>
          <div className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
            用户不需要选择快慢；复杂度、是否检索、是否生成交付物由助手按任务判断。
          </div>
        </div>
      </div>
    </div>
  );
}

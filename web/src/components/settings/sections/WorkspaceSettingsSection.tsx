"use client";

import { useSettings } from "@/components/settings/SettingsContext";

export function WorkspaceSettingsSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        预览能力：已可保存，将在 V1.1 正式纳入验收（F-SET-004）。
      </p>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3 text-sm">
        <div>
          <span className="font-medium">默认展开工作区</span>
          <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
            默认关闭；开启后进入对话、写作等模块时自动打开右侧面板
          </p>
        </div>
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-[var(--accent)]"
          checked={settings.workspaceOpenByDefault}
          onChange={(e) =>
            updateSettings({ workspaceOpenByDefault: e.target.checked })
          }
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3 text-sm">
        <span>记住工作区宽度</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={settings.workspaceRememberWidth}
          onChange={(e) =>
            updateSettings({ workspaceRememberWidth: e.target.checked })
          }
        />
      </label>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3 text-sm">
        <div>
          <span className="font-medium">显示 Agent 终端页签</span>
          <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
            关闭后工作区仅保留文件与预览
          </p>
        </div>
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-[var(--accent)]"
          checked={settings.showAgentTerminalTab}
          onChange={(e) =>
            updateSettings({ showAgentTerminalTab: e.target.checked })
          }
        />
      </label>
    </div>
  );
}

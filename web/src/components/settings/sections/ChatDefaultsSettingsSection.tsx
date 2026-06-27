"use client";

import { CHAT_MODES } from "@/lib/navigation";
import { useSettings } from "@/components/settings/SettingsContext";

export function ChatDefaultsSettingsSection() {
  const { settings, updateSettings } = useSettings();

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
        预览能力：已可保存，将在 V1.1 正式纳入验收（F-SET-002）。
      </p>

      <div>
        <label className="text-sm font-medium text-[var(--fg)]">默认问答模式</label>
        <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
          从「新对话」进入时的初始模式
        </p>
        <div className="mt-2 space-y-1">
          {CHAT_MODES.map((m) => (
            <label
              key={m.id}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                settings.defaultChatMode === m.id
                  ? "border-[var(--accent)] bg-[var(--accent-muted)]"
                  : "border-[var(--border)]"
              }`}
            >
              <input
                type="radio"
                name="defaultChatMode"
                className="mt-1 accent-[var(--accent)]"
                checked={settings.defaultChatMode === m.id}
                onChange={() => updateSettings({ defaultChatMode: m.id })}
              />
              <span>
                <span className="text-sm font-medium">{m.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)]">
                  {m.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-3 text-sm">
        <span>新建对话沿用上次使用的模式</span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--accent)]"
          checked={settings.rememberLastChatMode}
          onChange={(e) =>
            updateSettings({ rememberLastChatMode: e.target.checked })
          }
        />
      </label>
    </div>
  );
}

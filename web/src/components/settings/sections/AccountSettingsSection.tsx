"use client";

import { useAuthProfile } from "@/hooks/useAuthProfile";
import { NAV_MODULES } from "@/lib/navigation";

const MOCK_MODULES_ENABLED = new Set([
  "chat",
  "meeting",
  "knowledge",
  "writing",
  "ppt",
]);

export function AccountSettingsSection() {
  const { profile } = useAuthProfile();

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--fg-secondary)]">
        以下为本平台账号信息（只读）。模块开通与数据权限由企业管理员配置，MVP
        不与 外部业务系统账号打通。
      </p>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        <p className="text-overline">登录手机号</p>
        <p className="mt-1 text-sm font-medium text-[var(--fg)]">
          {profile?.maskedPhone ?? "—"}
        </p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          昵称：{profile?.nickname ?? "研究员"}
        </p>
        <p className="text-xs text-[var(--fg-tertiary)]">
          {profile?.tenantName ?? "小窗 · 企业租户"}
        </p>
      </div>

      <div>
        <p className="text-overline mb-2">已开通模块</p>
        <ul className="space-y-1">
          {NAV_MODULES.map((mod) => {
            const on = MOCK_MODULES_ENABLED.has(mod.id);
            return (
              <li
                key={mod.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  on
                    ? "bg-[var(--surface-elevated)] text-[var(--fg)]"
                    : "text-[var(--fg-muted)] line-through"
                }`}
              >
                <span>{mod.label}</span>
                <span className="text-xs">{on ? "已开通" : "未开通"}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
        <p className="text-overline">数据权限摘要</p>
        <p className="mt-2 text-sm text-[var(--fg)]">
          黑色系、能源化工、螺纹钢、聚乙烯等（示例；按本平台账号配置）
        </p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          如需开通更多品种或模块，请联系企业管理员。
        </p>
      </div>
    </div>
  );
}

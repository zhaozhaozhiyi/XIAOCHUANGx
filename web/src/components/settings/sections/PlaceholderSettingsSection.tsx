"use client";

import { Construction } from "lucide-react";
import { CHAT_MODES } from "@/lib/navigation";
import type { SettingsSectionId } from "@/lib/settings";

const COPY: Record<
  Exclude<
    SettingsSectionId,
    "agent" | "account" | "about"
  >,
  { title: string; body: string; planned: string }
> = {
  chat_defaults: {
    title: "研究与对话默认",
    body: "配置新建对话的默认问答模式，以及是否沿用上次模式。",
    planned: "V1.1 · F-SET-002",
  },
  charts: {
    title: "数据与图表",
    body: "变频默认规则（期末/均值/合计）与表格、图表导出默认格式。",
    planned: "V1.1 · F-SET-003",
  },
  workspace: {
    title: "工作区",
    body: "默认展开工作区、记住面板宽度、是否显示 Agent 终端页签。",
    planned: "V1.1 · F-SET-004",
  },
  knowledge: {
    title: "知识库",
    body: "查看容量用量，配置生成完成后是否提示存入知识库。",
    planned: "V1.1 · F-SET-005",
  },
  admin: {
    title: "功能与审计",
    body: "模块开关、企业配额、会议/上传上限与审计日志查询。",
    planned: "V1.1 · F-SET-008",
  },
};

export function PlaceholderSettingsSection({ section }: { section: SettingsSectionId }) {
  const meta = COPY[section as keyof typeof COPY];
  if (!meta) return null;

  const isPartial =
    section === "chat_defaults" ||
    section === "workspace" ||
    section === "knowledge";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--accent-muted)]/40 px-4 py-3">
        <Construction className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">{meta.title}</p>
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">{meta.planned}</p>
        </div>
      </div>

      <p className="text-sm text-[var(--fg-secondary)]">{meta.body}</p>

      {isPartial && (
        <div className="space-y-4 opacity-60 pointer-events-none select-none">
          <p className="text-overline">预览（未生效）</p>
          {section === "chat_defaults" && (
            <>
              <label className="block text-sm">默认问答模式</label>
              <select className="w-full rounded-lg border border-[var(--border)] px-2 py-2 text-sm">
                {CHAT_MODES.map((m) => (
                  <option key={m.id}>{m.label}</option>
                ))}
              </select>
            </>
          )}
          {section === "workspace" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> 进入模块时默认展开工作区
            </label>
          )}
          {section === "knowledge" && (
            <p className="text-sm">已用 1.2 GB / 5 GB</p>
          )}
        </div>
      )}

    </div>
  );
}

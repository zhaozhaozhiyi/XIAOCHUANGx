"use client";

import { Construction } from "lucide-react";
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
    body: "配置新建对话的默认问答策略；当前默认由助手自动判断回答深度。",
    planned: "Desktop Beta · F-SET-002",
  },
  workspace: {
    title: "工作区",
    body: "默认展开工作区、记住面板宽度、是否显示 Agent 终端页签。",
    planned: "Desktop Beta · F-SET-004",
  },
  admin: {
    title: "功能与审计",
    body: "模块开关、企业配额、上传上限与审计日志查询。",
    planned: "Web Sandbox · F-SET-008",
  },
};

export function PlaceholderSettingsSection({ section }: { section: SettingsSectionId }) {
  const meta = COPY[section as keyof typeof COPY];
  if (!meta) return null;

  const isPartial =
    section === "chat_defaults" ||
    section === "workspace";

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
              <label className="block text-sm">默认问答策略</label>
              <div className="rounded-lg border border-[var(--border)] px-2 py-2 text-sm">
                自动判断
              </div>
            </>
          )}
          {section === "workspace" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked /> 进入模块时默认展开工作区
            </label>
          )}
        </div>
      )}

    </div>
  );
}

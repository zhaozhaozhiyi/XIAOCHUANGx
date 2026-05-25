"use client";

import { Copy, HelpCircle } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/components/settings/SettingsContext";

export function AboutSettingsSection() {
  const { settings, updateSettings, agentsRuntime } = useSettings();
  const [copied, setCopied] = useState(false);

  const copyDiagnostics = async () => {
    const payload = {
      platform: "小窗 原型 0.1.0",
      dataSources: "mock 26.1",
      agents: agentsRuntime.agents,
      inferenceChannel: agentsRuntime.inferenceChannel,
      companionOk: agentsRuntime.companionOk,
      defaultAgent: settings.defaultAgentId,
      ts: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        <p className="text-overline">版本</p>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">小窗</dt>
            <dd className="font-mono text-[var(--fg)]">0.1.0-prototype</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">数据源</dt>
            <dd className="font-mono text-[var(--fg)]">26.1.0</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--fg-tertiary)]">智能体组件包</dt>
            <dd className="font-mono text-[var(--fg)]">cli-bundle-2026.05</dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        className="btn btn-secondary w-full justify-center gap-2 py-2 text-sm"
        onClick={() => void copyDiagnostics()}
      >
        <Copy className="h-4 w-4" strokeWidth={1.75} />
        {copied ? "已复制诊断信息" : "复制诊断信息"}
      </button>

      <a
        href="#"
        className="btn btn-secondary flex w-full items-center justify-center gap-2 py-2 text-sm"
        onClick={(e) => {
          e.preventDefault();
          window.alert("原型：打开帮助文档");
        }}
      >
        <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
        使用帮助与反馈
      </a>

      <div className="rounded-lg border border-dashed border-[var(--border-strong)] p-3">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
          <span className="text-[var(--fg-secondary)]">模拟管理员视图（原型）</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={settings.simulateAdmin}
            onChange={(e) => updateSettings({ simulateAdmin: e.target.checked })}
          />
        </label>
        <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
          开启后在用户菜单中显示 BYOK、功能与审计占位项
        </p>
      </div>
    </div>
  );
}

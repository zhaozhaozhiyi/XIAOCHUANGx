"use client";

import { useState } from "react";
import { PPT_TEMPLATE_CATALOG } from "@/lib/module-registry";

const STEPS = ["主题与受众", "大纲确认", "生成幻灯片", "预览与导出"];

type Props = {
  pathname: string;
  variant?: "new" | "from-writing" | "template";
};

export function PptPanel({ pathname, variant = "new" }: Props) {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState("default");

  const title =
    variant === "from-writing"
      ? "从文稿生成 PPT"
      : variant === "template"
        ? "路演模板"
        : "新建 PPT";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ol className="flex gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex-1 rounded-lg border px-2 py-2 text-center text-xs ${
              i === step
                ? "border-[var(--brand)] bg-[var(--brand-muted)] font-medium"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {label}
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">
          {title} · {pathname}
        </p>
        {variant === "from-writing" && (
          <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
            选择「我的文稿」中的成稿，系统将按章节自动拆分幻灯片页
          </p>
        )}
        {variant === "template" && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {PPT_TEMPLATE_CATALOG.map((tpl) => (
              <button
                key={tpl.templateId}
                type="button"
                onClick={() => setTemplateId(tpl.templateId)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  templateId === tpl.templateId
                    ? "border-[var(--brand)] bg-[var(--brand-muted)]"
                    : "border-[var(--border)] hover:border-[var(--brand)]/40"
                }`}
              >
                <span className="font-medium">{tpl.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)]">
                  {tpl.description}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            演示主题
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="如：2025Q1 螺纹钢市场展望"
            />
          </label>
          <label className="text-sm">
            页数建议
            <select className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
              <option>精简（8–12 页）</option>
              <option>标准（15–20 页）</option>
              <option>详细（25+ 页）</option>
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" defaultChecked className="rounded" />
          嵌入对话/数据源图表（静态图）
        </label>
      </div>
      <div className="flex justify-end gap-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            上一步
          </button>
        )}
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
          className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white"
        >
          {step >= STEPS.length - 1 ? "导出 PPTX" : "下一步"}
        </button>
      </div>
    </div>
  );
}

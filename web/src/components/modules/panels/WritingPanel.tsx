"use client";

import { useState } from "react";

const STEPS = ["参数设置", "写作方向", "大纲确认", "撰写"];

type Props = {
  pathname: string;
  flow?: "blank" | "template";
};

export function WritingPanel({ pathname, flow = "template" }: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"multi" | "fast">("multi");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("multi")}
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === "multi" ? "bg-[var(--brand)] text-white" : "border border-[var(--border)]"}`}
        >
          多步骤
        </button>
        <button
          type="button"
          onClick={() => setMode("fast")}
          className={`rounded-lg px-3 py-1.5 text-sm ${mode === "fast" ? "bg-[var(--brand)] text-white" : "border border-[var(--border)]"}`}
        >
          快速
        </button>
      </div>
      {mode === "multi" && (
        <ol className="flex gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-lg border px-3 py-2 text-center text-xs ${
                i === step
                  ? "border-[var(--brand)] bg-[var(--brand-muted)] font-medium"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6">
        <p className="text-sm text-[var(--muted)]">
          {flow === "blank" ? "新建写作" : "写作模板"} · {pathname}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            品种 / 行业
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="如：螺纹钢"
            />
          </label>
          <label className="text-sm">
            时间范围
            <input
              className="mt-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
              placeholder="如：2025Q1"
            />
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {step > 0 && mode === "multi" && (
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
          {mode === "fast" || step >= STEPS.length - 1 ? "生成文稿" : "下一步"}
        </button>
      </div>
    </div>
  );
}

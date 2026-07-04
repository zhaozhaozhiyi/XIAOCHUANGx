"use client";

import { GitBranch, Network, Route, SlidersHorizontal } from "lucide-react";

export function SimulationCanvasPlaceholder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--fg-tertiary)]">
          <Network className="h-3.5 w-3.5" aria-hidden />
          沙盘画布
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--fg-tertiary)]">
          空沙盘
        </span>
      </div>

      <div
        className={[
          "relative min-h-[360px] overflow-hidden bg-[radial-gradient(circle_at_center,color-mix(in_srgb,var(--fg-tertiary)_18%,transparent)_1px,transparent_1.5px)] bg-[length:22px_22px]",
          compact ? "min-h-[300px]" : "lg:min-h-[520px]",
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,color-mix(in_srgb,var(--border)_34%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_srgb,var(--border)_34%,transparent)_1px,transparent_1px)] bg-[length:88px_88px] opacity-35" />
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-tertiary)] shadow-[var(--shadow-sm)]">
              <Network className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="mt-4 text-sm font-semibold text-[var(--fg)]">
              等待建立初始沙盘
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--fg-tertiary)]">
              AI 回复会转成这张画布上的节点、路径、变量和报告入口。
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--border)] border-t border-[var(--border)] text-xs">
        <div className="flex items-center gap-2 px-3 py-2 text-[var(--fg-tertiary)]">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          变量
        </div>
        <div className="flex items-center gap-2 px-3 py-2 text-[var(--fg-tertiary)]">
          <Route className="h-3.5 w-3.5" aria-hidden />
          路径
        </div>
        <div className="flex items-center gap-2 px-3 py-2 text-[var(--fg-tertiary)]">
          <GitBranch className="h-3.5 w-3.5" aria-hidden />
          轮次
        </div>
      </div>
    </div>
  );
}

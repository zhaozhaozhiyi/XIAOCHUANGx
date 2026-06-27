"use client";

import {
  ArrowRight,
  BarChart3,
  FileText,
  GitCompare,
  Shuffle,
  type LucideIcon,
} from "lucide-react";

type TaskSuggestion = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const TASKS: TaskSuggestion[] = [
  {
    id: "inventory",
    label: "上周螺纹钢社会库存环比变化",
    icon: BarChart3,
  },
  {
    id: "compare",
    label: "对比三家机构对原油的多空观点",
    icon: GitCompare,
  },
  {
    id: "outline",
    label: "生成一份螺纹钢周报大纲",
    icon: FileText,
  },
];

type ChatHomeTaskSuggestionsProps = {
  onSelect: (text: string) => void;
};

export function ChatHomeTaskSuggestions({
  onSelect,
}: ChatHomeTaskSuggestionsProps) {
  return (
    <section
      className="mt-6 w-full max-w-3xl"
      aria-label="推荐研究任务"
    >
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-[var(--fg-tertiary)]">
        <Shuffle className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
        挑一条开始
      </p>

      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {TASKS.map((task) => {
          const Icon = task.icon;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onSelect(task.label)}
                className="group flex w-full min-h-[44px] items-center gap-3 rounded-[var(--radius-lg)] px-2 py-2.5 text-left transition-[background-color,color] hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg-secondary)] transition-[color,border-color,background-color] group-hover:border-[var(--border-strong)] group-hover:text-[var(--fg)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-sm leading-snug text-[var(--fg-secondary)] group-hover:text-[var(--fg)]">
                  {task.label}
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)] opacity-0 transition-[opacity,transform,color] group-hover:translate-x-0.5 group-hover:text-[var(--fg-secondary)] group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:text-[var(--fg-secondary)] group-focus-visible:opacity-100"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

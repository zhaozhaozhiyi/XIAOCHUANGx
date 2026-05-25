"use client";

import { FileText, Presentation } from "lucide-react";
import type { AssetRecord } from "@/lib/module-mock-data";

type Props = {
  variant: "writing" | "ppt";
  items: AssetRecord[];
};

export function AssetListPanel({ variant, items }: Props) {
  const Icon = variant === "writing" ? FileText : Presentation;
  const emptyLabel = variant === "writing" ? "暂无文稿" : "暂无 PPT";

  if (items.length === 0) {
    return (
      <div className="card-flat mx-auto max-w-md p-12 text-center text-sm text-[var(--fg-secondary)]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-[var(--sidebar-hover)]"
            >
              <Icon className="h-5 w-5 shrink-0 text-[var(--fg-tertiary)]" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fg)]">{item.title}</p>
                {item.template && (
                  <p className="text-xs text-[var(--fg-tertiary)]">{item.template}</p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-xs ${
                  item.status === "done"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-[var(--surface)] text-[var(--fg-secondary)]"
                }`}
              >
                {item.status === "done" ? "已完成" : "草稿"}
              </span>
              <span className="shrink-0 text-xs text-[var(--fg-tertiary)]">
                {item.updatedAt}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

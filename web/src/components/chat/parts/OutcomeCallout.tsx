"use client";

import { AlertCircle, CircleStop, Info, MessageCircleQuestion } from "lucide-react";
import type { TurnOutcome } from "@/lib/chat-turn-view-model";

export function OutcomeCallout({ outcome }: { outcome: TurnOutcome }) {
  const Icon =
    outcome.kind === "waiting_user"
      ? MessageCircleQuestion
      : outcome.kind === "error"
        ? AlertCircle
        : outcome.kind === "cancelled"
          ? CircleStop
          : Info;
  return (
    <aside
      className="chat-outcome-callout"
      data-kind={outcome.kind}
      role={outcome.kind === "error" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--fg)]">{outcome.title}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-[var(--fg-secondary)]">
          {outcome.message}
        </p>
        {outcome.partial ? (
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">以下为已生成的部分结果。</p>
        ) : null}
      </div>
    </aside>
  );
}


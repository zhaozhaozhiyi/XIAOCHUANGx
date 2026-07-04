"use client";

import { useMemo, useState } from "react";
import type { ChatPart } from "@/lib/chat-parts";
import { activitySummaryLabel } from "@/lib/chat-parts-utils";
import { ActivityProcessList } from "@/components/chat/parts/ActivityTimeline";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
} from "lucide-react";

type AnalysisFallbackStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
};

type CollapsePreference = "auto" | "user_expanded" | "user_collapsed";

function isPanelExpanded(
  preference: CollapsePreference,
  isStreaming: boolean,
): boolean {
  if (isStreaming) return preference !== "user_collapsed";
  return preference === "user_expanded";
}

function fallbackSummary(steps: AnalysisFallbackStep[]): string {
  if (steps.length === 0) return "分析完成";
  const done = steps.filter((step) => step.status === "success").length;
  if (done === steps.length) return `已完成 ${steps.length} 项分析`;
  const running = steps.find((step) => step.status === "running");
  if (running) return running.label;
  return `分析 ${steps.length} 项`;
}

export function SimulationTopicAnalysisPanel({
  activityParts,
  gapBefore,
  runId,
  statusPart,
  isStreaming = false,
  fallbackSteps = [],
  embedded = false,
}: {
  activityParts: ChatPart[];
  gapBefore: Map<string | null, string>;
  runId?: string;
  statusPart?: Extract<ChatPart, { kind: "turn_meta" | "status" }> | null;
  isStreaming?: boolean;
  fallbackSteps?: AnalysisFallbackStep[];
  /** 嵌入问题定义卡片内时，收起态更紧凑 */
  embedded?: boolean;
}) {
  const [collapsePreference, setCollapsePreference] =
    useState<CollapsePreference>("auto");
  const hasActivity = activityParts.length > 0;
  const expanded = isPanelExpanded(collapsePreference, isStreaming);
  const summary = useMemo(() => {
    if (hasActivity) return activitySummaryLabel(activityParts);
    return fallbackSummary(fallbackSteps);
  }, [activityParts, fallbackSteps, hasActivity]);

  const toggleExpanded = () => {
    setCollapsePreference((current) => {
      const currentlyExpanded = isPanelExpanded(current, isStreaming);
      if (currentlyExpanded) return "user_collapsed";
      return "user_expanded";
    });
  };

  const panelBody = hasActivity ? (
    <div className="simulation-topic-analysis-panel__timeline text-[12px] leading-5 [&_.chat-activity-timeline]:gap-2 [&_.chat-activity-step]:gap-2 [&_.chat-activity-step__body]:text-[12px] [&_.chat-activity-step__label]:text-[11px]">
      <ActivityProcessList
        parts={activityParts}
        gapBefore={gapBefore}
        runId={runId}
      />
    </div>
  ) : (
    <div className="space-y-1">
      {fallbackSteps.map((step) => {
        const Icon =
          step.status === "success"
            ? CheckCircle2
            : step.status === "running"
              ? Loader2
              : Circle;
        return (
          <div
            key={step.id}
            className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-1.5 text-[11px] leading-4 text-[var(--fg-secondary)]"
          >
            <Icon
              className={[
                "mt-0.5 h-3.5 w-3.5",
                step.status === "running"
                  ? "animate-spin text-[var(--accent)]"
                  : "",
                step.status === "success" ? "text-[var(--success)]" : "",
                step.status === "pending" ? "text-[var(--fg-tertiary)]" : "",
                step.status === "error" ? "text-[var(--danger)]" : "",
              ].join(" ")}
              aria-hidden
            />
            <span className="min-w-0 break-words">{step.label}</span>
          </div>
        );
      })}
    </div>
  );

  if (!expanded) {
    return (
      <div
        className={[
          embedded ? "mt-2" : "",
          "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]",
        ].join(" ")}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-[var(--sidebar-hover)]"
          onClick={toggleExpanded}
          aria-expanded={false}
          aria-label="展开 AI 分析过程"
        >
          <CheckCircle2
            className="h-3.5 w-3.5 shrink-0 text-[var(--success)]"
            strokeWidth={1.75}
            aria-hidden
          />
          <span className="shrink-0 text-[11px] font-medium text-[var(--fg-secondary)]">
            AI 分析过程
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--fg-tertiary)]">
            {summary}
          </span>
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]"
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "simulation-topic-analysis-panel max-h-[min(320px,42vh)] overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5",
        embedded ? "mt-2" : "",
      ].join(" ")}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isStreaming ? (
            <Loader2
              className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--accent)]"
              aria-hidden
            />
          ) : (
            <CheckCircle2
              className="h-3.5 w-3.5 shrink-0 text-[var(--success)]"
              strokeWidth={1.75}
              aria-hidden
            />
          )}
          <span className="text-[10px] font-medium text-[var(--fg-tertiary)]">
            AI 分析过程
          </span>
          {!isStreaming ? (
            <span className="truncate text-[10px] text-[var(--fg-tertiary)]">
              {summary}
            </span>
          ) : null}
        </div>
        {!isStreaming ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-secondary)]"
            onClick={toggleExpanded}
            aria-expanded
            aria-label="收起 AI 分析过程"
          >
            收起
            <ChevronDown className="h-3 w-3" strokeWidth={1.75} aria-hidden />
          </button>
        ) : null}
      </div>
      {panelBody}
      {statusPart && isStreaming ? (
        <div className="mt-2 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--fg-secondary)]">
          <PartRenderer part={statusPart} presentation="timeline" />
        </div>
      ) : null}
    </div>
  );
}

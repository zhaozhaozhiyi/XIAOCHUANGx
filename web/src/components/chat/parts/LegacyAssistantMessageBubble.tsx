"use client";

import { useMemo } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import { localizeAgentMentions } from "@/lib/settings";
import type { ChatPart } from "@/lib/chat-parts";
import { computeThinkingGaps } from "@/lib/chat-thinking-gap";
import { selectHasAssistantSummaryContent } from "@/lib/chat-message-selectors";
import { buildLegacyTurnViewModel } from "@/lib/chat-turn-view-model-legacy";
import { ActivityProcessList } from "@/components/chat/parts/ActivityTimeline";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";
import { ToolRunningDots } from "@/components/chat/parts/ToolRunningDots";
import type { AssistantMessageBubbleProps } from "@/components/chat/parts/AssistantMessageBubble";

function LoadingBubble() {
  return (
    <div className="flex items-center gap-2 text-[var(--fg-secondary)]" role="status">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)] [animation-delay:300ms]" />
      </span>
      <span className="text-sm">处理中…</span>
    </div>
  );
}

function hasRunningToolPart(parts: ChatPart[]): boolean {
  return parts.some((part) => {
    if (part.kind === "tool") return part.status === "running";
    if (part.kind === "command" || part.kind === "tool_batch") {
      return !!part.streaming;
    }
    return false;
  });
}

export function LegacyAssistantMessageBubble({
  message,
  sessionId,
  thinkingGapMinMs = 3_000,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: AssistantMessageBubbleProps) {
  const { settings } = useSettings();
  const status = message.status ?? "complete";
  const hasSummary = selectHasAssistantSummaryContent(message);
  const model = useMemo(() => buildLegacyTurnViewModel(message), [message]);
  const waitingMessage = model.waitingMessage
    ? localizeAgentMentions(model.waitingMessage, settings.agentAliases)
    : null;
  const gaps = useMemo(
    () =>
      computeThinkingGaps(message.parts ?? [], {
        runStartedAt: message.runStartedAt,
        minGapMs: thinkingGapMinMs,
      }),
    [message.parts, message.runStartedAt, thinkingGapMinMs],
  );
  const gapBefore = useMemo(() => {
    const next = new Map<string | null, string>();
    for (const gap of gaps) next.set(gap.beforePartId, gap.label);
    return next;
  }, [gaps]);
  const hasContent = model.contentParts.length > 0 || model.deliverablesPart != null;
  const showTailStatus =
    model.statusPart != null && (status === "loading" || status === "streaming");

  if (
    (status === "loading" || status === "streaming") &&
    !hasSummary &&
    !hasContent
  ) {
    return <div className="bubble-assistant"><LoadingBubble /></div>;
  }

  return (
    <div className="bubble-assistant" data-renderer="legacy">
      <div className="chat-assistant-message">
        {waitingMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--warn)]/25 bg-[var(--activity-chip-wait-bg)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase text-[var(--warn)]">需要你继续</p>
            <p className="mt-1 text-sm text-[var(--activity-chip-wait-fg)]">{waitingMessage}</p>
          </div>
        ) : null}
        {hasContent ? (
          <div className="chat-assistant-stage">
            {hasRunningToolPart(model.processParts) ? (
              <ToolRunningDots label="工具执行中…" />
            ) : null}
            {model.contentParts.length > 0 ? (
              <ActivityProcessList
                parts={model.contentParts}
                gapBefore={gapBefore}
                sessionId={sessionId}
                runId={message.runId}
                onClarificationSubmitted={onClarificationSubmitted}
                onClarificationContinue={onClarificationContinue}
                onClarificationDraftChange={onClarificationDraftChange}
                onRequirementsSubmitted={onRequirementsSubmitted}
                onRequirementsContinue={onRequirementsContinue}
                onRequirementsDraftChange={onRequirementsDraftChange}
                onOutlineCommitted={onOutlineCommitted}
              />
            ) : null}
            {model.deliverablesPart ? (
              <div className="mt-3">
                <PartRenderer part={model.deliverablesPart} sessionId={sessionId} runId={message.runId} />
              </div>
            ) : null}
          </div>
        ) : null}
        {showTailStatus ? <PartRenderer part={model.statusPart!} /> : null}
        {status === "error" && !hasContent ? (
          <p className="text-xs text-[var(--danger)]">生成失败。请检查运行时状态后重试。</p>
        ) : null}
        {status === "cancelled" ? <p className="text-xs text-[var(--warn)]">已中断</p> : null}
      </div>
    </div>
  );
}

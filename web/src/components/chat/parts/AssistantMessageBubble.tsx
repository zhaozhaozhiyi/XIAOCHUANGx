"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/lib/chat";
import type { ChatPart, OutlineCommitPayload } from "@/lib/chat-parts";
import { computeThinkingGaps } from "@/lib/chat-thinking-gap";
import { selectHasAssistantSummaryContent } from "@/lib/chat-message-selectors";
import { buildTurnViewModel } from "@/lib/chat-turn-view-model";
import { ActivityProcessList } from "@/components/chat/parts/ActivityTimeline";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";
import { ToolRunningDots } from "@/components/chat/parts/ToolRunningDots";

type Props = {
  message: ChatMessage;
  thinkingGapMinMs?: number;
  onClarificationSubmitted?: (partId: string, answer: string) => void;
  onClarificationContinue?: (answer: string) => void;
  onClarificationDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      draft?: string;
    },
  ) => void;
  onRequirementsSubmitted?: (partId: string, answer: string) => void;
  onRequirementsContinue?: (answer: string) => void;
  onRequirementsDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      answers?: Record<string, string>;
    },
  ) => void;
  onOutlineCommitted?: (partId: string, patch: OutlineCommitPayload) => void;
};

function LoadingBubble() {
  return (
    <div className="flex items-center gap-2 text-[var(--fg-secondary)]">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:300ms]" />
      </span>
      <span className="text-sm">处理中…</span>
    </div>
  );
}

function hasRunningToolPart(parts: ChatPart[]): boolean {
  return parts.some((part) => {
    if (part.kind === "tool") return part.status === "running";
    if (part.kind === "command") return !!part.streaming;
    if (part.kind === "tool_batch") return !!part.streaming;
    return false;
  });
}

function WaitingUserCallout({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--warn)]/25 bg-[var(--activity-chip-wait-bg)] px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--warn)]">
        需要你继续
      </p>
      <p className="mt-1 text-sm text-[var(--activity-chip-wait-fg)]">
        {message}
      </p>
    </div>
  );
}

export function AssistantMessageBubble({
  message,
  thinkingGapMinMs = 3_000,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: Props) {
  const status = message.status ?? "complete";
  const hasSummary = selectHasAssistantSummaryContent(message);
  const viewModel = useMemo(() => buildTurnViewModel(message), [message]);
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

  const showToolRunningDots =
    (status === "loading" || status === "streaming") &&
    hasRunningToolPart(viewModel.processParts);
  const hasContent = viewModel.contentParts.length > 0 || viewModel.deliverablesPart != null;
  const showTailStatus =
    viewModel.statusPart != null &&
    (status === "loading" || status === "streaming");

  const tailStatus = showTailStatus ? (
    <div className="chat-assistant-stage chat-assistant-stage--status chat-assistant-stage--status-tail">
      <PartRenderer part={viewModel.statusPart!} />
    </div>
  ) : null;

  if (
    (status === "loading" || status === "streaming") &&
    !hasSummary &&
    !hasContent
  ) {
    return (
      <div className="bubble-assistant">
        <LoadingBubble />
        {tailStatus}
      </div>
    );
  }

  return (
    <div className="bubble-assistant">
      <div className="chat-assistant-message">
        {viewModel.waitingMessage ? (
          <WaitingUserCallout message={viewModel.waitingMessage} />
        ) : null}

        {hasContent ? (
          <div className="chat-assistant-stage">
            {showToolRunningDots ? <ToolRunningDots label="Activity running…" /> : null}
            {viewModel.contentParts.length > 0 ? (
              <ActivityProcessList
                parts={viewModel.contentParts}
                gapBefore={gapBefore}
                onClarificationSubmitted={onClarificationSubmitted}
                onClarificationContinue={onClarificationContinue}
                onClarificationDraftChange={onClarificationDraftChange}
                onRequirementsSubmitted={onRequirementsSubmitted}
                onRequirementsContinue={onRequirementsContinue}
                onRequirementsDraftChange={onRequirementsDraftChange}
                onOutlineCommitted={onOutlineCommitted}
              />
            ) : null}
            {viewModel.deliverablesPart ? (
              <div className="mt-3">
                <PartRenderer part={viewModel.deliverablesPart} />
              </div>
            ) : null}
          </div>
        ) : null}

        {tailStatus}

        {status === "error" && !hasContent ? (
          <p className="text-xs text-[var(--danger)]">
            生成失败。请确认 Companion 已启动、Agent CLI 可用，或查看顶栏运行时状态。
          </p>
        ) : null}
        {status === "cancelled" ? (
          <p className="text-xs text-[var(--warn)]">已中断</p>
        ) : null}
      </div>
    </div>
  );
}

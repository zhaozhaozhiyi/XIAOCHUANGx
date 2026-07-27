"use client";

import { useMemo } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import type { ChatMessage } from "@/lib/chat";
import { localizeAgentMentions } from "@/lib/settings";
import type { ActivityCollapse, OutlineCommitPayload } from "@/lib/chat-parts";
import { computeThinkingGaps } from "@/lib/chat-thinking-gap";
import { buildTurnViewModel, type ResultItem } from "@/lib/chat-turn-view-model";
import { ActivitySection } from "@/components/chat/parts/ActivitySection";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { OutcomeCallout } from "@/components/chat/parts/OutcomeCallout";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";
import { CHAT_ACTIVITY_V2_ENABLED } from "@/lib/chat-activity-feature";
import { LegacyAssistantMessageBubble } from "@/components/chat/parts/LegacyAssistantMessageBubble";

export type AssistantMessageBubbleProps = {
  message: ChatMessage;
  sessionId?: string;
  thinkingGapMinMs?: number;
  isLatestExecutingMessage?: boolean;
  onActivityCollapseChange?: (messageId: string, collapse: ActivityCollapse) => void;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
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
    <div className="flex items-center gap-2 text-[var(--fg-secondary)]" role="status">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--activity-running-dot)] [animation-delay:300ms]" />
      </span>
      <span className="text-sm">正在准备…</span>
    </div>
  );
}
function ResultSequence({
  items,
  sessionId,
  runId,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: {
  items: ResultItem[];
  sessionId?: string;
  runId?: string;
  onClarificationSubmitted?: AssistantMessageBubbleProps["onClarificationSubmitted"];
  onClarificationContinue?: AssistantMessageBubbleProps["onClarificationContinue"];
  onClarificationDraftChange?: AssistantMessageBubbleProps["onClarificationDraftChange"];
  onRequirementsSubmitted?: AssistantMessageBubbleProps["onRequirementsSubmitted"];
  onRequirementsContinue?: AssistantMessageBubbleProps["onRequirementsContinue"];
  onRequirementsDraftChange?: AssistantMessageBubbleProps["onRequirementsDraftChange"];
  onOutlineCommitted?: AssistantMessageBubbleProps["onOutlineCommitted"];
}) {
  if (items.length === 0) return null;
  return (
    <div className="chat-result-sequence" data-testid="result-sequence">
      {items.map((item) =>
        item.type === "answer" ? (
          <div
            key={item.id}
            className="chat-result-answer"
            data-answer-phase={item.phase}
            data-answer-id={item.id}
          >
            <ChatMarkdown markdown={item.markdown} streaming={item.streaming} />
          </div>
        ) : (
          <div key={item.id} className="chat-result-structured" data-part-kind={item.part.kind}>
            <PartRenderer
              part={item.part}
              sessionId={sessionId}
              runId={runId}
              onClarificationSubmitted={onClarificationSubmitted}
              onClarificationContinue={onClarificationContinue}
              onClarificationDraftChange={onClarificationDraftChange}
              onRequirementsSubmitted={onRequirementsSubmitted}
              onRequirementsContinue={onRequirementsContinue}
              onRequirementsDraftChange={onRequirementsDraftChange}
              onOutlineCommitted={onOutlineCommitted}
            />
          </div>
        ),
      )}
    </div>
  );
}

function AssistantMessageBubbleV2({
  message,
  sessionId,
  thinkingGapMinMs = 3_000,
  isLatestExecutingMessage = false,
  onActivityCollapseChange,
  onDisclosureIntent,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: AssistantMessageBubbleProps) {
  const { settings } = useSettings();
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
  const outcome = viewModel.outcome
    ? {
        ...viewModel.outcome,
        message: localizeAgentMentions(
          viewModel.outcome.message,
          settings.agentAliases,
        ),
      }
    : null;
  const showPreparing =
    viewModel.state === "preparing" &&
    !viewModel.activity.hasActivity &&
    !viewModel.hasResult;

  return (
    <div className="bubble-assistant" data-turn-state={viewModel.state}>
      <div className="chat-assistant-message">
        {showPreparing ? <LoadingBubble /> : null}

        {viewModel.activity.hasActivity ? (
          <ActivitySection
            model={viewModel.activity}
            collapse={message.activityCollapse}
            gapBefore={gapBefore}
            sessionId={sessionId}
            runId={message.runId}
            sticky={isLatestExecutingMessage}
            onCollapseChange={
              onActivityCollapseChange
                ? (collapse) => onActivityCollapseChange(message.id, collapse)
                : undefined
            }
            onDisclosureIntent={onDisclosureIntent}
            rendererProps={{
              onClarificationSubmitted,
              onClarificationContinue,
              onClarificationDraftChange,
              onRequirementsSubmitted,
              onRequirementsContinue,
              onRequirementsDraftChange,
              onOutlineCommitted,
            }}
          />
        ) : null}

        {outcome ? <OutcomeCallout outcome={outcome} /> : null}

        <ResultSequence
          items={viewModel.resultItems}
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

        {viewModel.deliverableParts.length > 0 ? (
          <div className="chat-deliverables-section" data-testid="deliverables-section">
            {viewModel.deliverableParts.map((part) => (
              <PartRenderer
                key={part.id}
                part={part}
                sessionId={sessionId}
                runId={message.runId}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantMessageBubble(props: AssistantMessageBubbleProps) {
  if (!CHAT_ACTIVITY_V2_ENABLED) {
    return <LegacyAssistantMessageBubble {...props} />;
  }
  return <AssistantMessageBubbleV2 {...props} />;
}

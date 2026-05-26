"use client";

import { Fragment, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { computeThinkingGaps } from "@/lib/chat-thinking-gap";
import { selectHasAssistantSummaryContent } from "@/lib/chat-message-selectors";
import { buildTurnViewModel } from "@/lib/chat-turn-view-model";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";
import { ThinkingGapRow } from "@/components/chat/parts/ThinkingGapRow";
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

function AssistantStatusLine({
  status,
  waiting,
}: {
  status: ChatMessage["status"];
  waiting: boolean;
}) {
  const text =
    status === "error"
      ? "运行失败"
      : status === "cancelled"
        ? "已中断"
        : waiting
          ? "等待你继续"
          : status === "loading" || status === "streaming"
            ? "正在处理"
            : "已完成";
  const running = status === "loading" || status === "streaming";

  return (
    <div className="chat-assistant-status-line">
      {running ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
      )}
      <span>{text}</span>
    </div>
  );
}

function SectionToggle({
  title,
  defaultOpen,
  badge,
  variant = "panel",
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  variant?: "panel" | "activity";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className={
        variant === "activity"
          ? "chat-activity-group"
          : "rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]/72"
      }
    >
      <button
        type="button"
        className={
          variant === "activity"
            ? "chat-activity-group__summary"
            : "flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)]/60"
        }
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <span>{title}</span>
        {badge ? (
          <span className="ml-auto rounded-full bg-[var(--sidebar-hover)] px-2 py-0.5 text-[10px] text-[var(--fg-tertiary)]">
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className={
            variant === "activity"
              ? "chat-activity-group__body"
              : "border-t border-[var(--border)] px-3 py-3"
          }
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function renderParts(
  parts: ChatPart[],
  gapBefore: Map<string | null, string>,
  onClarificationSubmitted?: (partId: string, answer: string) => void,
  onClarificationContinue?: (answer: string) => void,
  onClarificationDraftChange?: Props["onClarificationDraftChange"],
) {
  return parts.map((part) => (
    <Fragment key={part.id}>
      {gapBefore.has(part.id) ? (
        <ThinkingGapRow label={gapBefore.get(part.id)!} />
      ) : null}
      <PartRenderer
        part={part}
        onClarificationSubmitted={onClarificationSubmitted}
        onClarificationContinue={onClarificationContinue}
        onClarificationDraftChange={onClarificationDraftChange}
      />
    </Fragment>
  ));
}

export function AssistantMessageBubble({
  message,
  thinkingGapMinMs = 3_000,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
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

  const summaryFirstParts = useMemo(() => {
    const parts: ChatPart[] = [];
    if (viewModel.summaryPart) parts.push(viewModel.summaryPart);
    return parts;
  }, [viewModel.summaryPart]);

  const showToolRunningDots =
    (status === "loading" || status === "streaming") &&
    hasRunningToolPart(viewModel.processParts);
  const showSummaryStage =
    summaryFirstParts.length > 0 ||
    (status !== "loading" && status !== "streaming");

  if (
    (status === "loading" || status === "streaming") &&
    !hasSummary &&
    summaryFirstParts.length === 0 &&
    viewModel.processParts.length === 0
  ) {
    return (
      <div className="bubble-assistant">
        <LoadingBubble />
      </div>
    );
  }

  return (
    <div className="bubble-assistant">
      <div className="chat-assistant-message">
        <AssistantStatusLine
          status={status}
          waiting={Boolean(viewModel.waitingMessage)}
        />

        {viewModel.statusPart &&
        (status === "loading" || status === "streaming" || viewModel.waitingMessage) ? (
          <div className="chat-assistant-stage chat-assistant-stage--status">
            <PartRenderer part={viewModel.statusPart} />
          </div>
        ) : null}

        {viewModel.waitingMessage ? (
          <WaitingUserCallout message={viewModel.waitingMessage} />
        ) : null}

        {viewModel.processParts.length > 0 || showToolRunningDots ? (
          <div className="chat-assistant-stage">
            {showToolRunningDots ? <ToolRunningDots label="Activity running…" /> : null}
            {viewModel.processParts.length > 0 ? (
              <SectionToggle
                title="Activity"
                badge={`${viewModel.processParts.length} 项`}
                defaultOpen={status === "loading" || status === "streaming"}
                variant="activity"
              >
                <div className="flex flex-col gap-2.5">
                  {renderParts(
                    viewModel.processParts,
                    gapBefore,
                    onClarificationSubmitted,
                    onClarificationContinue,
                    onClarificationDraftChange,
                  )}
                </div>
              </SectionToggle>
            ) : null}
          </div>
        ) : null}

        {showSummaryStage && summaryFirstParts.length > 0 ? (
          <div className="chat-assistant-stage chat-assistant-stage--summary">
            {renderParts(
              summaryFirstParts,
              gapBefore,
              onClarificationSubmitted,
              onClarificationContinue,
              onClarificationDraftChange,
            )}
          </div>
        ) : null}

        {viewModel.reasoningParts.length > 0 ? (
          <SectionToggle
            title="思考过程"
            badge={`${viewModel.reasoningParts.length} 项`}
          >
            <div className="flex flex-col gap-3">
              {renderParts(viewModel.reasoningParts, gapBefore)}
            </div>
          </SectionToggle>
        ) : null}

        {viewModel.deliverablesPart ? (
          <div className="chat-assistant-stage chat-assistant-stage--deliverables">
            <PartRenderer part={viewModel.deliverablesPart} />
          </div>
        ) : null}

        {status === "error" && summaryFirstParts.length === 0 ? (
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

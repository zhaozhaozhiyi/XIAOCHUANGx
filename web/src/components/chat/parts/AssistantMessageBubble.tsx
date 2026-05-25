"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
};

function LoadingBubble({ hint }: { hint?: string }) {
  return (
    <div className="flex items-center gap-2 text-[var(--fg-secondary)]">
      <span className="inline-flex gap-1" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:300ms]" />
      </span>
      <span className="text-sm">{hint ?? "Agent 处理中…"}</span>
    </div>
  );
}

function connectHint(parts: ChatMessage["parts"]): string | undefined {
  const connecting = parts?.find(
    (part) => part.kind === "status" && part.phase === "connect",
  );
  return connecting?.kind === "status" ? connecting.label : undefined;
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

function SectionToggle({
  title,
  defaultOpen,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]/72">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)]/60"
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
      {open ? <div className="border-t border-[var(--border)] px-3 py-3">{children}</div> : null}
    </div>
  );
}

function renderParts(
  parts: ChatPart[],
  gapBefore: Map<string | null, string>,
) {
  return parts.map((part) => (
    <Fragment key={part.id}>
      {gapBefore.has(part.id) ? (
        <ThinkingGapRow label={gapBefore.get(part.id)!} />
      ) : null}
      <PartRenderer part={part} />
    </Fragment>
  ));
}

export function AssistantMessageBubble({
  message,
  thinkingGapMinMs = 3_000,
}: Props) {
  const status = message.status ?? "complete";
  const connectLabel = connectHint(message.parts);
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

  if (
    (status === "loading" || status === "streaming") &&
    !hasSummary &&
    summaryFirstParts.length === 0 &&
    viewModel.processParts.length === 0
  ) {
    return (
      <div className="bubble-assistant">
        <LoadingBubble hint={connectLabel} />
      </div>
    );
  }

  return (
    <div className="bubble-assistant">
      <div className="chat-assistant-shell">
        <div className="chat-assistant-shell__rail" aria-hidden />
        <div className="chat-assistant-shell__body">
          <div className="chat-assistant-shell__header">
            <span className="chat-assistant-shell__title">执行结果</span>
            <span className="chat-assistant-shell__status">
              {status === "error"
                ? "失败"
                : status === "cancelled"
                  ? "已中断"
                  : viewModel.waitingMessage
                    ? "待继续"
                    : status === "loading" || status === "streaming"
                      ? "进行中"
                      : "已完成"}
            </span>
          </div>

          <div className="flex flex-col gap-3.5">
            {viewModel.statusPart &&
            (status === "loading" || status === "streaming" || viewModel.waitingMessage) ? (
              <div className="chat-assistant-shell__stage">
                <div className="chat-assistant-shell__section-label">执行状态</div>
                <div className="text-xs text-[var(--fg-tertiary)]">
                  <PartRenderer part={viewModel.statusPart} />
                </div>
              </div>
            ) : null}

            {viewModel.waitingMessage ? (
              <WaitingUserCallout message={viewModel.waitingMessage} />
            ) : null}

            {viewModel.processParts.length > 0 || showToolRunningDots ? (
              <div className="chat-assistant-shell__stage">
                <div className="chat-assistant-shell__section-label">执行过程</div>
                {showToolRunningDots ? <ToolRunningDots /> : null}
                {viewModel.processParts.length > 0 ? (
                  <SectionToggle
                    title="查看处理过程"
                    badge={`${viewModel.processParts.length} 项`}
                    defaultOpen={status === "loading" || status === "streaming"}
                  >
                    <div className="flex flex-col gap-3">
                      {renderParts(viewModel.processParts, gapBefore)}
                    </div>
                  </SectionToggle>
                ) : null}
              </div>
            ) : null}

            <div className="chat-assistant-shell__stage">
              <div className="chat-assistant-shell__section-label">最终回复</div>
              {summaryFirstParts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {renderParts(summaryFirstParts, gapBefore)}
                </div>
              ) : status === "streaming" ? (
                <p className="text-sm text-[var(--fg-secondary)]">
                  {connectLabel ?? "等待输出…"}
                </p>
              ) : null}
            </div>

            {viewModel.debugParts.length > 0 ? (
              <SectionToggle title="技术详情" badge={`${viewModel.debugParts.length} 项`}>
                <div className="flex flex-col gap-3">
                  {renderParts(viewModel.debugParts, gapBefore)}
                </div>
              </SectionToggle>
            ) : null}

            {viewModel.deliverablesPart ? (
              <div className="chat-assistant-shell__stage">
                <div className="chat-assistant-shell__section-label">交付物</div>
                <div className="pt-1">
                  <PartRenderer part={viewModel.deliverablesPart} />
                </div>
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
      </div>
    </div>
  );
}

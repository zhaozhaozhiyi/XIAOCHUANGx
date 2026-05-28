"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { isRenderablePart, normalizeMarkdown } from "@/lib/chat-parts-utils";
import { ArtifactRow } from "@/components/chat/parts/ArtifactRow";
import { DeliverablesCard } from "@/components/chat/parts/DeliverablesCard";
import { ImagePartCard } from "@/components/chat/parts/ImagePartCard";
import { CitationPartCard } from "@/components/chat/parts/CitationPartCard";
import { JsonPartCard } from "@/components/chat/parts/JsonPartCard";
import { ResearchMapCard } from "@/components/chat/parts/ResearchMapCard";
import { UnsupportedPartCard } from "@/components/chat/parts/UnsupportedPartCard";
import {
  DocumentEditRow,
  DocumentReadRow,
  FileEditRow,
  FileReadRow,
} from "@/components/chat/parts/FileDiffRow";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { ClarificationCard } from "@/components/chat/parts/ClarificationCard";
import { TodoBlock } from "@/components/chat/parts/TodoBlock";
import { ToolBatchCard } from "@/components/chat/parts/ToolBatchCard";
import { ToolCardRow } from "@/components/chat/parts/ToolCardRow";
import { TurnMetaBar } from "@/components/chat/parts/TurnMetaBar";
import { TimelineCollapsible } from "@/components/chat/parts/TimelineCollapsible";
import { BadgePlus, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  activityChipClass,
  activityTone,
} from "@/lib/activity-status-tone";

export type PartPresentation = "default" | "timeline";

function StatusChip({ part }: { part: Extract<ChatPart, { kind: "status" }> }) {
  const tone = activityTone(part.label, part.phase);
  return (
    <div className={activityChipClass(tone)}>
      <span className="chat-activity-chip__dot" aria-hidden />
      <span>{part.label}</span>
      {part.phase && (
        <span className="chat-activity-chip__phase">· {part.phase}</span>
      )}
    </div>
  );
}

function StatusChipTag({
  part,
}: {
  part: Extract<ChatPart, { kind: "status_chip" }>;
}) {
  return (
    <span className="inline-flex rounded-md bg-[#e8f1ff] px-2 py-0.5 font-mono text-xs text-[#2563eb]">
      {part.chip}
    </span>
  );
}

function ReasoningBlock({
  part,
  presentation = "default",
}: {
  part: Extract<ChatPart, { kind: "reasoning" }>;
  presentation?: PartPresentation;
}) {
  const [open, setOpen] = useState(false);
  const text = normalizeMarkdown(part.markdown);

  if (presentation === "timeline") {
    if (!text && !part.streaming) return null;
    return (
      <TimelineCollapsible
        text={text}
        streaming={part.streaming}
        completeLabel="结束"
        className="chat-timeline-reasoning"
      />
    );
  }

  return (
    <div className="chat-part-reasoning rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-[var(--fg-secondary)]"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        推理过程
        {part.streaming && (
          <span className="ml-1 text-[var(--accent)]">进行中</span>
        )}
      </button>
      {open && (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-[var(--border)] px-3 py-2 font-mono text-xs text-[var(--fg-secondary)]">
          {text}
        </pre>
      )}
    </div>
  );
}

function NarrationBlock({
  part,
  presentation = "default",
}: {
  part: Extract<ChatPart, { kind: "narration" }>;
  presentation?: PartPresentation;
}) {
  if (presentation === "timeline") {
    return (
      <div className="chat-timeline-narration text-[15px] leading-relaxed text-[var(--fg)]">
        <ChatMarkdown markdown={normalizeMarkdown(part.markdown)} />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)]/70 bg-[var(--surface)]/55 px-3 py-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-[var(--fg-tertiary)]">
        <span>{part.streaming ? "当前动作" : "执行说明"}</span>
        {part.streaming ? (
          <span className="text-[var(--accent)]">进行中</span>
        ) : null}
      </div>
      <ChatMarkdown markdown={normalizeMarkdown(part.markdown)} />
    </div>
  );
}

function SkillBlock({
  part,
}: {
  part: Extract<ChatPart, { kind: "skill" }>;
}) {
  const roleLabel =
    part.role === "platform"
      ? "平台规范"
      : part.role === "catalog"
        ? "候选扩展"
        : part.role === "injected"
          ? "注入能力"
          : "流程 Skill";
  return (
    <div className="chat-part-row flex gap-2 text-sm">
      <BadgePlus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-[var(--fg)]">{part.label ?? part.slug}</span>
          <span className="rounded bg-[var(--accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--fg-secondary)]">
            {roleLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--fg-tertiary)]">{part.slug}</p>
      </div>
    </div>
  );
}

function ErrorInline({ part }: { part: Extract<ChatPart, { kind: "error" }> }) {
  return (
    <p className="text-sm text-[var(--danger)]">
      {part.message}
      {part.code && (
        <span className="ml-1 text-xs opacity-80">({part.code})</span>
      )}
    </p>
  );
}

function SummaryMarkdown({
  part,
}: {
  part: Extract<ChatPart, { kind: "summary" | "text" }>;
}) {
  const text = normalizeMarkdown(part.markdown);
  if (!text && !part.streaming) return null;
  return <ChatMarkdown markdown={text} streaming={part.streaming} />;
}

export function PartRenderer({
  part,
  presentation = "default",
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
}: {
  part: ChatPart;
  presentation?: PartPresentation;
  onClarificationSubmitted?: (partId: string, answer: string) => void;
  onClarificationContinue?: (answer: string) => void;
  onClarificationDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      draft?: string;
    },
  ) => void;
}) {
  if (!isRenderablePart(part)) return null;
  switch (part.kind) {
    case "summary":
    case "text":
      return <SummaryMarkdown part={part} />;
    case "turn_meta":
      return <TurnMetaBar part={part} />;
    case "tool_batch":
      return <ToolBatchCard part={part} presentation={presentation} />;
    case "tool":
    case "command":
      return <ToolCardRow part={part} presentation={presentation} />;
    case "status":
      return <StatusChip part={part} />;
    case "status_chip":
      return <StatusChipTag part={part} />;
    case "reasoning":
      return <ReasoningBlock part={part} presentation={presentation} />;
    case "narration":
      return <NarrationBlock part={part} presentation={presentation} />;
    case "skill":
      return <SkillBlock part={part} />;
    case "todo":
      return <TodoBlock part={part} />;
    case "clarification":
      return (
        <ClarificationCard
          part={part}
          onSubmitted={onClarificationSubmitted}
          onContinueAsMessage={onClarificationContinue}
          onDraftChange={onClarificationDraftChange}
        />
      );
    case "file_read":
      return <FileReadRow part={part} presentation={presentation} />;
    case "document_read":
      return <DocumentReadRow part={part} presentation={presentation} />;
    case "file_edit":
      return <FileEditRow part={part} presentation={presentation} />;
    case "document_edit":
      return <DocumentEditRow part={part} presentation={presentation} />;
    case "artifact":
      return <ArtifactRow part={part} />;
    case "deliverables":
      return <DeliverablesCard part={part} />;
    case "image":
      return <ImagePartCard part={part} />;
    case "citation":
      return <CitationPartCard part={part} />;
    case "json":
      return <JsonPartCard part={part} />;
    case "research_map":
      return <ResearchMapCard part={part} />;
    case "error":
      return <ErrorInline part={part} />;
    default:
      return <UnsupportedPartCard part={part} presentation={presentation} />;
  }
}

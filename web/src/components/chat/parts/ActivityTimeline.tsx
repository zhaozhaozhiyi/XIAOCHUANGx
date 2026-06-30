"use client";

import { Fragment } from "react";
import type { ChatPart, OutlineCommitPayload } from "@/lib/chat-parts";
import { activityStepMeta } from "@/lib/activity-step-meta";
import { PartRenderer, type PartPresentation } from "@/components/chat/parts/PartRenderer";
import { ThinkingGapRow } from "@/components/chat/parts/ThinkingGapRow";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FilePen,
  FileText,
  FolderSearch,
  Loader2,
  Terminal,
} from "lucide-react";
import { useState } from "react";

function isTimelineEpisode(part: ChatPart): boolean {
  return (
    part.kind !== "narration" &&
    part.kind !== "text" &&
    part.kind !== "summary"
  );
}

function StepIcon({
  kind,
  running,
}: {
  kind: ReturnType<typeof activityStepMeta>["icon"];
  running: boolean;
}) {
  const className = `h-4 w-4 shrink-0 ${running ? "text-[var(--accent)]" : "text-[var(--fg-tertiary)]"}`;
  if (running && kind === "reasoning") {
    return (
      <Clock3
        className={`${className} animate-pulse`}
        strokeWidth={1.75}
        aria-hidden
      />
    );
  }
  if (running) {
    return <Loader2 className={`${className} animate-spin`} aria-hidden />;
  }
  switch (kind) {
    case "reasoning":
      return <Clock3 className={className} strokeWidth={1.75} aria-hidden />;
    case "run":
      return <Terminal className={className} strokeWidth={1.75} aria-hidden />;
    case "batch":
      return <FolderSearch className={className} strokeWidth={1.75} aria-hidden />;
    case "file":
      return <FileText className={className} strokeWidth={1.75} aria-hidden />;
    default:
      return <FilePen className={className} strokeWidth={1.75} aria-hidden />;
  }
}

function ActivityTimelineStep({
  part,
  isLastEpisode,
  presentation,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: {
  part: ChatPart;
  isLastEpisode: boolean;
  presentation: PartPresentation;
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
}) {
  const meta = activityStepMeta(part);
  const canCollapse = meta.episodeLabel === "思考过程";
  const showDoneMarker = meta.complete && !!meta.episodeLabel;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`chat-activity-step${meta.running ? " chat-activity-step--running" : ""}${meta.complete ? " chat-activity-step--complete" : ""}${isLastEpisode ? " chat-activity-step--last" : ""}${meta.episodeLabel ? "" : " chat-activity-step--no-label"}`}
      aria-label={meta.ariaLabel}
    >
      <div className="chat-activity-step__rail" aria-hidden>
        <div className="chat-activity-step__icon">
          <StepIcon kind={meta.icon} running={meta.running} />
        </div>
        <div className="chat-activity-step__connector">
          <div className="chat-activity-step__line chat-activity-step__line--head" />
          {showDoneMarker ? (
            <div className="chat-activity-step__done">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
          ) : null}
          <div className="chat-activity-step__line chat-activity-step__line--grow" />
          {!isLastEpisode ? (
            <div className="chat-activity-step__line chat-activity-step__line--tail" />
          ) : null}
        </div>
      </div>
      {meta.episodeLabel ? (
        <div className="chat-activity-step__head">
          {canCollapse ? (
            <button
              type="button"
              className="chat-activity-step__collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "展开思考过程" : "收起思考过程"}
              title={collapsed ? "展开思考过程" : "收起思考过程"}
            >
              <span className="chat-activity-step__label">{meta.episodeLabel}</span>
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>
          ) : (
            <div className="chat-activity-step__label">{meta.episodeLabel}</div>
          )}
        </div>
      ) : null}
      {!collapsed ? (
        <div className="chat-activity-step__body">
          <PartRenderer
            part={part}
            presentation={presentation}
            onClarificationSubmitted={onClarificationSubmitted}
            onClarificationContinue={onClarificationContinue}
            onClarificationDraftChange={onClarificationDraftChange}
            onRequirementsSubmitted={onRequirementsSubmitted}
            onRequirementsContinue={onRequirementsContinue}
            onRequirementsDraftChange={onRequirementsDraftChange}
            onOutlineCommitted={onOutlineCommitted}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ActivityProcessList({
  parts,
  gapBefore,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: {
  parts: ChatPart[];
  gapBefore: Map<string | null, string>;
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
}) {
  if (parts.length === 0) return null;

  return (
    <div className="chat-activity-timeline">
      {parts.map((part, index) => {
        const gap = gapBefore.has(part.id) ? (
          <ThinkingGapRow label={gapBefore.get(part.id)!} />
        ) : null;

        if (!isTimelineEpisode(part)) {
          return (
            <Fragment key={part.id}>
              {gap}
              <div className="chat-activity-interstitial">
                <PartRenderer
                  part={part}
                  presentation="timeline"
                  onClarificationSubmitted={onClarificationSubmitted}
                  onClarificationContinue={onClarificationContinue}
                  onClarificationDraftChange={onClarificationDraftChange}
                  onRequirementsSubmitted={onRequirementsSubmitted}
                  onRequirementsContinue={onRequirementsContinue}
                  onRequirementsDraftChange={onRequirementsDraftChange}
                  onOutlineCommitted={onOutlineCommitted}
                />
              </div>
            </Fragment>
          );
        }

        const isLastEpisode = !parts
          .slice(index + 1)
          .some((candidate) => isTimelineEpisode(candidate));

        return (
          <Fragment key={part.id}>
            {gap}
            <ActivityTimelineStep
              part={part}
              isLastEpisode={isLastEpisode}
              presentation="timeline"
              onClarificationSubmitted={onClarificationSubmitted}
              onClarificationContinue={onClarificationContinue}
              onClarificationDraftChange={onClarificationDraftChange}
              onRequirementsSubmitted={onRequirementsSubmitted}
              onRequirementsContinue={onRequirementsContinue}
              onRequirementsDraftChange={onRequirementsDraftChange}
              onOutlineCommitted={onOutlineCommitted}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

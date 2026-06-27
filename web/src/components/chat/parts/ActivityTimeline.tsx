"use client";

import { Fragment } from "react";
import type { ChatPart } from "@/lib/chat-parts";
import { activityStepMeta } from "@/lib/activity-step-meta";
import { PartRenderer, type PartPresentation } from "@/components/chat/parts/PartRenderer";
import { ThinkingGapRow } from "@/components/chat/parts/ThinkingGapRow";
import {
  CheckCircle2,
  Clock3,
  FilePen,
  FileText,
  FolderSearch,
  Loader2,
  Terminal,
} from "lucide-react";

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
}) {
  const meta = activityStepMeta(part);

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
          {meta.complete ? (
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
          <div className="chat-activity-step__label">{meta.episodeLabel}</div>
        </div>
      ) : null}
      <div className="chat-activity-step__body">
        <PartRenderer
          part={part}
          presentation={presentation}
          onClarificationSubmitted={onClarificationSubmitted}
          onClarificationContinue={onClarificationContinue}
          onClarificationDraftChange={onClarificationDraftChange}
        />
      </div>
    </div>
  );
}

export function ActivityProcessList({
  parts,
  gapBefore,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
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
            />
          </Fragment>
        );
      })}
    </div>
  );
}

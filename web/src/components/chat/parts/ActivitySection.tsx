"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleStop,
  Loader2,
} from "lucide-react";
import type { ActivityCollapse } from "@/lib/chat-parts";
import {
  resolveActivityProcessExpanded,
  type ActivityViewModel,
} from "@/lib/chat-activity-view-model";
import { isTurnActive } from "@/lib/chat-turn-display-state";
import { ActivityEvidenceList } from "@/components/chat/parts/ActivityEvidenceList";
import { ActivityProcessList } from "@/components/chat/parts/ActivityTimeline";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";

function SummaryIcon({ model }: { model: ActivityViewModel }) {
  if (isTurnActive(model.state)) {
    return <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />;
  }
  if (model.state === "error") {
    return <AlertCircle className="h-3.5 w-3.5 text-[var(--danger)]" aria-hidden />;
  }
  if (model.state === "cancelled") {
    return <CircleStop className="h-3.5 w-3.5 text-[var(--warn)]" aria-hidden />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />;
}

function selectedSegments(model: ActivityViewModel) {
  const ranked = model.summarySegments
    .map((segment, index) => ({ segment, index }))
    .sort((left, right) => right.segment.priority - left.segment.priority);
  const mobileKeys = new Set(
    ranked
      .slice(0, 2)
      .map(({ segment }) => `${segment.kind}:${segment.fullText}`),
  );
  const selected = ranked
    .slice(0, 4)
    .sort((left, right) => left.index - right.index)
    .map(({ segment }) => segment);
  return {
    selected,
    mobileKeys,
    hiddenCount: Math.max(0, model.summarySegments.length - selected.length),
  };
}

export function ActivitySection({
  model,
  collapse,
  gapBefore,
  sessionId,
  runId,
  sticky = false,
  onCollapseChange,
  onDisclosureIntent,
}: {
  model: ActivityViewModel;
  collapse?: ActivityCollapse;
  gapBefore: Map<string | null, string>;
  sessionId?: string;
  runId?: string;
  sticky?: boolean;
  onCollapseChange?: (collapse: ActivityCollapse) => void;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [localCollapse, setLocalCollapse] = useState<ActivityCollapse | undefined>(
    collapse,
  );
  const effectiveCollapse = onCollapseChange ? collapse : localCollapse;
  const expanded = resolveActivityProcessExpanded(effectiveCollapse, model.state);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const { selected, mobileKeys, hiddenCount } = useMemo(
    () => selectedSegments(model),
    [model],
  );
  const detailsId = `activity-details-${model.activityParts[0]?.id ?? "turn"}`;
  const showPreview = !expanded && Boolean(model.latestNarrationPreview);
  const hasThinking = model.reasoningParts.length > 0;
  const hasTechnical = model.technicalParts.length > 0;

  useEffect(() => {
    if (!onCollapseChange) setLocalCollapse(collapse);
  }, [collapse, onCollapseChange]);

  const toggle = (trigger: HTMLElement) => {
    onDisclosureIntent?.(trigger);
    const next: ActivityCollapse = expanded ? "user_collapsed" : "user_expanded";
    if (onCollapseChange) onCollapseChange(next);
    else setLocalCollapse(next);
  };

  return (
    <section
      className="chat-activity-section"
      data-state={model.state}
      data-expanded={expanded ? "true" : "false"}
      data-testid="activity-section"
    >
      <div
        className={
          sticky ? "chat-activity-section__sticky-bar" : "chat-activity-section__bar"
        }
      >
        <button
          type="button"
          className="chat-activity-summary"
          onClick={(event) => toggle(event.currentTarget)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          aria-label={`${expanded ? "收起" : "展开"}处理过程：${model.summaryLabel}`}
        >
          <span className="chat-activity-summary__status">
            <SummaryIcon model={model} />
          </span>
          <span className="chat-activity-summary__prefix">处理过程</span>
          <span className="chat-activity-summary__segments">
            {selected.map((segment, index) => {
              const key = `${segment.kind}:${segment.fullText}`;
              return (
              <span
                key={key}
                className={`chat-activity-summary__segment${mobileKeys.has(key) ? "" : " chat-activity-summary__segment--mobile-hidden"}`}
                data-kind={segment.kind}
                data-priority={segment.priority}
              >
                {index > 0 ? <span aria-hidden> · </span> : null}
                <span className="chat-activity-summary__segment-full">{segment.fullText}</span>
                <span className="chat-activity-summary__segment-compact">{segment.compactText}</span>
              </span>
              );
            })}
            {hiddenCount > 0 ? (
              <span className="chat-activity-summary__overflow"> · 另 {hiddenCount} 项</span>
            ) : null}
          </span>
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>

        {showPreview ? (
          <div
            className="chat-activity-narration-preview"
            data-testid="activity-narration-preview"
          >
            <span className="chat-activity-narration-preview__label">最近旁白</span>
            <span className="chat-activity-narration-preview__text">
              {model.latestNarrationPreview}
            </span>
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div id={detailsId} className="chat-activity-details">
          <ActivityEvidenceList
            episodes={model.episodes}
            onDisclosureIntent={onDisclosureIntent}
          />

          {hasThinking ? (
            <div className="chat-activity-thinking">
              <button
                type="button"
                className="chat-activity-thinking__toggle"
                onClick={(event) => {
                  onDisclosureIntent?.(event.currentTarget);
                  setThinkingOpen((value) => !value);
                }}
                aria-expanded={thinkingOpen}
                data-testid="activity-thinking-toggle"
              >
                {thinkingOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
                思考过程
              </button>
              {thinkingOpen ? (
                <div className="chat-activity-thinking__body">
                  {model.reasoningParts.map((part) => (
                    <PartRenderer
                      key={part.id}
                      part={part}
                      presentation="timeline"
                      onDisclosureIntent={onDisclosureIntent}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {hasTechnical ? (
            <div className="chat-activity-technical">
              <button
                type="button"
                className="chat-activity-technical__toggle"
                onClick={(event) => {
                  onDisclosureIntent?.(event.currentTarget);
                  setTechnicalOpen((value) => !value);
                }}
                aria-expanded={technicalOpen}
              >
                {technicalOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
                技术详情
              </button>
              {technicalOpen ? (
                <div className="chat-activity-technical__body">
                  <ActivityProcessList
                    parts={model.technicalParts}
                    gapBefore={gapBefore}
                    sessionId={sessionId}
                    runId={runId}
                    onDisclosureIntent={onDisclosureIntent}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

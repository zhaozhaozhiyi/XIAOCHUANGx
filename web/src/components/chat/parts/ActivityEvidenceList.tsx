"use client";

import { useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FilePen,
  FileText,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import type {
  ActivityEpisode,
  ActivityFamily,
  ActivityOccurrence,
} from "@/lib/chat-activity-view-model";
import { shouldCollapseNarrationInline } from "@/lib/chat-activity-view-model";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";

const FAMILY_ORDER: ActivityFamily[] = [
  "read",
  "search",
  "edit",
  "command",
  "other",
];

function FamilyIcon({ family }: { family: ActivityFamily }) {
  const className = "h-3 w-3 shrink-0";
  if (family === "read") return <FileText className={className} aria-hidden />;
  if (family === "edit") return <FilePen className={className} aria-hidden />;
  if (family === "search") return <Search className={className} aria-hidden />;
  if (family === "command") return <Terminal className={className} aria-hidden />;
  return <Wrench className={className} aria-hidden />;
}

function familyActionLabel(family: ActivityFamily, count: number): string {
  switch (family) {
    case "read":
      return `已读取 ${count} 个文件`;
    case "search":
      return `已搜索 ${count} 次`;
    case "edit":
      return `已编辑 ${count} 个文件`;
    case "command":
      return `已运行 ${count} 条命令`;
    default:
      return `已处理 ${count} 项`;
  }
}

type FamilyGroup = {
  family: ActivityFamily;
  count: number;
  status: ActivityOccurrence["status"];
  occurrences: ActivityOccurrence[];
};

function groupByFamily(occurrences: ActivityOccurrence[]): FamilyGroup[] {
  const groups = new Map<ActivityFamily, FamilyGroup>();
  for (const occurrence of occurrences) {
    const existing = groups.get(occurrence.family);
    if (!existing) {
      groups.set(occurrence.family, {
        family: occurrence.family,
        count: occurrence.count,
        status: occurrence.status,
        occurrences: [occurrence],
      });
      continue;
    }
    existing.count += occurrence.count;
    existing.occurrences.push(occurrence);
    if (occurrence.status === "error") existing.status = "error";
    else if (occurrence.status === "running" && existing.status !== "error") {
      existing.status = "running";
    }
  }
  return FAMILY_ORDER.filter((family) => groups.has(family)).map(
    (family) => groups.get(family)!,
  );
}

function canReuseFileRenderer(occurrence: ActivityOccurrence): boolean {
  const kind = occurrence.representativePart.kind;
  return (
    kind === "file_read" ||
    kind === "document_read" ||
    kind === "file_edit" ||
    kind === "document_edit"
  );
}

function EvidenceRow({ occurrence }: { occurrence: ActivityOccurrence }) {
  if (canReuseFileRenderer(occurrence)) {
    return (
      <div className="chat-activity-evidence__file-row">
        <PartRenderer part={occurrence.representativePart} presentation="timeline" />
        {occurrence.count > 1 ? (
          <span className="chat-activity-evidence__count">×{occurrence.count}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="chat-activity-evidence__row">
      <span
        className="min-w-0 flex-1 truncate"
        title={occurrence.resourceLabel ?? occurrence.label}
      >
        {occurrence.resourceLabel ?? occurrence.label}
      </span>
      {occurrence.count > 1 ? (
        <span className="chat-activity-evidence__count">×{occurrence.count}</span>
      ) : null}
      {occurrence.status === "error" ? (
        <span className="shrink-0 text-[11px] text-[var(--danger)]">失败</span>
      ) : occurrence.status === "running" ? (
        <span className="shrink-0 text-[11px] text-[var(--activity-running-fg)]">
          进行中
        </span>
      ) : null}
    </div>
  );
}

function ActionBadge({
  group,
  onDisclosureIntent,
}: {
  group: FamilyGroup;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chat-activity-action" data-status={group.status}>
      <button
        type="button"
        className="chat-activity-action__badge"
        onClick={(event) => {
          onDisclosureIntent?.(event.currentTarget);
          setOpen((value) => !value);
        }}
        aria-expanded={open}
      >
        {group.status === "running" ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
        ) : group.status === "error" ? (
          <AlertCircle className="h-3 w-3 shrink-0 text-[var(--danger)]" aria-hidden />
        ) : (
          <FamilyIcon family={group.family} />
        )}
        <span className="chat-activity-action__label">
          {familyActionLabel(group.family, group.count)}
        </span>
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="chat-activity-action__detail">
          {group.occurrences.map((occurrence) => (
            <EvidenceRow key={occurrence.occurrenceId} occurrence={occurrence} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NarrationBody({
  markdown,
  streaming,
  onDisclosureIntent,
}: {
  markdown: string;
  streaming?: boolean;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = normalizeMarkdown(markdown).trim();
  const needsCollapse = shouldCollapseNarrationInline(text);
  const collapsed =
    needsCollapse && !expanded ? `${text.slice(0, 360).trimEnd()}…` : text;

  return (
    <div
      className="chat-activity-evidence__narration"
      data-streaming={streaming ? "true" : undefined}
    >
      <ChatMarkdown markdown={collapsed} streaming={streaming} />
      {needsCollapse ? (
        <button
          type="button"
          className="chat-activity-evidence__narration-more"
          onClick={(event) => {
            onDisclosureIntent?.(event.currentTarget);
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
        >
          {expanded ? "收起旁白" : "显示全部旁白"}
        </button>
      ) : null}
    </div>
  );
}

function EpisodeBlock({
  episode,
  onDisclosureIntent,
}: {
  episode: ActivityEpisode;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const hasNarration = episode.narrations.length > 0;
  const groups = groupByFamily(episode.occurrences);

  return (
    <div className="chat-activity-evidence__episode">
      {hasNarration ? (
        episode.narrations.map((narration) => (
          <NarrationBody
            key={narration.partId}
            markdown={narration.markdown}
            streaming={narration.streaming}
            onDisclosureIntent={onDisclosureIntent}
          />
        ))
      ) : (
        <div className="chat-activity-evidence__stage">{episode.label}</div>
      )}
      {groups.length > 0 ? (
        <div className="chat-activity-evidence__actions">
          {groups.map((group) => (
            <ActionBadge
              key={`${episode.episodeId}:${group.family}`}
              group={group}
              onDisclosureIntent={onDisclosureIntent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ActivityEvidenceList({
  episodes,
  onDisclosureIntent,
}: {
  episodes: ActivityEpisode[];
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [showEarlier, setShowEarlier] = useState(false);
  const needsEarlier = episodes.length > 12;
  const hiddenCount = needsEarlier ? episodes.length - 8 : 0;
  const visible = needsEarlier && !showEarlier ? episodes.slice(-8) : episodes;

  if (episodes.length === 0) return null;

  return (
    <div className="chat-activity-evidence" data-testid="activity-evidence-list">
      {needsEarlier ? (
        <button
          type="button"
          className="chat-activity-evidence__earlier"
          onClick={(event) => {
            onDisclosureIntent?.(event.currentTarget);
            setShowEarlier((value) => !value);
          }}
          aria-expanded={showEarlier}
        >
          {showEarlier ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
          {showEarlier ? "收起更早步骤" : `更早 ${hiddenCount} 个步骤`}
        </button>
      ) : null}
      {visible.map((episode) => (
        <EpisodeBlock
          key={episode.episodeId}
          episode={episode}
          onDisclosureIntent={onDisclosureIntent}
        />
      ))}
    </div>
  );
}

"use client";

import {
  useId,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
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
  ActivityFamily,
  ActivityOccurrence,
  ActivityOccurrenceStatus,
  ProcessTimelineNode,
} from "@/lib/chat-activity-view-model";
import { shouldCollapseNarrationInline } from "@/lib/chat-activity-view-model";
import { sanitizeActivityDetail } from "@/lib/activity-detail-sanitize";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { PartRenderer } from "@/components/chat/parts/PartRenderer";

type ForwardedRendererProps = Omit<
  ComponentProps<typeof PartRenderer>,
  "part" | "presentation"
>;

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

function actionGroupLabel(occurrences: ActivityOccurrence[]): string {
  const counts = new Map<ActivityFamily, number>();
  const order: ActivityFamily[] = [];
  for (const occurrence of occurrences) {
    if (!counts.has(occurrence.family)) order.push(occurrence.family);
    counts.set(
      occurrence.family,
      (counts.get(occurrence.family) ?? 0) + occurrence.count,
    );
  }
  return order
    .map((family) => familyActionLabel(family, counts.get(family) ?? 0))
    .join(" · ");
}

function groupStatus(
  occurrences: ActivityOccurrence[],
): ActivityOccurrenceStatus {
  if (occurrences.some((item) => item.status === "running")) return "running";
  if (occurrences.some((item) => item.status === "error")) return "error";
  if (occurrences.some((item) => item.status === "cancelled")) return "cancelled";
  return "success";
}

function canReusePartRenderer(occurrence: ActivityOccurrence): boolean {
  const kind = occurrence.representativePart.kind;
  return (
    kind === "file_read" ||
    kind === "document_read" ||
    kind === "file_edit" ||
    kind === "document_edit" ||
    kind === "command" ||
    kind === "tool"
  );
}

function EvidenceRow({ occurrence }: { occurrence: ActivityOccurrence }) {
  if (canReusePartRenderer(occurrence)) {
    return (
      <div className="chat-activity-evidence__file-row">
        <PartRenderer
          part={occurrence.representativePart}
          presentation="timeline"
        />
        {occurrence.count > 1 ? (
          <span className="chat-activity-evidence__count">x{occurrence.count}</span>
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
        <span className="chat-activity-evidence__count">x{occurrence.count}</span>
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

function ActionGroup({
  occurrences,
  detailsExpanded,
  onDisclosureIntent,
}: {
  occurrences: ActivityOccurrence[];
  detailsExpanded: boolean;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const detailsId = useId();
  const open = openOverride ?? detailsExpanded;
  const status = groupStatus(occurrences);
  const label = useMemo(() => actionGroupLabel(occurrences), [occurrences]);
  const families = new Set(occurrences.map((item) => item.family));
  const iconFamily =
    families.size === 1 ? occurrences[0]?.family ?? "other" : "other";

  return (
    <div className="chat-activity-action" data-status={status}>
      <button
        type="button"
        className="chat-activity-action__badge"
        onClick={(event) => {
          onDisclosureIntent?.(event.currentTarget);
          setOpenOverride(!open);
        }}
        aria-expanded={open}
        aria-controls={detailsId}
      >
        {status === "running" ? (
          <Loader2
            className="h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : status === "error" ? (
          <AlertCircle
            className="h-3 w-3 shrink-0 text-[var(--danger)]"
            aria-hidden
          />
        ) : (
          <FamilyIcon family={iconFamily} />
        )}
        <span className="chat-activity-action__label">{label}</span>
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={detailsId} className="chat-activity-action__detail">
          {occurrences.map((occurrence) => (
            <EvidenceRow
              key={`${occurrence.occurrenceId}:${occurrence.firstStreamSeq}`}
              occurrence={occurrence}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NarrationBody({
  markdown,
  streaming,
  forceExpanded = false,
  onDisclosureIntent,
}: {
  markdown: string;
  streaming?: boolean;
  forceExpanded?: boolean;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const text = normalizeMarkdown(markdown).trim();
  const needsCollapse = shouldCollapseNarrationInline(text);
  const collapsed =
    needsCollapse && !expanded && !forceExpanded
      ? `${text.slice(0, 360).trimEnd()}...`
      : text;

  return (
    <div
      className="chat-activity-evidence__narration"
      data-streaming={streaming ? "true" : undefined}
    >
      <ChatMarkdown markdown={collapsed} streaming={streaming} />
      {needsCollapse && !forceExpanded ? (
        <button
          type="button"
          className="chat-activity-evidence__narration-more"
          onClick={(event) => {
            onDisclosureIntent?.(event.currentTarget);
            setExpanded((value) => !value);
          }}
          aria-expanded={expanded}
        >
          {expanded ? "收起说明" : "显示全部说明"}
        </button>
      ) : null}
    </div>
  );
}

function ReasoningBody({
  part,
  forceExpanded,
  onDisclosureIntent,
}: {
  part: Extract<ProcessTimelineNode, { type: "reasoning" }>["part"];
  forceExpanded: boolean;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  const sanitized = sanitizeActivityDetail(part.markdown);
  const markdown = typeof sanitized === "string" ? sanitized : "";

  if (!markdown.trim() && part.streaming) {
    return (
      <div className="chat-activity-evidence__reasoning-loading">
        <Loader2
          className="h-3 w-3 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
        <span>正在思考</span>
      </div>
    );
  }
  if (!markdown.trim()) return null;

  return (
    <NarrationBody
      markdown={markdown}
      streaming={part.streaming}
      forceExpanded={forceExpanded}
      onDisclosureIntent={onDisclosureIntent}
    />
  );
}

export function ActivityEvidenceList({
  nodes,
  detailsExpanded,
  rendererProps,
  onDisclosureIntent,
}: {
  nodes: ProcessTimelineNode[];
  detailsExpanded: boolean;
  rendererProps?: ForwardedRendererProps;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
}) {
  if (nodes.length === 0) return null;

  return (
    <div className="chat-activity-evidence" data-testid="activity-evidence-list">
      {nodes.map((node) => {
        if (node.type === "narration") {
          return (
            <div
              key={node.nodeId}
              className="chat-activity-evidence__episode"
              data-node-kind="narration"
            >
              <NarrationBody
                markdown={node.part.markdown}
                streaming={node.part.streaming}
                forceExpanded={detailsExpanded}
                onDisclosureIntent={onDisclosureIntent}
              />
            </div>
          );
        }
        if (node.type === "reasoning") {
          return (
            <div
              key={node.nodeId}
              className="chat-activity-evidence__episode"
              data-node-kind="reasoning"
            >
              <ReasoningBody
                part={node.part}
                forceExpanded={detailsExpanded}
                onDisclosureIntent={onDisclosureIntent}
              />
            </div>
          );
        }
        if (node.type === "actions") {
          return (
            <div
              key={node.nodeId}
              className="chat-activity-evidence__episode"
              data-node-kind="actions"
            >
              <ActionGroup
                occurrences={node.occurrences}
                detailsExpanded={detailsExpanded}
                onDisclosureIntent={onDisclosureIntent}
              />
            </div>
          );
        }
        return (
          <div
            key={node.nodeId}
            className="chat-activity-evidence__checkpoint"
            data-node-kind="checkpoint"
            data-part-kind={node.part.kind}
          >
            <PartRenderer
              {...rendererProps}
              part={node.part}
              presentation="timeline"
              onDisclosureIntent={onDisclosureIntent}
            />
          </div>
        );
      })}
    </div>
  );
}

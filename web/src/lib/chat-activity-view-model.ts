import type { ChatMessage } from "@/lib/chat";
import type { ActivityCollapse, ChatPart, ToolBatchItem } from "@/lib/chat-parts";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import {
  resolveTurnDisplayState,
  waitingUserMessage,
  type TurnDisplayState,
} from "@/lib/chat-turn-display-state";
import { classifyToolFamily } from "@/lib/tool-family";
import { sanitizeActivityDetail } from "@/lib/activity-detail-sanitize";

export type ActivityFamily = "read" | "search" | "edit" | "command" | "other";
export type ActivityOccurrenceStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled"
  | "unknown";

export type ActivityOccurrence = {
  occurrenceId: string;
  family: ActivityFamily;
  status: ActivityOccurrenceStatus;
  label: string;
  resourceKey?: string;
  resourceLabel?: string;
  sourcePartIds: string[];
  firstStreamSeq: number;
  lastStreamSeq: number;
  count: number;
  representativePart: ChatPart;
};

export type ActivityEpisodeNarration = {
  partId: string;
  markdown: string;
  streaming?: boolean;
};

export type ActivityEpisode = {
  episodeId: string;
  label: string;
  narrations: ActivityEpisodeNarration[];
  status: ActivityOccurrenceStatus;
  firstStreamSeq: number;
  lastStreamSeq: number;
  occurrences: ActivityOccurrence[];
  familyCounts: Record<ActivityFamily, number>;
  sourcePartIds: string[];
};

export type ActivitySummarySegmentKind =
  | "stage"
  | "read"
  | "search"
  | "edit"
  | "command"
  | "other"
  | "error"
  | "duration";

export type ActivitySummarySegment = {
  kind: ActivitySummarySegmentKind;
  priority: number;
  fullText: string;
  compactText: string;
};

export type ActivityViewModel = {
  activityParts: ChatPart[];
  occurrences: ActivityOccurrence[];
  episodes: ActivityEpisode[];
  /** Skill / filler / status noise / unknown technical payload sources */
  debugParts: ChatPart[];
  /** Model reasoning / CoT — L1 “思考过程”, not技术详情 */
  reasoningParts: ChatPart[];
  /** Raw timeline for技术详情: excludes meaningful narration (shown in L1) */
  technicalParts: ChatPart[];
  statusPart: Extract<ChatPart, { kind: "turn_meta" | "status" }> | null;
  state: TurnDisplayState;
  currentStage: string;
  summaryLabel: string;
  summarySegments: ActivitySummarySegment[];
  /** Collapsed complete-state memory anchor */
  latestNarrationPreview: string;
  durationMs?: number;
  hasActivity: boolean;
  hasErrors: boolean;
  errorCount: number;
  rawPartCount: number;
  /** 0.1.7: active turns prefer expanded process unless user collapsed */
  preferExpanded: boolean;
};

type StageMarker = {
  label: string;
  fullText?: string;
  kind: "narration" | "status";
  streaming?: boolean;
  seq: number;
  sourcePartId: string;
};

const NARRATION_PREVIEW_MAX = 120;
const NARRATION_INLINE_COLLAPSE_CHARS = 420;

const IMAGE_EXTENSION = /\.(png|jpe?g|webp|gif|avif|bmp|tiff?|heic)$/i;
const INTERNAL_STATUS = new Set([
  "accepted",
  "requesting",
  "connecting",
  "connect",
  "initializing",
  "initialized",
]);

function partSeq(part: ChatPart, fallback: number): number {
  return part.streamSeq ?? fallback;
}

function normalizedResource(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function basename(value: string): string {
  const normalized = normalizedResource(value).replace(/\/$/, "");
  return normalized.split("/").pop() || normalized;
}

function compactText(value: string, max = 96): string {
  const sanitized = sanitizeActivityDetail(value, {
    maxStringLength: Math.max(256, max * 4),
    maxTotalCharacters: Math.max(512, max * 4),
  });
  const safeValue = typeof sanitized === "string" ? sanitized : "";
  const normalized = normalizeMarkdown(safeValue)
    .replace(/[`*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  const firstSentence = normalized.split(/(?<=[。！？!?])\s*/)[0] || normalized;
  return firstSentence.length <= max
    ? firstSentence
    : `${firstSentence.slice(0, max - 1)}…`;
}

function isMeaningfulStage(label: string, phase?: string): boolean {
  const normalized = compactText(label).toLowerCase();
  const normalizedPhase = (phase ?? "").toLowerCase();
  if (!normalized) return false;
  if (INTERNAL_STATUS.has(normalized) || INTERNAL_STATUS.has(normalizedPhase)) {
    return false;
  }
  return !/^(好的|好|继续|继续处理|处理中|正在处理|思考中|working|continue|ok)[。.!！ ]*$/i.test(
    normalized,
  );
}

function mapToolFamily(tool: string): ActivityFamily {
  const family = classifyToolFamily(tool);
  if (family === "read") return "read";
  if (family === "write") return "edit";
  if (family === "command") return "command";
  if (family === "search" || family === "query" || family === "explore") {
    return "search";
  }
  return "other";
}

function familyLabel(family: ActivityFamily): string {
  switch (family) {
    case "read":
      return "读取与查看";
    case "search":
      return "搜索与检索";
    case "edit":
      return "修改文件";
    case "command":
      return "运行命令";
    default:
      return "处理任务";
  }
}

function statusFromTool(status?: string): ActivityOccurrenceStatus {
  if (
    status === "pending" ||
    status === "running" ||
    status === "success" ||
    status === "error" ||
    status === "cancelled"
  ) {
    return status;
  }
  return "unknown";
}

function combineStatus(
  left: ActivityOccurrenceStatus,
  right: ActivityOccurrenceStatus,
): ActivityOccurrenceStatus {
  if (left === "running" || right === "running") return "running";
  if (left === "error" || right === "error") return "error";
  if (left === "cancelled" || right === "cancelled") return "cancelled";
  if (left === "success" || right === "success") return "success";
  if (left === "pending" || right === "pending") return "pending";
  return "unknown";
}

function objectString(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function toolResource(
  family: ActivityFamily,
  part: Extract<ChatPart, { kind: "tool" }>,
): { key?: string; label?: string } {
  if (family === "command") {
    const command =
      objectString(part.input, ["command", "cmd", "script"]) ??
      (typeof part.input === "string" ? part.input : undefined) ??
      part.message;
    const normalized = command?.trim().replace(/\s+/g, " ");
    return normalized ? { key: normalized, label: compactText(normalized, 120) } : {};
  }
  if (family === "read" || family === "edit") {
    const path = objectString(part.input, ["path", "file", "filePath", "filename"]);
    return path
      ? { key: normalizedResource(path), label: basename(path) }
      : {};
  }
  if (family === "search") {
    const query =
      objectString(part.input, ["query", "pattern", "term", "path"]) ?? part.message;
    const normalized = query?.trim().replace(/\s+/g, " ");
    return normalized ? { key: normalized, label: compactText(normalized) } : {};
  }
  return {};
}

function itemOccurrence(
  item: ToolBatchItem,
  part: Extract<ChatPart, { kind: "tool_batch" }>,
  itemIndex: number,
  seq: number,
): ActivityOccurrence {
  const family = mapToolFamily(item.tool);
  const label = compactText(item.message ?? "") || familyLabel(family);
  return {
    occurrenceId: `${part.id}:item:${itemIndex}`,
    family,
    status: statusFromTool(item.status),
    label,
    resourceKey: undefined,
    resourceLabel: undefined,
    sourcePartIds: [part.id],
    firstStreamSeq: seq + itemIndex / 1_000,
    lastStreamSeq: seq + itemIndex / 1_000,
    count: 1,
    representativePart: part,
  };
}

function actionOccurrence(part: ChatPart, seq: number): ActivityOccurrence | null {
  if (part.kind === "file_read" || part.kind === "document_read") {
    const path = normalizedResource(part.path);
    return {
      occurrenceId: part.id,
      family: "read",
      status: part.streaming ? "running" : "success",
      label: `读取 ${basename(path)}`,
      resourceKey: path,
      resourceLabel: basename(path),
      sourcePartIds: [part.id],
      firstStreamSeq: seq,
      lastStreamSeq: seq,
      count: 1,
      representativePart: part,
    };
  }
  if (part.kind === "file_edit" || part.kind === "document_edit") {
    const path = normalizedResource(part.path);
    return {
      occurrenceId: part.id,
      family: "edit",
      status: part.streaming ? "running" : "success",
      label: `编辑 ${basename(path)}`,
      resourceKey: path,
      resourceLabel: basename(path),
      sourcePartIds: [part.id],
      firstStreamSeq: seq,
      lastStreamSeq: seq,
      count: 1,
      representativePart: part,
    };
  }
  if (part.kind === "command") {
    const command = part.command.trim().replace(/\s+/g, " ");
    return {
      occurrenceId: part.id,
      family: "command",
      status: part.streaming
        ? "running"
        : part.exitCode != null && part.exitCode !== 0
          ? "error"
          : "success",
      label: compactText(command, 120) || "运行命令",
      resourceKey: command || undefined,
      resourceLabel: compactText(command, 120) || undefined,
      sourcePartIds: [part.id],
      firstStreamSeq: seq,
      lastStreamSeq: seq,
      count: 1,
      representativePart: part,
    };
  }
  if (part.kind === "tool") {
    const family = mapToolFamily(part.tool);
    const resource = toolResource(family, part);
    return {
      occurrenceId: part.callId ? `call:${part.callId}` : part.id,
      family,
      status: statusFromTool(part.status),
      label: compactText(part.message ?? "") || familyLabel(family),
      resourceKey: resource.key,
      resourceLabel: resource.label,
      sourcePartIds: [part.id],
      firstStreamSeq: seq,
      lastStreamSeq: seq,
      count: 1,
      representativePart: part,
    };
  }
  if (part.kind === "error") {
    return {
      occurrenceId: part.id,
      family: "other",
      status: "error",
      label: compactText(part.message) || "处理失败",
      sourcePartIds: [part.id],
      firstStreamSeq: seq,
      lastStreamSeq: seq,
      count: 1,
      representativePart: part,
    };
  }
  return null;
}

function mergeLifecycleOccurrences(occurrences: ActivityOccurrence[]): ActivityOccurrence[] {
  const result: ActivityOccurrence[] = [];
  const byId = new Map<string, ActivityOccurrence>();

  for (const occurrence of occurrences) {
    const existing = byId.get(occurrence.occurrenceId);
    if (!existing) {
      const copy = { ...occurrence, sourcePartIds: [...occurrence.sourcePartIds] };
      byId.set(copy.occurrenceId, copy);
      result.push(copy);
      continue;
    }
    if (occurrence.status !== "unknown") {
      existing.status = occurrence.status;
    }
    existing.lastStreamSeq = Math.max(existing.lastStreamSeq, occurrence.lastStreamSeq);
    existing.sourcePartIds = [
      ...new Set([...existing.sourcePartIds, ...occurrence.sourcePartIds]),
    ];
    if (occurrence.status !== "running") {
      existing.label = occurrence.label || existing.label;
      existing.representativePart = occurrence.representativePart;
    }
  }
  return result;
}

function mergeCommandToolPairs(occurrences: ActivityOccurrence[]): ActivityOccurrence[] {
  const removed = new Set<string>();
  for (const command of occurrences) {
    if (command.family !== "command" || command.representativePart.kind !== "command") {
      continue;
    }
    const pair = occurrences.find(
      (candidate) =>
        candidate !== command &&
        candidate.family === "command" &&
        candidate.representativePart.kind === "tool" &&
        candidate.resourceKey != null &&
        candidate.resourceKey === command.resourceKey &&
        Math.abs(candidate.firstStreamSeq - command.firstStreamSeq) <= 3,
    );
    if (!pair) continue;
    command.status = combineStatus(command.status, pair.status);
    command.sourcePartIds = [
      ...new Set([...command.sourcePartIds, ...pair.sourcePartIds]),
    ];
    command.firstStreamSeq = Math.min(command.firstStreamSeq, pair.firstStreamSeq);
    command.lastStreamSeq = Math.max(command.lastStreamSeq, pair.lastStreamSeq);
    removed.add(pair.occurrenceId);
  }
  return occurrences.filter((occurrence) => !removed.has(occurrence.occurrenceId));
}

export function buildActivityOccurrences(parts: ChatPart[]): ActivityOccurrence[] {
  const ordered = [...parts]
    .map((part, index) => ({ part, seq: partSeq(part, index) }))
    .sort((a, b) => a.seq - b.seq);
  const occurrences: ActivityOccurrence[] = [];
  for (const { part, seq } of ordered) {
    if (part.kind === "tool_batch") {
      part.items.forEach((item, index) => {
        occurrences.push(itemOccurrence(item, part, index, seq));
      });
      continue;
    }
    const occurrence = actionOccurrence(part, seq);
    if (occurrence) occurrences.push(occurrence);
  }
  return mergeCommandToolPairs(mergeLifecycleOccurrences(occurrences)).sort(
    (a, b) => a.firstStreamSeq - b.firstStreamSeq,
  );
}

function stageMarkers(parts: ChatPart[]): StageMarker[] {
  const markers: StageMarker[] = [];
  parts.forEach((part, index) => {
    const seq = partSeq(part, index);
    if (part.kind === "status" && isMeaningfulStage(part.label, part.phase)) {
      markers.push({
        label: compactText(part.label),
        kind: "status",
        seq,
        sourcePartId: part.id,
      });
    } else if (part.kind === "narration" && isMeaningfulStage(part.markdown)) {
      const fullText = normalizeMarkdown(part.markdown).trim();
      markers.push({
        label: compactText(fullText),
        fullText,
        kind: "narration",
        streaming: part.streaming,
        seq,
        sourcePartId: part.id,
      });
    }
  });
  return markers;
}

function aggregateEpisodeOccurrences(
  occurrences: ActivityOccurrence[],
): ActivityOccurrence[] {
  const result: ActivityOccurrence[] = [];
  const byKey = new Map<string, ActivityOccurrence>();
  for (const occurrence of occurrences) {
    const key = occurrence.resourceKey
      ? `${occurrence.family}:${occurrence.resourceKey}`
      : `${occurrence.family}:${occurrence.label}:${occurrence.occurrenceId}`;
    const existing = byKey.get(key);
    if (!existing) {
      const copy = { ...occurrence, sourcePartIds: [...occurrence.sourcePartIds] };
      byKey.set(key, copy);
      result.push(copy);
      continue;
    }
    existing.count += occurrence.count;
    existing.status = combineStatus(existing.status, occurrence.status);
    existing.lastStreamSeq = Math.max(existing.lastStreamSeq, occurrence.lastStreamSeq);
    existing.sourcePartIds = [
      ...new Set([...existing.sourcePartIds, ...occurrence.sourcePartIds]),
    ];
    if (occurrence.status === "error" || occurrence.status === "running") {
      existing.representativePart = occurrence.representativePart;
    }
  }
  return result;
}

function episodeStatus(occurrences: ActivityOccurrence[]): ActivityOccurrenceStatus {
  return occurrences.reduce<ActivityOccurrenceStatus>(
    (status, occurrence) => combineStatus(status, occurrence.status),
    "unknown",
  );
}

function createEpisode(
  index: number,
  label: string,
  seq: number,
  sourcePartId?: string,
  narration?: ActivityEpisodeNarration,
): ActivityEpisode {
  return {
    episodeId: `episode:${index}:${seq}`,
    label,
    narrations: narration ? [narration] : [],
    status: "unknown",
    firstStreamSeq: seq,
    lastStreamSeq: seq,
    occurrences: [],
    familyCounts: { read: 0, search: 0, edit: 0, command: 0, other: 0 },
    sourcePartIds: sourcePartId ? [sourcePartId] : [],
  };
}

function appendNarration(
  episode: ActivityEpisode,
  marker: StageMarker,
): void {
  if (marker.kind !== "narration" || !marker.fullText) return;
  const last = episode.narrations.at(-1);
  if (last?.markdown === marker.fullText) {
    last.streaming = marker.streaming ?? last.streaming;
    return;
  }
  episode.narrations.push({
    partId: marker.sourcePartId,
    markdown: marker.fullText,
    streaming: marker.streaming,
  });
}

export function buildActivityEpisodes(
  parts: ChatPart[],
  occurrences: ActivityOccurrence[],
): ActivityEpisode[] {
  const markers = stageMarkers(parts);
  const events: Array<
    | { type: "marker"; seq: number; marker: StageMarker }
    | { type: "occurrence"; seq: number; occurrence: ActivityOccurrence }
  > = [
    ...markers.map((marker) => ({ type: "marker" as const, seq: marker.seq, marker })),
    ...occurrences.map((occurrence) => ({
      type: "occurrence" as const,
      seq: occurrence.firstStreamSeq,
      occurrence,
    })),
  ].sort((a, b) => a.seq - b.seq || (a.type === "marker" ? -1 : 1));

  const episodes: ActivityEpisode[] = [];
  let current: ActivityEpisode | null = null;
  let currentExplicit = false;

  for (const event of events) {
    if (event.type === "marker") {
      const normalized = event.marker.label.toLowerCase();
      if (current && current.label.toLowerCase() === normalized) {
        current.sourcePartIds.push(event.marker.sourcePartId);
        current.lastStreamSeq = Math.max(current.lastStreamSeq, event.seq);
        appendNarration(current, event.marker);
        currentExplicit = true;
        continue;
      }
      if (current && current.occurrences.length === 0 && current.narrations.length === 0) {
        current.label = event.marker.label;
        current.sourcePartIds.push(event.marker.sourcePartId);
        current.firstStreamSeq = Math.min(current.firstStreamSeq, event.seq);
        current.lastStreamSeq = Math.max(current.lastStreamSeq, event.seq);
        appendNarration(current, event.marker);
        currentExplicit = true;
        continue;
      }
      current = createEpisode(
        episodes.length,
        event.marker.label,
        event.seq,
        event.marker.sourcePartId,
        event.marker.kind === "narration" && event.marker.fullText
          ? {
              partId: event.marker.sourcePartId,
              markdown: event.marker.fullText,
              streaming: event.marker.streaming,
            }
          : undefined,
      );
      episodes.push(current);
      currentExplicit = true;
      continue;
    }

    const occurrence = event.occurrence;
    const lastFamily = current?.occurrences.at(-1)?.family;
    if (
      !current ||
      (!currentExplicit &&
        current.occurrences.length > 0 &&
        lastFamily !== occurrence.family)
    ) {
      current = createEpisode(
        episodes.length,
        familyLabel(occurrence.family),
        occurrence.firstStreamSeq,
      );
      episodes.push(current);
      currentExplicit = false;
    }
    current.occurrences.push(occurrence);
    current.sourcePartIds.push(...occurrence.sourcePartIds);
    current.firstStreamSeq = Math.min(current.firstStreamSeq, occurrence.firstStreamSeq);
    current.lastStreamSeq = Math.max(current.lastStreamSeq, occurrence.lastStreamSeq);
  }

  return episodes
    .filter(
      (episode) =>
        episode.occurrences.length > 0 || episode.narrations.length > 0,
    )
    .map((episode) => {
      const aggregated = aggregateEpisodeOccurrences(episode.occurrences);
      const familyCounts: Record<ActivityFamily, number> = {
        read: 0,
        search: 0,
        edit: 0,
        command: 0,
        other: 0,
      };
      for (const occurrence of aggregated) {
        familyCounts[occurrence.family] += occurrence.count;
      }
      return {
        ...episode,
        narrations: episode.narrations,
        occurrences: aggregated,
        familyCounts,
        status:
          aggregated.length > 0
            ? episodeStatus(aggregated)
            : episode.narrations.some((item) => item.streaming)
              ? "running"
              : "success",
        sourcePartIds: [...new Set(episode.sourcePartIds)],
      };
    })
    .sort((a, b) => a.firstStreamSeq - b.firstStreamSeq);
}

function isFillerNarration(part: ChatPart): boolean {
  return part.kind === "narration" && !isMeaningfulStage(part.markdown);
}

function isDebugPart(part: ChatPart): boolean {
  return (
    part.kind === "skill" ||
    part.kind === "status_chip" ||
    part.kind === "json" ||
    isFillerNarration(part) ||
    (part.kind === "status" && !isMeaningfulStage(part.label, part.phase))
  );
}

function isReasoningPart(part: ChatPart): boolean {
  return part.kind === "reasoning";
}

function isMeaningfulNarrationPart(part: ChatPart): boolean {
  return part.kind === "narration" && isMeaningfulStage(part.markdown);
}

export function shouldCollapseNarrationInline(markdown: string): boolean {
  return normalizeMarkdown(markdown).trim().length > NARRATION_INLINE_COLLAPSE_CHARS;
}

export function prefersActivityExpanded(state: TurnDisplayState): boolean {
  return (
    state === "preparing" ||
    state === "running" ||
    state === "restoring" ||
    state === "waiting_user" ||
    state === "error" ||
    state === "cancelled"
  );
}

export function resolveActivityProcessExpanded(
  collapse: ActivityCollapse | undefined,
  state: TurnDisplayState,
): boolean {
  if (collapse === "user_expanded") return true;
  if (collapse === "user_collapsed") return false;
  if (prefersActivityExpanded(state)) return true;
  return collapse === "expanded";
}

function buildLatestNarrationPreview(parts: ChatPart[]): string {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.kind === "narration" && isMeaningfulStage(part.markdown)) {
      return compactText(part.markdown, NARRATION_PREVIEW_MAX);
    }
  }
  return "";
}

function latestStatusPart(
  parts: ChatPart[],
): Extract<ChatPart, { kind: "turn_meta" | "status" }> | null {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.kind === "turn_meta") return part;
    if (part?.kind === "status" && isMeaningfulStage(part.label, part.phase)) return part;
  }
  return null;
}

function durationFromMessage(
  message: ChatMessage,
  parts: ChatPart[],
  now: number,
): number | undefined {
  const canonicalDuration = message.canonicalOutput?.outcome.durationMs;
  if (canonicalDuration != null) return Math.max(0, canonicalDuration);
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.kind === "turn_meta" && part.durationMs != null) {
      return Math.max(0, part.durationMs);
    }
  }
  if (
    message.runStartedAt != null &&
    (message.status === "loading" || message.status === "streaming")
  ) {
    return Math.max(0, now - message.runStartedAt);
  }
  return undefined;
}

function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1_000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

function summaryPriority(
  kind: ActivitySummarySegmentKind,
  state: TurnDisplayState,
): number {
  if (kind === "stage") return 100;
  if (kind === "error") return state === "complete" ? 90 : 95;
  if (state === "complete") {
    if (kind === "edit") return 85;
    if (kind === "command") return 80;
    if (kind === "read") return 75;
    if (kind === "search") return 70;
    if (kind === "duration") return 65;
    return 60;
  }
  if (kind === "edit" || kind === "command") return 80;
  if (kind === "read" || kind === "search") return 75;
  if (kind === "duration") return 55;
  return 60;
}

function currentStage(
  message: ChatMessage,
  state: TurnDisplayState,
  parts: ChatPart[],
  occurrences: ActivityOccurrence[],
): string {
  const waiting = waitingUserMessage(message);
  if (waiting) return compactText(waiting, 72);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.kind === "status" && isMeaningfulStage(part.label, part.phase)) {
      return compactText(part.label, 72);
    }
  }
  const running = [...occurrences].reverse().find((item) => item.status === "running");
  if (running) return running.label;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part?.kind === "narration" && isMeaningfulStage(part.markdown)) {
      return compactText(part.markdown, 72);
    }
  }
  if (state === "preparing") return "正在准备";
  if (state === "restoring") return "正在恢复任务状态";
  if (state === "error") return "处理失败";
  if (state === "cancelled") return "已中断";
  if (state === "complete" || state === "complete_empty") return "处理完成";
  return "处理中";
}

function buildSummarySegments(
  state: TurnDisplayState,
  stage: string,
  episodes: ActivityEpisode[],
  durationMs: number | undefined,
): ActivitySummarySegment[] {
  const flattened = episodes.flatMap((episode) => episode.occurrences);
  const readResources = new Set<string>();
  const editResources = new Set<string>();
  let readWithoutResource = 0;
  let editWithoutResource = 0;
  let imageCount = 0;
  let searchCount = 0;
  let commandCount = 0;
  let otherCount = 0;
  let errorCount = 0;

  for (const occurrence of flattened) {
    if (occurrence.status === "error") errorCount += occurrence.count;
    if (occurrence.family === "read") {
      if (occurrence.resourceKey) {
        if (!readResources.has(occurrence.resourceKey) && IMAGE_EXTENSION.test(occurrence.resourceKey)) {
          imageCount += 1;
        }
        readResources.add(occurrence.resourceKey);
      } else {
        readWithoutResource += occurrence.count;
      }
    } else if (occurrence.family === "edit") {
      if (occurrence.resourceKey) editResources.add(occurrence.resourceKey);
      else editWithoutResource += occurrence.count;
    } else if (occurrence.family === "search") {
      searchCount += occurrence.count;
    } else if (occurrence.family === "command") {
      commandCount += occurrence.count;
    } else if (occurrence.representativePart.kind !== "error") {
      otherCount += occurrence.count;
    }
  }

  const active = state === "preparing" || state === "running" || state === "restoring";
  const segments: ActivitySummarySegment[] = [];
  if (active || state === "waiting_user" || state === "error" || state === "cancelled") {
    segments.push({
      kind: "stage",
      priority: summaryPriority("stage", state),
      fullText: stage,
      compactText: stage,
    });
  }
  const readCount = readResources.size + readWithoutResource;
  if (readCount > 0) {
    const fullText = imageCount === readCount
      ? `${active ? "已查看" : "查看"} ${readCount} 张图片`
      : `${active ? "已读取" : "读取"} ${readCount} 个文件`;
    segments.push({
      kind: "read",
      priority: summaryPriority("read", state),
      fullText,
      compactText: imageCount === readCount ? `${readCount} 张图片` : `${readCount} 个文件`,
    });
  }
  if (searchCount > 0) {
    segments.push({
      kind: "search",
      priority: summaryPriority("search", state),
      fullText: `${active ? "已搜索" : "搜索"} ${searchCount} 次`,
      compactText: `${searchCount} 次搜索`,
    });
  }
  const editCount = editResources.size + editWithoutResource;
  if (editCount > 0) {
    segments.push({
      kind: "edit",
      priority: summaryPriority("edit", state),
      fullText: `${active ? "已编辑" : "编辑"} ${editCount} 个文件`,
      compactText: `${editCount} 个文件`,
    });
  }
  if (commandCount > 0) {
    segments.push({
      kind: "command",
      priority: summaryPriority("command", state),
      fullText: `${active ? "已运行" : "运行"} ${commandCount} 条命令`,
      compactText: `${commandCount} 条命令`,
    });
  }
  if (otherCount > 0) {
    segments.push({
      kind: "other",
      priority: summaryPriority("other", state),
      fullText: `处理 ${otherCount} 项`,
      compactText: `${otherCount} 项`,
    });
  }
  if (errorCount > 0) {
    segments.push({
      kind: "error",
      priority: summaryPriority("error", state),
      fullText: `${errorCount} 项失败`,
      compactText: `${errorCount} 项失败`,
    });
  }
  if (!active && durationMs != null) {
    const duration = formatDuration(durationMs);
    segments.push({
      kind: "duration",
      priority: summaryPriority("duration", state),
      fullText: `用时 ${duration}`,
      compactText: duration,
    });
  }
  return segments;
}

export function buildActivityViewModel(
  message: ChatMessage,
  options?: { now?: number; state?: TurnDisplayState },
): ActivityViewModel {
  const state = options?.state ?? resolveTurnDisplayState(message);
  const activityParts = (message.parts ?? [])
    .filter((part) => part.zone === "activity" && part.kind !== "todo")
    .map((part, index) => ({ part, seq: partSeq(part, index) }))
    .sort((a, b) => a.seq - b.seq)
    .map(({ part }) => part);
  const occurrences = buildActivityOccurrences(activityParts);
  const episodes = buildActivityEpisodes(activityParts, occurrences);
  const stage = currentStage(message, state, activityParts, occurrences);
  const durationMs = durationFromMessage(message, activityParts, options?.now ?? Date.now());
  const summarySegments = buildSummarySegments(state, stage, episodes, durationMs);
  const errorCount = episodes
    .flatMap((episode) => episode.occurrences)
    .reduce((count, occurrence) => count + (occurrence.status === "error" ? occurrence.count : 0), 0);
  const meaningfulParts = activityParts.filter((part) => {
    if (part.kind === "turn_meta") return false;
    if (part.kind === "status") return isMeaningfulStage(part.label, part.phase);
    return true;
  });
  if (meaningfulParts.length > 0 && summarySegments.length === 0) {
    summarySegments.push({
      kind: "stage",
      priority: summaryPriority("stage", state),
      fullText: stage,
      compactText: stage,
    });
  }

  return {
    activityParts,
    occurrences,
    episodes,
    debugParts: activityParts.filter(isDebugPart),
    reasoningParts: activityParts.filter(isReasoningPart),
    technicalParts: activityParts.filter(
      (part) => !isMeaningfulNarrationPart(part) && !isReasoningPart(part),
    ),
    statusPart: latestStatusPart(activityParts),
    state,
    currentStage: stage,
    summaryLabel: summarySegments.map((segment) => segment.fullText).join(" · "),
    summarySegments,
    latestNarrationPreview: buildLatestNarrationPreview(activityParts),
    durationMs,
    hasActivity: meaningfulParts.length > 0,
    hasErrors: errorCount > 0,
    errorCount,
    rawPartCount: activityParts.length,
    preferExpanded: prefersActivityExpanded(state),
  };
}

import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { stripInjectedActivityContext } from "@/lib/activity-log";
import {
  buildActivityViewModel,
  isProcessCheckpointPart,
  type ActivityViewModel,
} from "@/lib/chat-activity-view-model";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import { selectAssistantDeliverablesPart } from "@/lib/chat-message-selectors";
import {
  resolveTurnDisplayState,
  waitingUserMessage,
  type TurnDisplayState,
} from "@/lib/chat-turn-display-state";

export type AnswerPhase = "provisional" | "final";

export type AnswerResultItem = {
  type: "answer";
  id: string;
  streamSeq: number;
  markdown: string;
  phase: AnswerPhase;
  streaming: boolean;
};

export type StructuredResultItem = {
  type: "part";
  id: string;
  streamSeq: number;
  part: ChatPart;
};

export type ResultItem = AnswerResultItem | StructuredResultItem;

export type TurnOutcome =
  | {
      kind: "waiting_user";
      title: string;
      message: string;
      partial: false;
    }
  | {
      kind: "error" | "cancelled";
      title: string;
      message: string;
      partial: boolean;
    }
  | {
      kind: "complete_empty";
      title: string;
      message: string;
      partial: false;
    };

export type TurnViewModel = {
  state: TurnDisplayState;
  answerPhase: AnswerPhase;
  resultItems: ResultItem[];
  deliverableParts: ChatPart[];
  activity: ActivityViewModel;
  activityParts: ChatPart[];
  waitingMessage: string | null;
  outcome: TurnOutcome | null;
  hasResult: boolean;
};

type OrderedPart = { part: ChatPart; seq: number; index: number };

const PROMPT_KINDS = new Set<ChatPart["kind"]>([
  "clarification",
  "writing_requirements",
  "ppt_requirements",
  "3d_requirements",
  "video_requirements",
  "simulation_requirements",
]);

const LEGACY_STRUCTURED_RESULT_KINDS = new Set<ChatPart["kind"]>([
  ...PROMPT_KINDS,
  "writing_requirement_summary",
  "writing_outline",
  "ppt_requirement_summary",
  "ppt_outline",
  "3d_requirement_summary",
  "3d_outline",
  "video_requirement_summary",
  "video_outline",
  "simulation_requirement_summary",
  "simulation_scenario",
  "simulation_summary",
  "simulation_next_action",
  "simulation_suggestion",
  "image",
  "chart",
  "citation",
  "json",
  "research_map",
]);

function orderedParts(parts: ChatPart[] | undefined): OrderedPart[] {
  return (parts ?? [])
    .map((part, index) => ({ part, seq: part.streamSeq ?? index, index }))
    .sort((left, right) => left.seq - right.seq || left.index - right.index);
}

function normalizedAnswer(value: string): string {
  return stripInjectedActivityContext(normalizeMarkdown(value));
}

function textKey(value: string): string {
  return normalizedAnswer(value).replace(/\s+/g, " ").trim();
}

function mergeAnswerParts(parts: OrderedPart[]): string {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const { part } of parts) {
    if (part.kind !== "summary" && part.kind !== "text") continue;
    const markdown = normalizedAnswer(part.markdown);
    const key = textKey(markdown);
    if (!key || seen.has(key)) continue;

    const containedIndex = values.findIndex((value) => {
      const existing = textKey(value);
      if (existing.length <= 40 || key.length <= 40) return false;
      return existing.includes(key) || key.includes(existing);
    });
    if (containedIndex >= 0) {
      if (key.length > textKey(values[containedIndex] ?? "").length) {
        values[containedIndex] = markdown;
      }
      seen.add(key);
      continue;
    }
    seen.add(key);
    values.push(markdown);
  }
  return values.join("\n\n").trim();
}

function isPromptPart(part: ChatPart): boolean {
  return PROMPT_KINDS.has(part.kind);
}

function selectedAnswer(
  message: ChatMessage,
  state: TurnDisplayState,
  parts: OrderedPart[],
): { markdown: string; phase: AnswerPhase; streaming: boolean } {
  const active = state === "preparing" || state === "running" || state === "restoring";
  const answerParts = parts.filter(
    ({ part }) => part.kind === "summary" || part.kind === "text",
  );
  const committedFinal = answerParts.some(
    ({ part }) =>
      part.presentationRole === "result" && part.streaming !== true,
  );
  const phase: AnswerPhase = active && !committedFinal ? "provisional" : "final";
  const streaming = answerParts.some(({ part }) => part.streaming === true);
  const fromParts = mergeAnswerParts(parts);
  const canonical = normalizedAnswer(message.canonicalOutput?.finalAnswer.markdown ?? "");
  const hasPrompt = parts.some(({ part }) => isPromptPart(part));

  if (active) {
    const markdown = fromParts || normalizedAnswer(message.content) || canonical;
    return { markdown, phase, streaming: committedFinal ? streaming : true };
  }
  if (canonical) return { markdown: canonical, phase, streaming: false };
  if (fromParts) return { markdown: fromParts, phase, streaming: false };
  return {
    markdown: hasPrompt ? "" : normalizedAnswer(message.content),
    phase,
    streaming: false,
  };
}
function isDeliverablePart(part: ChatPart): boolean {
  return part.kind === "artifact" || part.kind === "deliverables";
}

function isResultPart(part: ChatPart): boolean {
  if (isProcessCheckpointPart(part)) return false;
  const zone = (part as { zone?: ChatPart["zone"] }).zone;
  if (zone === "activity") return false;
  if (
    part.kind === "summary" ||
    part.kind === "text" ||
    part.kind === "status_chip" ||
    isDeliverablePart(part)
  ) {
    return false;
  }
  if (zone === "summary") return true;
  return zone == null && LEGACY_STRUCTURED_RESULT_KINDS.has(part.kind);
}

function resultItems(
  message: ChatMessage,
  state: TurnDisplayState,
  parts: OrderedPart[],
): { items: ResultItem[]; answerPhase: AnswerPhase } {
  const answer = selectedAnswer(message, state, parts);
  const firstText = parts.find(
    ({ part }) => part.kind === "summary" || part.kind === "text",
  );
  const structured = parts.filter(({ part }) => isResultPart(part));
  const items: ResultItem[] = structured.map(({ part, seq }) => ({
    type: "part",
    id: part.id,
    streamSeq: seq,
    part,
  }));

  if (answer.markdown) {
    const fallbackSeq = structured.length > 0
      ? Math.min(...structured.map(({ seq }) => seq)) - 0.5
      : 0;
    items.push({
      type: "answer",
      id: `${message.id}-answer`,
      streamSeq: firstText?.seq ?? fallbackSeq,
      markdown: answer.markdown,
      phase: answer.phase,
      streaming: answer.streaming,
    });
  }

  items.sort((left, right) => left.streamSeq - right.streamSeq);
  return { items, answerPhase: answer.phase };
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function deliverableParts(message: ChatMessage, parts: OrderedPart[]): ChatPart[] {
  const selectedDeliverables = selectAssistantDeliverablesPart(message);
  const output: ChatPart[] = [];
  const covered = new Set<string>();
  if (selectedDeliverables) {
    output.push(selectedDeliverables);
    selectedDeliverables.items.forEach((item) => covered.add(normalizePath(item.path)));
  }

  for (const { part } of parts) {
    if (part.kind !== "artifact") continue;
    const key = normalizePath(part.path);
    if (covered.has(key)) continue;
    covered.add(key);
    output.push(part);
  }
  return output;
}

function latestError(parts: OrderedPart[]): string | null {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]?.part;
    if (part?.kind === "error" && part.message.trim()) return part.message.trim();
  }
  return null;
}

function turnOutcome(
  message: ChatMessage,
  state: TurnDisplayState,
  hasPartialResult: boolean,
  parts: OrderedPart[],
): TurnOutcome | null {
  const waiting = waitingUserMessage(message);
  if (state === "waiting_user") {
    return {
      kind: "waiting_user",
      title: "需要你继续",
      message: waiting || "请补充或确认后继续",
      partial: false,
    };
  }
  if (state === "error") {
    return {
      kind: "error",
      title: "处理失败",
      message:
        message.canonicalOutput?.outcome.message ||
        latestError(parts) ||
        "任务未能完成，请检查运行时状态后重试。",
      partial: hasPartialResult,
    };
  }
  if (state === "cancelled") {
    return {
      kind: "cancelled",
      title: "已中断",
      message: hasPartialResult
        ? "以下保留中断前已经生成的部分结果。"
        : "任务已中断，没有生成可显示的结果。",
      partial: hasPartialResult,
    };
  }
  if (state === "complete_empty") {
    return {
      kind: "complete_empty",
      title: "任务已结束",
      message: "没有生成可显示的结果，你可以补充要求后重试。",
      partial: false,
    };
  }
  return null;
}

export function buildTurnViewModel(message: ChatMessage): TurnViewModel {
  const state = resolveTurnDisplayState(message);
  const parts = orderedParts(message.parts);
  const result = resultItems(message, state, parts);
  const deliverables = deliverableParts(message, parts);
  const activity = buildActivityViewModel(message, { state });
  const hasResult = result.items.length > 0 || deliverables.length > 0;

  return {
    state,
    answerPhase: result.answerPhase,
    resultItems: result.items,
    deliverableParts: deliverables,
    activity,
    activityParts: activity.activityParts,
    waitingMessage: waitingUserMessage(message),
    outcome: turnOutcome(message, state, hasResult, parts),
    hasResult,
  };
}

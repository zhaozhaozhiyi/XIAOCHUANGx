import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import {
  selectAssistantDeliverablesPart,
  selectAssistantSummaryPart,
} from "@/lib/chat-message-selectors";
import { isWaitingUserSignal } from "@/lib/chat-history";
import { interleavedTimelineParts } from "@/lib/chat-timeline";

export type TurnViewModel = {
  summaryPart:
    | Extract<ChatPart, { kind: "summary" }>
    | Extract<ChatPart, { kind: "clarification" }>
    | null;
  deliverablesPart: Extract<ChatPart, { kind: "deliverables" }> | null;
  waitingMessage: string | null;
  statusPart: Extract<ChatPart, { kind: "turn_meta" | "status" }> | null;
  processParts: ChatPart[];
  /** 所有 part 按 streamSeq 严格时序交错，包含 text/summary 在内 */
  contentParts: ChatPart[];
  debugParts: ChatPart[];
};

function textKey(value: string): string {
  return normalizeMarkdown(value)
    .replace(/\s+/g, " ")
    .trim();
}

function partText(part: ChatPart): string {
  if (part.kind === "summary" || part.kind === "text") return part.markdown;
  if (part.kind === "narration" || part.kind === "reasoning") return part.markdown;
  if (part.kind === "error") return part.message;
  return "";
}

function sameOrContained(a: string, b: string): boolean {
  const left = textKey(a);
  const right = textKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  return shorter.length > 40 && longer.includes(shorter);
}

function isDebugPart(part: ChatPart): boolean {
  return (
    part.kind === "skill" ||
    part.kind === "status_chip"
  );
}

function isSummaryKind(part: ChatPart): boolean {
  return (
    part.kind === "summary" ||
    part.kind === "text" ||
    part.kind === "deliverables" ||
    part.kind === "clarification" ||
    part.kind === "error"
  );
}

function isWaitingPart(part: ChatPart): boolean {
  return part.kind === "status" && isWaitingUserSignal(part.label, part.phase);
}

function isConnectStatusPart(part: ChatPart): boolean {
  return (
    part.kind === "status" &&
    (part.phase === "connect" || part.label.includes("连接"))
  );
}

export function buildTurnViewModel(message: ChatMessage): TurnViewModel {
  const summaryPart = selectAssistantSummaryPart(message);
  const deliverablesPart = selectAssistantDeliverablesPart(message);
  const timeline = interleavedTimelineParts(message.parts);
  const waitingPart = timeline.find(isWaitingPart);
  const statusPart =
    [...timeline]
      .reverse()
      .find(
        (part): part is Extract<ChatPart, { kind: "turn_meta" | "status" }> =>
          part.kind === "turn_meta" ||
          (part.kind === "status" &&
            !isWaitingPart(part) &&
            !isConnectStatusPart(part)),
      ) ?? null;
  const finalText = summaryPart?.kind === "summary" ? summaryPart.markdown : "";
  const seen = new Set<string>();
  const processParts = timeline.filter((part) => {
    if (isDebugPart(part)) return false;
    if (isSummaryKind(part)) return false;
    if (isWaitingPart(part)) return false;
    if (isConnectStatusPart(part)) return false;
    if (part.kind === "turn_meta") return false;
    if (part.kind === "status") return false;

    const text = partText(part);
    if (text && sameOrContained(text, finalText)) return false;
    const key = textKey(text);
    if (key) {
      const dedupeKey = `${part.kind}:${key}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
    }
    return true;
  });
  const debugParts = timeline.filter(isDebugPart);

  // contentParts = 完整时序交错（含 text/summary），跨 kind 按文字内容去重
  const contentSeenTexts = new Set<string>();
  const contentParts = timeline.filter((part) => {
    if (isDebugPart(part)) return false;
    if (isWaitingPart(part)) return false;
    if (isConnectStatusPart(part)) return false;
    if (part.kind === "turn_meta") return false;
    if (part.kind === "status") return false;
    if (part.kind === "deliverables") return false;
    // 跨 kind 按纯文本内容去重，解决 companion 将同一段文字通过 delta + interim 重复发送的问题
    const key = textKey(partText(part));
    if (key) {
      if (contentSeenTexts.has(key)) return false;
      contentSeenTexts.add(key);
    }
    return true;
  });

  return {
    summaryPart,
    deliverablesPart,
    statusPart,
    waitingMessage:
      (waitingPart && waitingPart.kind === "status" ? waitingPart.label : null) ??
      (message.canonicalOutput?.nextAction?.type === "ask_user"
        ? message.canonicalOutput.nextAction.message ?? null
        : null),
    processParts,
    contentParts,
    debugParts,
  };
}

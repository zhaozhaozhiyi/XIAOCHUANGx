import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";
import {
  selectAssistantDeliverablesPart,
  selectAssistantSummaryPart,
} from "@/lib/chat-message-selectors";
import { isWaitingUserSignal } from "@/lib/chat-history";
import { interleavedTimelineParts } from "@/lib/chat-timeline";

export type LegacyTurnViewModel = {
  deliverablesPart: Extract<ChatPart, { kind: "deliverables" }> | null;
  waitingMessage: string | null;
  statusPart: Extract<ChatPart, { kind: "turn_meta" | "status" }> | null;
  processParts: ChatPart[];
  contentParts: ChatPart[];
};

function textKey(value: string): string {
  return normalizeMarkdown(value).replace(/\s+/g, " ").trim();
}

function partText(part: ChatPart): string {
  if (part.kind === "summary" || part.kind === "text") return part.markdown;
  if (part.kind === "narration" || part.kind === "reasoning") return part.markdown;
  if (part.kind === "error") return part.message;
  return "";
}

function isDebugPart(part: ChatPart): boolean {
  return part.kind === "skill" || part.kind === "status_chip";
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

export function buildLegacyTurnViewModel(
  message: ChatMessage,
): LegacyTurnViewModel {
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
  const contentSeenTexts = new Set<string>();
  let contentParts = timeline.filter((part) => {
    if (isDebugPart(part) || isWaitingPart(part) || isConnectStatusPart(part)) {
      return false;
    }
    if (
      part.kind === "turn_meta" ||
      part.kind === "status" ||
      part.kind === "deliverables"
    ) {
      return false;
    }
    const key = textKey(partText(part));
    if (key) {
      if (contentSeenTexts.has(key)) return false;
      contentSeenTexts.add(key);
    }
    return true;
  });
  if (contentParts.length === 0 && summaryPart?.kind === "summary") {
    contentParts = [summaryPart];
  }

  return {
    deliverablesPart,
    waitingMessage:
      (waitingPart?.kind === "status" ? waitingPart.label : null) ??
      (message.canonicalOutput?.nextAction?.type === "ask_user"
        ? message.canonicalOutput.nextAction.message ?? null
        : null),
    statusPart,
    processParts: contentParts.filter(
      (part) => part.kind !== "summary" && part.kind !== "text",
    ),
    contentParts,
  };
}

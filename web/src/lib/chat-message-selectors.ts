import type { ChatMessage } from "@/lib/chat";
import type { ChatPart, DeliverablesPart } from "@/lib/chat-parts";
import {
  messageDisplayContent,
  normalizeMarkdown,
} from "@/lib/chat-parts-utils";
import { stripInjectedActivityContext } from "@/lib/activity-log";

type SummaryPart = Extract<ChatPart, { kind: "summary" }>;
type ClarificationPart = Extract<ChatPart, { kind: "clarification" }>;

export function selectAssistantDisplayContent(message: ChatMessage): string {
  if (message.role !== "assistant") {
    return normalizeMarkdown(message.content);
  }

  const fromCanonical = stripInjectedActivityContext(
    normalizeMarkdown(message.canonicalOutput?.finalAnswer.markdown ?? ""),
  );
  if (fromCanonical) return fromCanonical;

  const fromParts = stripInjectedActivityContext(
    normalizeMarkdown(messageDisplayContent(message)),
  );
  if (fromParts) return fromParts;

  if (
    message.status === "loading" ||
    message.status === "streaming"
  ) {
    return stripInjectedActivityContext(normalizeMarkdown(message.content));
  }

  return stripInjectedActivityContext(normalizeMarkdown(message.content));
}

export function selectHasAssistantSummaryContent(message: ChatMessage): boolean {
  return selectAssistantDisplayContent(message).length > 0;
}

export function selectAssistantSummaryPart(
  message: ChatMessage,
): SummaryPart | ClarificationPart | null {
  const clarification = [...(message.parts ?? [])]
    .reverse()
    .find(
      (part): part is ClarificationPart =>
        part.kind === "clarification",
    );
  if (clarification) return clarification;

  const markdown = selectAssistantDisplayContent(message);
  if (!markdown) return null;
  return {
    id: `${message.id}-final-summary`,
    zone: "summary",
    kind: "summary",
    markdown,
    streaming: false,
    completedAt:
      message.canonicalOutput?.outcome.finishedAt ??
      message.runStartedAt ??
      Date.now(),
  };
}

export function selectAssistantDeliverablesPart(
  message: ChatMessage,
): DeliverablesPart | null {
  const deliverables = [...(message.parts ?? [])]
    .reverse()
    .find((part): part is DeliverablesPart => part.kind === "deliverables");
  if (deliverables) return deliverables;

  const artifacts = message.canonicalOutput?.artifacts ?? [];
  if (artifacts.length === 0) return null;

  return {
    id: `${message.id}-canonical-deliverables`,
    zone: "summary",
    kind: "deliverables",
    headline: "最终产物",
    primaryPath:
      artifacts.find((item) => item.kind === "primary")?.path ??
      artifacts[0]?.path,
    items: artifacts.map((item) => ({
      path: item.path,
      label: item.label,
      mime: item.mime,
      kind: item.kind === "primary" ? "primary" : "attachment",
    })),
    completedAt:
      message.canonicalOutput?.outcome.finishedAt ?? message.runStartedAt,
  };
}

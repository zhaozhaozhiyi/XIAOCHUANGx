import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { isWaitingUserSignal } from "@/lib/chat-history";
import { normalizeMarkdown } from "@/lib/chat-parts-utils";

export type TurnDisplayState =
  | "preparing"
  | "running"
  | "waiting_user"
  | "complete"
  | "complete_empty"
  | "error"
  | "cancelled"
  | "restoring";

const RESULT_KINDS = new Set<ChatPart["kind"]>([
  "summary",
  "text",
  "clarification",
  "writing_requirements",
  "writing_requirement_summary",
  "writing_outline",
  "ppt_requirements",
  "ppt_requirement_summary",
  "ppt_outline",
  "3d_requirements",
  "3d_requirement_summary",
  "3d_outline",
  "video_requirements",
  "video_requirement_summary",
  "video_outline",
  "simulation_requirements",
  "simulation_requirement_summary",
  "simulation_scenario",
  "simulation_summary",
  "simulation_next_action",
  "simulation_suggestion",
  "citation",
  "artifact",
  "deliverables",
  "image",
  "chart",
  "research_map",
]);

function isUnsubmittedPrompt(part: ChatPart): boolean {
  if (part.kind === "clarification") return part.submitted !== true;
  if (
    part.kind === "writing_requirements" ||
    part.kind === "ppt_requirements" ||
    part.kind === "3d_requirements" ||
    part.kind === "video_requirements" ||
    part.kind === "simulation_requirements"
  ) {
    return part.submitted !== true;
  }
  return false;
}

export function waitingUserMessage(message: ChatMessage): string | null {
  const parts = message.parts ?? [];
  const prompt = [...parts].reverse().find(isUnsubmittedPrompt);
  if (prompt?.kind === "clarification") return prompt.question || null;
  if (
    prompt?.kind === "writing_requirements" ||
    prompt?.kind === "ppt_requirements" ||
    prompt?.kind === "3d_requirements" ||
    prompt?.kind === "video_requirements" ||
    prompt?.kind === "simulation_requirements"
  ) {
    return prompt.description || prompt.title || null;
  }

  if (message.canonicalOutput?.nextAction?.type === "ask_user") {
    return message.canonicalOutput.nextAction.message || "需要你补充信息后继续";
  }
  if (message.canonicalOutput?.outcome.status === "waiting_user") {
    return message.canonicalOutput.outcome.message || "需要你补充信息后继续";
  }

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (!part) continue;
    if (part.kind === "status" && isWaitingUserSignal(part.label, part.phase)) {
      return part.label;
    }
    if (part.kind === "turn_meta" && part.runStatus === "waiting_user") {
      return part.label || "需要你补充信息后继续";
    }
  }
  const waitingEvent = [...(message.canonicalEvents ?? [])]
    .reverse()
    .find((event) => event.type === "run_waiting_user");
  return waitingEvent?.type === "run_waiting_user"
    ? waitingEvent.question || "需要你补充信息后继续"
    : null;
}

export function hasTurnResult(message: ChatMessage): boolean {
  if (normalizeMarkdown(message.canonicalOutput?.finalAnswer.markdown ?? "")) {
    return true;
  }
  if (normalizeMarkdown(message.content)) return true;
  if ((message.canonicalOutput?.artifacts?.length ?? 0) > 0) return true;

  return (message.parts ?? []).some((part) => {
    if (!RESULT_KINDS.has(part.kind)) return false;
    if (part.kind === "summary" || part.kind === "text") {
      return normalizeMarkdown(part.markdown).length > 0;
    }
    if (part.kind === "deliverables") return part.items.length > 0;
    return true;
  });
}

function hasExecutionEvidence(message: ChatMessage): boolean {
  return (message.parts ?? []).some((part) => {
    if (part.zone !== "activity" || part.kind === "todo") return false;
    if (part.kind === "status") {
      const phase = part.phase?.toLowerCase();
      return phase !== "connect" && !part.label.includes("连接");
    }
    if (part.kind === "turn_meta") return part.runStatus != null;
    return true;
  });
}

export function resolveTurnDisplayState(
  message: ChatMessage,
  options?: { restoring?: boolean },
): TurnDisplayState {
  const canonicalStatus = message.canonicalOutput?.outcome.status;
  if (message.status === "error" || canonicalStatus === "failed") return "error";
  if (message.status === "cancelled" || canonicalStatus === "cancelled") {
    return "cancelled";
  }
  if (waitingUserMessage(message)) return "waiting_user";
  if (options?.restoring) return "restoring";

  if (message.status === "loading" && !hasExecutionEvidence(message) && !hasTurnResult(message)) {
    return "preparing";
  }
  if (message.status === "loading" || message.status === "streaming") {
    return "running";
  }
  return hasTurnResult(message) ? "complete" : "complete_empty";
}

export function isTurnActive(state: TurnDisplayState): boolean {
  return state === "preparing" || state === "running" || state === "restoring";
}


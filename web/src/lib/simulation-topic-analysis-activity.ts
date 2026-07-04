import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { buildTurnViewModel } from "@/lib/chat-turn-view-model";
import { computeThinkingGaps } from "@/lib/chat-thinking-gap";

const EXCLUDED_ACTIVITY_KINDS = new Set<ChatPart["kind"]>([
  "simulation_requirements",
  "simulation_requirement_summary",
  "simulation_scenario",
  "simulation_node",
  "simulation_edge",
  "simulation_path",
  "simulation_summary",
  "simulation_suggestion",
  "simulation_next_action",
  "deliverables",
  "clarification",
]);

export type SimulationTopicAnalysisActivity = {
  activityParts: ChatPart[];
  gapBefore: Map<string | null, string>;
  runId?: string;
  statusPart: Extract<ChatPart, { kind: "turn_meta" | "status" }> | null;
  isStreaming: boolean;
};

function isExcludedActivityPart(part: ChatPart): boolean {
  return EXCLUDED_ACTIVITY_KINDS.has(part.kind);
}

export function latestSimulationAssistantMessage(
  messages: ChatMessage[],
): ChatMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return message;
  }
  return null;
}

export function selectSimulationTopicAnalysisActivity(
  messages: ChatMessage[],
): SimulationTopicAnalysisActivity | null {
  const message = latestSimulationAssistantMessage(messages);
  if (!message) return null;

  const viewModel = buildTurnViewModel(message);
  const activityParts = viewModel.contentParts.filter(
    (part) => !isExcludedActivityPart(part),
  );
  const fallbackProcessParts = viewModel.processParts.filter(
    (part) => !isExcludedActivityPart(part),
  );
  const resolvedParts =
    activityParts.length > 0 ? activityParts : fallbackProcessParts;

  if (resolvedParts.length === 0 && !viewModel.statusPart) {
    return null;
  }

  const gaps = computeThinkingGaps(message.parts ?? [], {
    runStartedAt: message.runStartedAt,
  });
  const gapBefore = new Map<string | null, string>();
  for (const gap of gaps) {
    gapBefore.set(gap.beforePartId, gap.label);
  }

  return {
    activityParts: resolvedParts,
    gapBefore,
    runId: message.runId,
    statusPart: viewModel.statusPart,
    isStreaming: message.status === "loading" || message.status === "streaming",
  };
}

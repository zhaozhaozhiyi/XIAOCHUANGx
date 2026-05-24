import type {
  CanonicalArtifact,
  CanonicalCitation,
  CanonicalEvent,
  CanonicalNextAction,
  CanonicalTurnOutput,
  CanonicalWorkspaceChange,
  TodoItem,
} from "@jlc/contracts";

type BuildCanonicalOutputInput = {
  sessionId: string;
  turnId: string;
  runId: string;
  agentId: string;
  agentModel: string;
  startedAt: number;
  finishedAt: number;
  finalAnswer: string;
  outcome:
    | { status: "success" }
    | { status: "waiting_user"; message?: string }
    | { status: "cancelled"; message?: string }
    | { status: "failed"; code?: string; message: string };
  canonicalEvents?: CanonicalEvent[];
  artifacts?: CanonicalArtifact[];
  citations?: CanonicalCitation[];
  workspaceChanges?: CanonicalWorkspaceChange[];
  todos?: TodoItem[];
  latestStatus?: string;
  compressedHistory?: boolean;
};

function nextActionForOutcome(
  outcome: BuildCanonicalOutputInput["outcome"],
): CanonicalNextAction {
  if (outcome.status === "waiting_user") {
    return {
      type: "ask_user",
      message: outcome.message,
    };
  }
  if (outcome.status === "success") {
    return { type: "none" };
  }
  return {
    type: "none",
    ...(outcome.message ? { message: outcome.message } : {}),
  };
}

export function buildCanonicalOutput(
  input: BuildCanonicalOutputInput,
): CanonicalTurnOutput {
  const artifacts = input.artifacts?.length ? [...input.artifacts] : undefined;
  const citations = input.citations?.length ? [...input.citations] : undefined;
  const workspaceChanges = input.workspaceChanges?.length
    ? [...input.workspaceChanges]
    : undefined;
  const todos = input.todos?.length ? [...input.todos] : undefined;
  const canonicalEvents = input.canonicalEvents ?? [];

  return {
    protocolVersion: 1,
    sessionId: input.sessionId,
    turnId: input.turnId,
    runId: input.runId,
    provider: {
      agentId: input.agentId,
      providerId: input.agentId,
      model: input.agentModel || undefined,
    },
    outcome: {
      status: input.outcome.status,
      finishedAt: input.finishedAt,
      durationMs: Math.max(0, input.finishedAt - input.startedAt),
      ...(input.outcome.status === "failed"
        ? {
            code: input.outcome.code,
            message: input.outcome.message,
          }
        : input.outcome.status === "waiting_user" && input.outcome.message
          ? { message: input.outcome.message }
          : input.outcome.status === "cancelled" && input.outcome.message
            ? { message: input.outcome.message }
            : {}),
    },
    finalAnswer: {
      markdown: input.finalAnswer.trim(),
    },
    ...(citations ? { citations } : {}),
    ...(artifacts ? { artifacts } : {}),
    ...(workspaceChanges ? { workspaceChanges } : {}),
    ...(todos ? { todos } : {}),
    nextAction: nextActionForOutcome(input.outcome),
    debug: {
      eventCount: canonicalEvents.length,
      toolCallCount: canonicalEvents.filter((event) => event.type === "tool_started").length,
      toolFinishedCount: canonicalEvents.filter((event) => event.type === "tool_finished").length,
      assistantDeltaCount: canonicalEvents.filter((event) => event.type === "assistant_delta").length,
      latestStatus: input.latestStatus,
      compressedHistory: input.compressedHistory,
    },
  };
}

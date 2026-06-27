import type {
  CanonicalEvent,
  CanonicalTurnOutput,
} from "@/lib/chat-parts";

function ensureOutput(
  current: CanonicalTurnOutput | undefined,
  input: { sessionId: string; turnId: string; runId: string },
): CanonicalTurnOutput {
  if (!current) {
    return {
      protocolVersion: 1,
      sessionId: input.sessionId,
      turnId: input.turnId,
      runId: input.runId,
      provider: {
        agentId: "unknown",
        providerId: "unknown",
      },
      outcome: {
        status: "waiting_user",
      },
      finalAnswer: {
        markdown: "",
      },
      debug: {
        eventCount: 0,
        toolCallCount: 0,
        toolFinishedCount: 0,
        assistantDeltaCount: 0,
      },
    };
  }

  return {
    ...current,
    provider: { ...current.provider },
    outcome: { ...current.outcome },
    finalAnswer: { ...current.finalAnswer },
    debug: current.debug ? { ...current.debug } : undefined,
    rationale: current.rationale ? { ...current.rationale } : undefined,
    citations: current.citations ? [...current.citations] : undefined,
    artifacts: current.artifacts ? [...current.artifacts] : undefined,
    workspaceChanges: current.workspaceChanges
      ? [...current.workspaceChanges]
      : undefined,
    todos: current.todos ? [...current.todos] : undefined,
    nextAction: current.nextAction ? { ...current.nextAction } : undefined,
  };
}

function mergeAssistantDelta(current: string, delta: string): string {
  if (!current || !delta) return current || delta;
  if (delta === current) return current;
  if (delta.startsWith(current)) return delta;
  return `${current}${delta}`;
}

export function reduceCanonicalOutput(
  current: CanonicalTurnOutput | undefined,
  event: CanonicalEvent,
  input: { sessionId: string; turnId: string },
): CanonicalTurnOutput {
  const next = ensureOutput(current, {
    sessionId: input.sessionId,
    turnId: input.turnId,
    runId: event.runId,
  });

  next.runId = event.runId;
  next.sessionId = input.sessionId;
  next.turnId = input.turnId;
  next.debug = {
    ...next.debug,
    eventCount: (next.debug?.eventCount ?? 0) + 1,
  };

  switch (event.type) {
    case "run_started":
      next.provider = {
        agentId: event.agentId,
        providerId: event.provider,
        model: event.model,
      };
      next.outcome = {
        ...next.outcome,
        status: "waiting_user",
      };
      return next;
    case "assistant_delta":
      next.debug = {
        ...next.debug,
        assistantDeltaCount: (next.debug?.assistantDeltaCount ?? 0) + 1,
      };
      next.finalAnswer = {
        ...next.finalAnswer,
        markdown: mergeAssistantDelta(next.finalAnswer.markdown, event.text),
      };
      return next;
    case "reasoning_delta":
      next.rationale = {
        ...next.rationale,
        summary: next.rationale?.summary
          ? `${next.rationale.summary}\n${event.text}`
          : event.text,
      };
      return next;
    case "citation_found":
      next.citations = [
        ...(next.citations ?? []),
        {
          id: `${event.runId}:${event.timestamp}:${(next.citations ?? []).length}`,
          title: event.title,
          source: event.source,
          url: event.url,
          snippet: event.snippet,
        },
      ];
      return next;
    case "artifact_found":
      next.artifacts = [
        ...(next.artifacts ?? []),
        {
          path: event.path,
          label: event.label,
          mime: event.mime,
        },
      ];
      return next;
    case "workspace_change":
      next.workspaceChanges = [
        ...(next.workspaceChanges ?? []),
        {
          path: event.path,
          kind: event.kind,
          additions: event.additions,
          deletions: event.deletions,
        },
      ];
      return next;
    case "todo_updated":
      next.todos = event.items;
      return next;
    case "tool_started":
      next.debug = {
        ...next.debug,
        toolCallCount: (next.debug?.toolCallCount ?? 0) + 1,
      };
      return next;
    case "tool_finished":
      next.debug = {
        ...next.debug,
        toolFinishedCount: (next.debug?.toolFinishedCount ?? 0) + 1,
      };
      return next;
    case "status_changed":
      next.debug = {
        ...next.debug,
        latestStatus: event.label,
      };
      return next;
    case "run_waiting_user":
      next.outcome = {
        ...next.outcome,
        status: "waiting_user",
        message: event.question,
      };
      next.nextAction = {
        type: "ask_user",
        message: event.question,
      };
      return next;
    case "run_finished":
      next.outcome = {
        ...next.outcome,
        status: "success",
        finishedAt: event.timestamp,
      };
      next.nextAction = { type: "none" };
      return next;
    case "run_failed":
      next.outcome = {
        ...next.outcome,
        status: "failed",
        finishedAt: event.timestamp,
        code: event.code,
        message: event.message,
      };
      next.nextAction = { type: "none" };
      return next;
    case "run_cancelled":
      next.outcome = {
        ...next.outcome,
        status: "cancelled",
        finishedAt: event.timestamp,
      };
      next.nextAction = { type: "none" };
      return next;
    default:
      return next;
  }
}

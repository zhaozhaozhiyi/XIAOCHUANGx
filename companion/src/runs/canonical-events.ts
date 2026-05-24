import type {
  CanonicalEvent,
  CanonicalToolStatus,
  CanonicalTurnOutput,
} from "@jlc/contracts";
import type { SseWriter } from "./sse.js";

type CanonicalToolProgressInput = {
  runId: string;
  tool: string;
  status?: string;
  message?: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
  timestamp?: number;
};

function now(ts?: number): number {
  return ts ?? Date.now();
}

function normalizeToolFinishedStatus(
  status?: string,
): Extract<CanonicalToolStatus, "success" | "error" | "cancelled"> {
  if (status === "error" || status === "failed") return "error";
  if (status === "cancelled") return "cancelled";
  return "success";
}

export function emitCanonicalEvent(
  writer: SseWriter,
  event: CanonicalEvent,
): void {
  writer.send("canonical.event", event);
}

export function emitCanonicalRunAccepted(
  writer: SseWriter,
  input: {
    runId: string;
    message?: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "run_accepted",
    runId: input.runId,
    timestamp: now(input.timestamp),
    message: input.message,
  });
}

export function emitCanonicalRunStarted(
  writer: SseWriter,
  input: {
    runId: string;
    agentId: string;
    provider: string;
    model?: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "run_started",
    runId: input.runId,
    timestamp: now(input.timestamp),
    provider: input.provider,
    agentId: input.agentId,
    model: input.model,
  });
}

export function emitCanonicalAssistantDelta(
  writer: SseWriter,
  input: {
    runId: string;
    text: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "assistant_delta",
    runId: input.runId,
    timestamp: now(input.timestamp),
    text: input.text,
  });
}

export function emitCanonicalRunFailed(
  writer: SseWriter,
  input: {
    runId: string;
    message: string;
    code?: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "run_failed",
    runId: input.runId,
    timestamp: now(input.timestamp),
    message: input.message,
    code: input.code,
  });
}

export function emitCanonicalRunCancelled(
  writer: SseWriter,
  input: {
    runId: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "run_cancelled",
    runId: input.runId,
    timestamp: now(input.timestamp),
  });
}

export function emitCanonicalRunFinished(
  writer: SseWriter,
  input: {
    runId: string;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "run_finished",
    runId: input.runId,
    timestamp: now(input.timestamp),
  });
}

export function emitCanonicalOutput(
  writer: SseWriter,
  input: {
    runId: string;
    canonicalOutput: CanonicalTurnOutput;
  },
): void {
  writer.send("canonical.output", {
    runId: input.runId,
    canonicalOutput: input.canonicalOutput,
  });
}

export function emitCanonicalToolProgress(
  writer: SseWriter,
  input: CanonicalToolProgressInput,
): void {
  const timestamp = now(input.timestamp);
  if (input.tool === "phase") {
    emitCanonicalEvent(writer, {
      type: "status_changed",
      runId: input.runId,
      timestamp,
      phase: input.status ?? "running",
      label: input.message ?? "处理中",
    });
    return;
  }

  if (input.tool === "reasoning") {
    emitCanonicalEvent(writer, {
      type: "reasoning_delta",
      runId: input.runId,
      timestamp,
      text: input.message ?? "思考中",
    });
    return;
  }

  if (input.status === "success" || input.status === "error" || input.status === "failed") {
    emitCanonicalEvent(writer, {
      type: "tool_finished",
      runId: input.runId,
      timestamp,
      callId: input.callId ?? `${input.tool}:${timestamp}`,
      tool: input.tool,
      status: normalizeToolFinishedStatus(input.status),
      message: input.message,
      output: input.output,
    });
    return;
  }

  emitCanonicalEvent(writer, {
    type: "tool_started",
    runId: input.runId,
    timestamp,
    callId: input.callId ?? `${input.tool}:${timestamp}`,
    tool: input.tool,
    message: input.message,
    input: input.input,
  });
}

export function emitCanonicalWorkspaceChange(
  writer: SseWriter,
  input: {
    runId: string;
    path: string;
    kind: "read" | "created" | "modified" | "deleted";
    additions?: number;
    deletions?: number;
    timestamp?: number;
  },
): void {
  emitCanonicalEvent(writer, {
    type: "workspace_change",
    runId: input.runId,
    timestamp: now(input.timestamp),
    path: input.path,
    kind: input.kind,
    additions: input.additions,
    deletions: input.deletions,
  });
}

import type { SseWriter } from "./sse.js";

export function emitRunStatus(
  writer: SseWriter,
  input: {
    runId: string;
    phase: string;
    label: string;
  },
): void {
  writer.send("run.status", {
    runId: input.runId,
    phase: input.phase,
    label: input.label,
  });
}

export function emitMessageInterim(
  writer: SseWriter,
  input: {
    runId: string;
    turnId?: string;
    text: string;
    alreadyStreamed?: boolean;
  },
): void {
  writer.send("message.interim", {
    runId: input.runId,
    ...(input.turnId ? { turnId: input.turnId } : {}),
    text: input.text,
    alreadyStreamed: input.alreadyStreamed === true,
  });
}

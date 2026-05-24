import type { CanonicalTurnOutput, RunRecord } from "@jlc/contracts";
import type { CreateRunRequest } from "../types.js";
import {
  appendRunEvent,
  patchRunRecord,
  saveRunRecord,
  updateRunStatus,
} from "./store.js";
import type { RunEventWriter } from "./sse.js";

function toRunRecord(
  req: CreateRunRequest,
  runId: string,
  input?: {
    status?: RunRecord["status"];
    parentRunId?: string;
    canonicalOutput?: CanonicalTurnOutput;
  },
): RunRecord {
  return {
    runId,
    tenantId: "local",
    projectId: req.projectId,
    workspaceId: req.workspaceProjectId,
    sessionId: req.sessionId,
    turnId: `turn-${runId}`,
    agentId: req.agentId,
    agentModel: req.agentModel,
    status: input?.status ?? "accepted",
    queuePolicy: "interrupt",
    createdAt: new Date().toISOString(),
    ...(input?.canonicalOutput
      ? { canonicalOutput: input.canonicalOutput }
      : {}),
    ...(input?.parentRunId ? { parentRunId: input.parentRunId } : {}),
  };
}

function mapEvent(
  eventName: string,
  runId: string,
  data: unknown,
): Record<string, unknown> | null {
  const payload =
    data && typeof data === "object" ? (data as Record<string, unknown>) : {};

  if (eventName === "run.accepted") {
    return {
      type: "run.accepted",
      runId,
      message:
        typeof payload.message === "string" ? payload.message : undefined,
    };
  }
  if (eventName === "run.started") {
    return {
      type: "run.started",
      runId,
      cwd: typeof payload.cwd === "string" ? payload.cwd : "",
      agentId:
        typeof payload.agentId === "string" ? payload.agentId : "unknown",
      capabilities: Array.isArray(payload.injectedSkills)
        ? payload.injectedSkills.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined,
    };
  }
  if (eventName === "run.status") {
    return {
      type: "run.status",
      runId,
      phase: typeof payload.phase === "string" ? payload.phase : "running",
      label: typeof payload.label === "string" ? payload.label : "处理中",
    };
  }
  if (eventName === "message.delta") {
    const text =
      typeof payload.content === "string"
        ? payload.content
        : typeof payload.text === "string"
          ? payload.text
          : typeof payload.delta === "string"
            ? payload.delta
            : "";
    return {
      type: "message.delta",
      runId,
      turnId: `turn-${runId}`,
      text,
    };
  }
  if (eventName === "message.interim" || eventName === "interim_assistant") {
    return {
      type: "message.interim",
      runId,
      turnId: `turn-${runId}`,
      text: typeof payload.text === "string" ? payload.text : "",
      alreadyStreamed:
        payload.alreadyStreamed === true || payload.already_streamed === true,
    };
  }
  if (eventName === "tool.progress") {
    const status =
      payload.status === "error" || payload.status === "failed"
        ? "failed"
        : payload.status === "success" || payload.status === "done"
          ? "done"
          : "running";
    return {
      type: "tool.progress",
      runId,
      tool: typeof payload.tool === "string" ? payload.tool : "tool",
      status,
      message:
        typeof payload.message === "string" ? payload.message : undefined,
    };
  }
  if (eventName === "todo.update") {
    return {
      type: "todo.update",
      runId,
      items: Array.isArray(payload.items) ? payload.items : [],
    };
  }
  if (eventName === "run.finished") {
    return { type: "run.finished", runId };
  }
  if (eventName === "canonical.output") {
    return {
      type: "canonical.output" as const,
      runId,
      canonicalOutput: payload.canonicalOutput as CanonicalTurnOutput,
    };
  }
  if (eventName === "run.cancelled") {
    return { type: "run.cancelled", runId };
  }
  if (eventName === "run.error") {
    return {
      type: "run.error",
      runId,
      code: typeof payload.code === "string" ? payload.code : "run_error",
      message:
        typeof payload.message === "string" ? payload.message : "run failed",
    };
  }
  return null;
}

async function persistStatusSideEffect(
  eventName: string,
  runId: string,
  data?: unknown,
): Promise<void> {
  if (eventName === "run.accepted") {
    await updateRunStatus(runId, "accepted");
    return;
  }
  if (eventName === "run.started") {
    await updateRunStatus(runId, "running", {
      startedAt: new Date().toISOString(),
    });
    return;
  }
  if (eventName === "run.finished") {
    await updateRunStatus(runId, "completed", {
      finishedAt: new Date().toISOString(),
    });
    return;
  }
  if (eventName === "canonical.output") {
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    const canonicalOutput =
      payload.canonicalOutput && typeof payload.canonicalOutput === "object"
        ? (payload.canonicalOutput as CanonicalTurnOutput)
        : undefined;
    if (canonicalOutput) {
      await patchRunRecord(runId, {
        status:
          canonicalOutput.outcome.status === "failed"
            ? "failed"
            : canonicalOutput.outcome.status === "cancelled"
              ? "cancelled"
              : canonicalOutput.outcome.status === "waiting_user"
                ? "waiting_user"
                : "completed",
        finishedAt: new Date(
          canonicalOutput.outcome.finishedAt ?? Date.now(),
        ).toISOString(),
        canonicalOutput,
      });
    }
    return;
  }
  if (eventName === "run.cancelled") {
    await updateRunStatus(runId, "cancelled", {
      finishedAt: new Date().toISOString(),
    });
    return;
  }
  if (eventName === "run.error") {
    await updateRunStatus(runId, "failed", {
      finishedAt: new Date().toISOString(),
    });
    return;
  }
}

export async function primeRuntimeRunRecord(
  req: CreateRunRequest,
  runId: string,
  input?: { parentRunId?: string; status?: RunRecord["status"] },
): Promise<RunRecord> {
  return saveRunRecord(toRunRecord(req, runId, input));
}

export function createRuntimeStoreWriter(
  req: CreateRunRequest,
  runId: string,
  baseWriter: RunEventWriter,
  input?: { parentRunId?: string; status?: RunRecord["status"] },
): RunEventWriter {
  let recordPromise = primeRuntimeRunRecord(req, runId, input);
  let flushChain: Promise<void> = Promise.resolve();

  const schedule = (job: () => Promise<void>): void => {
    flushChain = flushChain.then(job).catch(() => {});
  };

  return {
    send(eventName: string, data: unknown) {
      baseWriter.send(eventName, data);
      const event = mapEvent(eventName, runId, data);
      if (!event) return;
      schedule(async () => {
        await recordPromise;
        await appendRunEvent(runId, event as never);
        await persistStatusSideEffect(eventName, runId, data);
      });
    },
    end() {
      baseWriter.end();
    },
    async flush() {
      await recordPromise;
      await flushChain;
      await baseWriter.flush?.();
    },
  };
}

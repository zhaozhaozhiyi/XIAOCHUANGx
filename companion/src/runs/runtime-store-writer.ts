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
      cwdSource:
        typeof payload.cwdSource === "string" ? payload.cwdSource : undefined,
      capabilities: Array.isArray(payload.injectedSkills)
        ? payload.injectedSkills.filter(
            (item): item is string => typeof item === "string",
          )
        : undefined,
      processSkill:
        typeof payload.processSkill === "string" ? payload.processSkill : null,
      baseProcessSkill:
        typeof payload.baseProcessSkill === "string"
          ? payload.baseProcessSkill
          : null,
      platformNormSkill:
        typeof payload.platformNormSkill === "string"
          ? payload.platformNormSkill
          : null,
      orchestrationMode:
        typeof payload.orchestrationMode === "string"
          ? payload.orchestrationMode
          : null,
      catalogVersion:
        typeof payload.catalogVersion === "string"
          ? payload.catalogVersion
          : null,
      catalogSlugs: Array.isArray(payload.catalogSlugs)
        ? payload.catalogSlugs.filter(
            (item): item is string => typeof item === "string",
          )
        : null,
      injectedSkills: Array.isArray(payload.injectedSkills)
        ? payload.injectedSkills.filter(
            (item): item is string => typeof item === "string",
          )
        : null,
      missingSkills: Array.isArray(payload.missingSkills)
        ? payload.missingSkills.filter(
            (item): item is string => typeof item === "string",
          )
        : null,
      catalogMissingSlugs: Array.isArray(payload.catalogMissingSlugs)
        ? payload.catalogMissingSlugs.filter(
            (item): item is string => typeof item === "string",
          )
        : null,
      skillsRoot:
        typeof payload.skillsRoot === "string" ? payload.skillsRoot : undefined,
      promptsRoot:
        typeof payload.promptsRoot === "string"
          ? payload.promptsRoot
          : undefined,
      agentKitPath:
        typeof payload.agentKitPath === "string" ? payload.agentKitPath : null,
      timeoutProfile:
        typeof payload.timeoutProfile === "string"
          ? payload.timeoutProfile
          : undefined,
      timeoutMs:
        typeof payload.timeoutMs === "number" &&
        Number.isFinite(payload.timeoutMs) &&
        payload.timeoutMs > 0
          ? Math.floor(payload.timeoutMs)
          : undefined,
      idleTimeoutMs:
        typeof payload.idleTimeoutMs === "number" &&
        Number.isFinite(payload.idleTimeoutMs) &&
        payload.idleTimeoutMs > 0
          ? Math.floor(payload.idleTimeoutMs)
          : undefined,
      stablePromptHash:
        typeof payload.stablePromptHash === "string"
          ? payload.stablePromptHash
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
  if (eventName === "project.ensured") {
    const id =
      typeof payload.id === "string"
        ? payload.id
        : typeof payload.projectId === "string"
          ? payload.projectId
          : "";
    if (!id) return null;
    return {
      type: "project.ensured",
      runId,
      id,
      name: typeof payload.name === "string" ? payload.name : id,
      pathSummary:
        typeof payload.pathSummary === "string" ? payload.pathSummary : "",
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
  if (eventName === "clarification.required") {
    return {
      type: "clarification.required",
      runId,
      clarificationId:
        typeof payload.clarificationId === "string"
          ? payload.clarificationId
          : typeof payload.toolUseId === "string"
            ? payload.toolUseId
            : "",
      question:
        typeof payload.question === "string" ? payload.question : "请补充信息",
      options: Array.isArray(payload.options)
        ? payload.options.filter((item): item is string => typeof item === "string")
        : undefined,
    };
  }
  if (eventName === "run.waiting_user") {
    return {
      type: "run.waiting_user",
      runId,
      waitingFor: "clarification",
    };
  }
  if (eventName === "run.resumed") {
    return {
      type: "run.resumed",
      runId,
    };
  }
  if (eventName === "todo.update") {
    return {
      type: "todo.update",
      runId,
      items: Array.isArray(payload.items) ? payload.items : [],
    };
  }
  if (eventName === "part.append" && payload.part) {
    return {
      type: "part.append",
      runId,
      part: payload.part,
    };
  }
  if (eventName === "part.patch") {
    return {
      type: "part.patch",
      runId,
      id: typeof payload.id === "string" ? payload.id : "",
      merge:
        payload.merge && typeof payload.merge === "object"
          ? (payload.merge as Record<string, unknown>)
          : {},
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
  if (eventName === "run.waiting_user" || eventName === "clarification.required") {
    await updateRunStatus(runId, "waiting_user");
    return;
  }
  if (eventName === "run.resumed") {
    await updateRunStatus(runId, "running");
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

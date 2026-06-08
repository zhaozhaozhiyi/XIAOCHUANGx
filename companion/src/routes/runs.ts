import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AGENT_IDS, isAgentId } from "@jlc/runtime-core";
import type { CreateRunRequest, ModuleId } from "../types.js";
import {
  cancelRun,
  getActiveRunIdForSession,
  getActiveRunRequest,
  startDetachedRun,
  submitRunClarification,
} from "../runs/manager.js";
import {
  runControlRequestSchema,
  type RunControlRequest,
} from "@jlc/contracts";
import {
  enqueueSessionRunControl,
  peekSessionRunQueue,
} from "../runs/queue.js";
import { scheduleSessionQueueDrain } from "../runs/queue-runner.js";
import {
  appendRunEvent,
  loadRunEvents,
  loadRunRecord,
  saveRunRecord,
} from "../runs/store.js";
import { createSseWriter } from "../runs/sse.js";
import type { RunEvent } from "@jlc/contracts";

const VALID_AGENT_IDS = new Set<string>(AGENT_IDS);
const MODULE_IDS = new Set<string>([
  "chat",
  "meeting",
  "knowledge",
  "writing",
  "ppt",
  "translate",
]);
const TIMEOUT_PROFILES = new Set([
  "default",
  "fast",
  "deep",
  "writing",
  "ppt",
  "translate",
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalRunEvent(event: RunEvent): boolean {
  return (
    event.type === "run.finished" ||
    event.type === "run.error" ||
    event.type === "run.cancelled"
  );
}

function replayPayloadForSse(event: RunEvent): unknown {
  if (event.type === "tool.progress") {
    return {
      ...event,
      status:
        event.status === "done"
          ? "success"
          : event.status === "failed"
            ? "error"
            : event.status,
    };
  }
  if (event.type === "message.delta") {
    return { ...event, content: event.text };
  }
  return event;
}

function parseCreateRun(body: unknown): CreateRunRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.sessionId !== "string" || !b.sessionId.trim()) return null;
  if (typeof b.workspaceProjectId !== "string") return null;
  if (typeof b.agentId !== "string" || !VALID_AGENT_IDS.has(b.agentId)) return null;
  if (!isAgentId(b.agentId)) return null;
  if (typeof b.agentModel !== "string") return null;
  if (typeof b.moduleId !== "string" || !MODULE_IDS.has(b.moduleId)) return null;
  if (!b.binding || typeof b.binding !== "object") return null;
  if (!Array.isArray(b.messages)) return null;

  const messages = b.messages
    .filter(
      (m): m is { role: string; content: string; agentId?: string; id?: string; attachments?: unknown[] } =>
        !!m &&
        typeof m === "object" &&
        (m as { role: string }).role in { user: 1, assistant: 1 } &&
        typeof (m as { content: string }).content === "string",
    )
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      attachments: m.attachments,
      ...(typeof m.agentId === "string" && m.agentId.trim()
        ? { agentId: m.agentId.trim() }
        : {}),
    }));

  return {
    sessionId: b.sessionId.trim(),
    projectId: typeof b.projectId === "string" ? b.projectId : "none",
    workspaceProjectId: String(b.workspaceProjectId),
    moduleId: b.moduleId as ModuleId,
    binding: b.binding as CreateRunRequest["binding"],
    agentId: b.agentId,
    agentModel: String(b.agentModel),
    messages,
    useClientHistory: b.useClientHistory === true,
    processSkill:
      typeof b.processSkill === "string" ? b.processSkill : null,
    platformNormSkill:
      typeof b.platformNormSkill === "string"
        ? b.platformNormSkill
        : "skill-platform-research-norms",
    timeoutProfile:
      typeof b.timeoutProfile === "string" &&
      TIMEOUT_PROFILES.has(b.timeoutProfile)
        ? (b.timeoutProfile as CreateRunRequest["timeoutProfile"])
        : undefined,
    timeoutMs:
      typeof b.timeoutMs === "number" && Number.isFinite(b.timeoutMs) && b.timeoutMs > 0
        ? Math.floor(b.timeoutMs)
        : undefined,
    idleTimeoutMs:
      typeof b.idleTimeoutMs === "number" &&
      Number.isFinite(b.idleTimeoutMs) &&
      b.idleTimeoutMs > 0
        ? Math.floor(b.idleTimeoutMs)
        : undefined,
  };
}

export async function runRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { runId: string } }>(
    "/v1/runs/:runId",
    async (request, reply) => {
      const record = await loadRunRecord(request.params.runId);
      if (!record) {
        return reply.code(404).send({ error: "run_not_found" });
      }
      return reply.send(record);
    },
  );

  app.get<{ Params: { runId: string } }>(
    "/v1/runs/:runId/events",
    async (request, reply) => {
      const record = await loadRunRecord(request.params.runId);
      if (!record) {
        return reply.code(404).send({ error: "run_not_found" });
      }
      const items = await loadRunEvents(request.params.runId);
      return reply.send({
        runId: request.params.runId,
        items,
        count: items.length,
      });
    },
  );

  app.post("/v1/runs", async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = parseCreateRun(request.body);
    if (!parsed) {
      return reply.code(400).send({
        error: "invalid_body",
        message:
          "sessionId, workspaceProjectId, agentId, moduleId, binding, messages required",
      });
    }

    reply.hijack();
    const raw = reply.raw;
    const runId = await startDetachedRun(parsed);
    const writer = createSseWriter(raw, {
      "X-JLC-Run-Id": runId,
      "X-JLC-Agent-Id": parsed.agentId,
      "X-JLC-Execution-Mode": "detached",
    });
    let closed = false;
    raw.on("close", () => {
      closed = true;
    });

    let cursor = 0;
    let terminalSeen = false;
    const startedAt = Date.now();
    while (!closed && !terminalSeen) {
      const events = await loadRunEvents(runId);
      for (const event of events.slice(cursor)) {
        writer.send(event.type, replayPayloadForSse(event));
        terminalSeen = terminalSeen || isTerminalRunEvent(event);
      }
      cursor = events.length;
      if (terminalSeen) break;
      if (Date.now() - startedAt > 30 * 60 * 1000) break;
      await sleep(250);
    }
    if (!closed) writer.end();
  });

  app.post<{ Params: { runId: string } }>(
    "/v1/runs/:runId/clarification",
    async (request, reply) => {
      const body =
        request.body && typeof request.body === "object"
          ? (request.body as Record<string, unknown>)
          : {};
      const content = typeof body.content === "string" ? body.content.trim() : "";
      if (!content) {
        return reply.code(400).send({
          error: "invalid_body",
          message: "content is required",
        });
      }
      const result = submitRunClarification(request.params.runId, {
        toolUseId:
          typeof body.toolUseId === "string" ? body.toolUseId : undefined,
        content,
      });
      if (!result.ok) {
        return reply.code(409).send({
          error: result.error,
          message: result.message,
        });
      }
      return { ok: true, runId: request.params.runId };
    },
  );

  app.post<{ Params: { runId: string } }>(
    "/v1/runs/:runId/cancel",
    async (request, reply) => {
      const ok = cancelRun(request.params.runId);
      if (!ok) {
        return reply.code(404).send({ error: "run_not_found" });
      }
      return { ok: true, runId: request.params.runId };
    },
  );

  app.post<{ Params: { runId: string } }>(
    "/v1/runs/:runId/control",
    async (request, reply) => {
      const parsed = runControlRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const { runId } = request.params;
      const body = parsed.data as RunControlRequest;
      const activeRequest = getActiveRunRequest(runId);
      const sessionId = activeRequest?.sessionId ?? runId;

      if (body.action === "interrupt") {
        const ok = cancelRun(runId);
        if (!ok) {
          return reply.code(404).send({ error: "run_not_found" });
        }
        return {
          ok: true,
          runId,
          action: body.action,
        };
      }

      if (body.action === "enqueue") {
        const baseRequest = activeRequest;
        if (!baseRequest) {
          return reply.code(404).send({
            error: "run_not_found",
            message: "仅支持对当前活动 Run 追加排队消息",
          });
        }
        const items = await peekSessionRunQueue(sessionId);
        const queuedRequest: CreateRunRequest = {
          ...baseRequest,
          messages: [
            ...baseRequest.messages,
            { role: "user", content: body.text, attachments: body.attachments },
          ],
        };
        const queuedRunId = `run-${Date.now()}`;
        await saveRunRecord({
          runId: queuedRunId,
          tenantId: "local",
          projectId: queuedRequest.projectId,
          workspaceId: queuedRequest.workspaceProjectId,
          sessionId,
          turnId: `turn-${queuedRunId}`,
          agentId: queuedRequest.agentId,
          agentModel: queuedRequest.agentModel,
          status: "queued",
          queuePolicy: "enqueue",
          createdAt: new Date().toISOString(),
          parentRunId: runId,
        });
        await appendRunEvent(queuedRunId, {
          type: "run.queued",
          runId: queuedRunId,
          position: items.length,
          reason: "waiting_for_active_run",
        });
        const queued = await enqueueSessionRunControl({
          id: `queue-${Date.now()}`,
          runId: queuedRunId,
          sessionId,
          action: "enqueue",
          text: body.text,
          attachments: body.attachments,
          request: queuedRequest,
          createdAt: new Date().toISOString(),
        });
        const currentRunId = getActiveRunIdForSession(sessionId);
        if (!currentRunId) {
          scheduleSessionQueueDrain(sessionId);
        }
        return {
          ok: true,
          runId: queuedRunId,
          sessionId,
          action: body.action,
          queueLength: queued.items.length,
          position: items.length + 1,
        };
      }

      return reply.code(501).send({
        error: "not_implemented",
        code: `${body.action}_not_implemented`,
        message: `${body.action} 尚未在 Companion 中实现`,
      });
    },
  );
}

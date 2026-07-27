import type { FastifyInstance } from "fastify";
import {
  listSessionMessages,
  loadSessionMessages,
  saveSessionMessages,
  type StoredChatMessage,
} from "../sessions/store.js";
import {
  loadSessionRuntime,
  type SessionRuntimeRecord,
} from "../sessions/runtime.js";
import { getSessionQueueState } from "../runs/queue-runner.js";
import { listSessionRunRecords } from "../runs/store.js";

export function parseMessages(body: unknown): StoredChatMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;
  const messages: StoredChatMessage[] = [];
  for (const m of b.messages) {
    if (!m || typeof m !== "object") continue;
    const row = m as Record<string, unknown>;
    if (
      typeof row.id !== "string" ||
      (row.role !== "user" && row.role !== "assistant") ||
      typeof row.content !== "string"
    ) {
      continue;
    }
    messages.push({
      id: row.id,
      role: row.role,
      content: row.content,
      attachments: Array.isArray(row.attachments) ? row.attachments : undefined,
      status:
        row.status === "complete" ||
        row.status === "loading" ||
        row.status === "streaming" ||
        row.status === "error" ||
        row.status === "cancelled"
          ? row.status
          : undefined,
      parts: Array.isArray(row.parts) ? row.parts : undefined,
      activityCollapse:
        typeof row.activityCollapse === "string"
          ? row.activityCollapse
          : undefined,
      finalCollapseRevision:
        typeof row.finalCollapseRevision === "number" &&
        Number.isInteger(row.finalCollapseRevision) &&
        row.finalCollapseRevision >= 0
          ? row.finalCollapseRevision
          : undefined,
      runId: typeof row.runId === "string" ? row.runId : undefined,
      runStartedAt:
        typeof row.runStartedAt === "number" ? row.runStartedAt : undefined,
      canonicalOutput:
        row.canonicalOutput && typeof row.canonicalOutput === "object"
          ? row.canonicalOutput
          : undefined,
    });
  }
  return messages;
}

function resolvedProjectId(
  projectId: string | undefined,
  runtime: SessionRuntimeRecord | null,
): string | null {
  if (projectId && projectId !== "none") return projectId;
  if (runtime?.projectId && runtime.projectId !== "none") {
    return runtime.projectId;
  }
  if (
    runtime?.workspaceProjectId &&
    runtime.workspaceProjectId !== "none" &&
    runtime.workspaceProjectId !== "__lazy_default__"
  ) {
    return runtime.workspaceProjectId;
  }
  return projectId ?? null;
}

function sessionTitle(messages: StoredChatMessage[]): string {
  const firstUserText =
    messages.find((message) => message.role === "user")?.content ?? "";
  return firstUserText.replace(/\s+/g, " ").trim().slice(0, 48) || "新对话";
}

function sessionRunStatus(
  runtime: SessionRuntimeRecord | null,
): "idle" | "running" | "waiting_user" {
  if (runtime?.lastRunStatus === "waiting_user") return "waiting_user";
  if (
    runtime?.lastRunStatus === "queued" ||
    runtime?.lastRunStatus === "running"
  ) {
    return "running";
  }
  return "idle";
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/sessions", async (_req, reply) => {
    const records = await listSessionMessages();
    const items = await Promise.all(
      records.map(async (record) => {
        const runtime = await loadSessionRuntime(record.sessionId);
        return {
          sessionId: record.sessionId,
          title: sessionTitle(record.messages),
          projectId: resolvedProjectId(record.projectId, runtime),
          surfaceModuleId: runtime?.moduleId ?? "chat",
          createdAt: runtime?.createdAt ?? record.updatedAt,
          updatedAt: record.updatedAt,
          runStatus: sessionRunStatus(runtime),
        };
      }),
    );
    return reply.send({ items, count: items.length });
  });

  app.get<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/messages",
    async (req, reply) => {
      const sessionId = req.params.sessionId.trim();
      if (!sessionId) {
        return reply.status(400).send({ error: "sessionId required" });
      }
      const record = await loadSessionMessages(sessionId);
      if (!record) {
        return reply.send({ sessionId, messages: [], updatedAt: null });
      }
      const runtime = await loadSessionRuntime(sessionId);
      const projectId = resolvedProjectId(record.projectId, runtime);
      return reply.send({
        sessionId: record.sessionId,
        projectId,
        messages: record.messages,
        updatedAt: record.updatedAt,
      });
    },
  );

  app.put<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/messages",
    async (req, reply) => {
      const sessionId = req.params.sessionId.trim();
      if (!sessionId) {
        return reply.status(400).send({ error: "sessionId required" });
      }
      const messages = parseMessages(req.body);
      if (!messages) {
        return reply.status(400).send({ error: "messages array required" });
      }
      const projectId =
        req.body &&
        typeof req.body === "object" &&
        typeof (req.body as { projectId?: string }).projectId === "string"
          ? (req.body as { projectId: string }).projectId
          : undefined;
      const record = await saveSessionMessages(sessionId, messages, projectId);
      return reply.send({
        sessionId: record.sessionId,
        updatedAt: record.updatedAt,
        count: record.messages.length,
      });
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/runs",
    async (req, reply) => {
      const sessionId = req.params.sessionId.trim();
      if (!sessionId) {
        return reply.status(400).send({ error: "sessionId required" });
      }
      const items = await listSessionRunRecords(sessionId);
      return reply.send({
        sessionId,
        items,
        count: items.length,
      });
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/queue",
    async (req, reply) => {
      const sessionId = req.params.sessionId.trim();
      if (!sessionId) {
        return reply.status(400).send({ error: "sessionId required" });
      }
      const state = await getSessionQueueState(sessionId);
      return reply.send({
        sessionId,
        items: state.items,
        count: state.count,
        running: state.running,
      });
    },
  );
}

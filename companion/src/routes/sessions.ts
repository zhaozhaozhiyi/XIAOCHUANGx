import type { FastifyInstance } from "fastify";
import {
  loadSessionMessages,
  saveSessionMessages,
  type StoredChatMessage,
} from "../sessions/store.js";
import { loadSessionRuntime } from "../sessions/runtime.js";
import { getSessionQueueState } from "../runs/queue-runner.js";
import { listSessionRunRecords } from "../runs/store.js";

function parseMessages(body: unknown): StoredChatMessage[] | null {
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

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
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
      const projectId =
        record.projectId && record.projectId !== "none"
          ? record.projectId
          : runtime?.projectId && runtime.projectId !== "none"
            ? runtime.projectId
            : runtime?.workspaceProjectId &&
                runtime.workspaceProjectId !== "none" &&
                runtime.workspaceProjectId !== "__lazy_default__"
              ? runtime.workspaceProjectId
              : (record.projectId ?? null);
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

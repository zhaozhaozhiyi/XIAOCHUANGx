import type { FastifyInstance } from "fastify";
import { AGENT_IDS } from "@jlc/runtime-core";
import { detectAllAgents, testAgent } from "../agents/detect.js";
import type { AgentId, AgentTestRequest } from "../types.js";

const VALID_AGENT_IDS = new Set<AgentId>(AGENT_IDS);

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  const handler = async () => detectAllAgents();

  app.get("/v1/agents", handler);
  app.post("/v1/agents/detect", handler);

  app.post<{ Body: AgentTestRequest }>(
    "/v1/agents/test",
    async (request, reply) => {
      const agentId = request.body?.agentId;
      if (!agentId || !VALID_AGENT_IDS.has(agentId)) {
        return reply.status(400).send({
          error: "invalid_agent_id",
          message: `agentId 须为 ${AGENT_IDS.join(" | ")}`,
        });
      }
      return testAgent(agentId);
    },
  );
}

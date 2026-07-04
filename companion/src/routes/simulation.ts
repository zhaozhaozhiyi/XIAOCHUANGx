import type { FastifyInstance } from "fastify";
import {
  listCanvasSnapshots,
  loadCanvasSnapshot,
} from "../simulation/snapshot.js";

export async function simulationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { sessionId: string } }>(
    "/v1/sessions/:sessionId/simulation/rounds",
    async (request) => {
      const rounds = await listCanvasSnapshots(request.params.sessionId);
      return {
        sessionId: request.params.sessionId,
        rounds,
        count: rounds.length,
      };
    },
  );

  app.get<{ Params: { sessionId: string; roundId: string } }>(
    "/v1/sessions/:sessionId/simulation/rounds/:roundId",
    async (request, reply) => {
      const snapshot = await loadCanvasSnapshot({
        sessionId: request.params.sessionId,
        roundId: request.params.roundId,
      });
      if (!snapshot) {
        return reply.code(404).send({ error: "snapshot_not_found" });
      }
      return {
        sessionId: request.params.sessionId,
        snapshot,
      };
    },
  );
}

import type { FastifyInstance } from "fastify";
import { config, PACKAGE_VERSION } from "../config.js";
import { COMPANION_API_VERSION } from "../types.js";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", async () => {
    const body = {
      ok: true,
      version: PACKAGE_VERSION,
      apiVersion: COMPANION_API_VERSION,
      companionId: config.companionId,
      dataDir: config.dataDir,
      runMode: config.runMode,
    };
    return body;
  });
}

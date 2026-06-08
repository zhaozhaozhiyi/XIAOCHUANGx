import Fastify from "fastify";
import cors from "@fastify/cors";
import { authHook } from "./auth.js";
import { config, assertLoopbackBind } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { agentRoutes } from "./routes/agents.js";
import { desktopRoutes } from "./routes/desktop.js";
import { projectRoutes } from "./routes/projects.js";
import { runRoutes } from "./routes/runs.js";
import { sessionRoutes } from "./routes/sessions.js";

export async function buildServer() {
  assertLoopbackBind();

  const app = Fastify({
    logger: {
      level: process.env.COMPANION_LOG_LEVEL ?? "info",
    },
    bodyLimit: Number(process.env.COMPANION_BODY_LIMIT_MB ?? 30) * 1024 * 1024,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        return cb(null, true);
      }
      cb(new Error("CORS not allowed"), false);
    },
  });

  app.addHook("preHandler", authHook);

  app.get("/", async () => ({
    service: "@jlcresearch/companion",
    api: "/v1/health",
  }));

  await app.register(healthRoutes);
  await app.register(agentRoutes);
  await app.register(desktopRoutes);
  await app.register(projectRoutes);
  await app.register(runRoutes);
  await app.register(sessionRoutes);

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ host: config.host, port: config.port });
  return app;
}

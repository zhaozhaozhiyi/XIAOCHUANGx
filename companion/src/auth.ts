import type { FastifyReply, FastifyRequest } from "fastify";
import { config, useAuth } from "./config.js";

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!useAuth()) return;

  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : undefined;

  if (!token || token !== config.apiToken) {
    reply.code(401).send({
      error: "unauthorized",
      message: "Invalid or missing Companion API token",
    });
  }
}

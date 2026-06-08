/**
 * 桌面壳专属路由 — V1.1 D1.3（desktop-v1.1-roadmap.md §5）
 *
 * /v1/desktop/register（POST）
 *   in:  { clientId?: string, label?: string }
 *   out: { clientId, secret, createdAt, secretsPath }
 *
 *   - 同 clientId 重复调用是幂等的：返回已有 secret，仅刷新 lastSeenAt/label
 *   - 桌面壳侧首次调用时不传 clientId → companion 生成；后续再调用必须把
 *     桌面壳已持久化的 clientId 传上来，否则会得到一个新 client（旧的留着
 *     当孤儿条目，等手动清理）
 *
 * 安全前提：本路由依赖 Companion 已经在 loopback 上监听（assertLoopbackBind）
 * 加上 authHook 可选 token 鉴权；HMAC 设计本身不替代这两层。
 */

import type { FastifyInstance } from "fastify";
import {
  desktopSecretsPath,
  registerDesktopClient,
} from "../desktop/secrets.js";

export async function desktopRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      clientId?: string;
      label?: string;
    };
  }>("/v1/desktop/register", async (request, reply) => {
    const { clientId, label } = request.body ?? {};
    try {
      const out = await registerDesktopClient({
        clientId: clientId?.trim() || undefined,
        label: label?.trim() || undefined,
      });
      return reply.code(200).send({
        clientId: out.clientId,
        secret: out.secret,
        createdAt: out.createdAt,
        secretsPath: desktopSecretsPath(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(500).send({ error: msg });
    }
  });
}

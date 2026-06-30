import {
  chatExecutionMode,
  companionConfig,
  companionUrl,
} from "@/lib/companion/config";
import { mockCompanionAgents } from "@/lib/companion/mock";
import type { AgentTestResponse } from "@/lib/companion/types";
import { isAgentId } from "@jlc/runtime-core/agent-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const execution = chatExecutionMode();
  if (execution !== "companion") {
    return Response.json(
      { ok: false, message: "当前未启用 Companion 执行面" },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    agentId?: unknown;
  };
  const agentId = body.agentId;
  if (typeof agentId !== "string" || !isAgentId(agentId)) {
    return Response.json(
      { ok: false, message: "无效的 agentId" },
      { status: 400 },
    );
  }

  if (companionConfig.useMock) {
    const agents = mockCompanionAgents();
    const state = agents.agents.find((a) => a.agentId === agentId);
    const res: AgentTestResponse = {
      ok: state?.status === "available",
      agentId,
      message:
        state?.status === "available"
          ? `Mock 已就绪${state.version ? `（${state.version}）` : ""}`
          : state?.hint ?? "Mock：智能体不可用",
    };
    return Response.json(res);
  }

  try {
    const res = await fetch(companionUrl("/v1/agents/test"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(companionConfig.apiToken
          ? { Authorization: `Bearer ${companionConfig.apiToken}` }
          : {}),
      },
      body: JSON.stringify({ agentId }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await res.json().catch(() => ({}))) as AgentTestResponse;
    return Response.json(payload, { status: res.ok ? 200 : res.status });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        agentId,
        message: err instanceof Error ? err.message : "测试失败",
      },
      { status: 503 },
    );
  }
}

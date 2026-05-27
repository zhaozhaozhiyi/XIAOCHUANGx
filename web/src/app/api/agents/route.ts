import {
  chatExecutionMode,
  companionAgentsDetectUrl,
  companionAgentsUrl,
  companionConfig,
  companionHealthUrl,
} from "@/lib/companion/config";
import { mockCompanionAgents, mockCompanionHealth } from "@/lib/companion/mock";
import type { CompanionAgentsResponse } from "@/lib/companion/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authHeaders(): Record<string, string> {
  return companionConfig.apiToken
    ? { Authorization: `Bearer ${companionConfig.apiToken}` }
    : {};
}

async function fetchAgentsFromCompanion(): Promise<{
  agents: CompanionAgentsResponse;
  health: { ok: boolean; version?: string };
  mode: "live" | "mock";
}> {
  if (companionConfig.useMock) {
    return {
      agents: mockCompanionAgents(),
      health: mockCompanionHealth(),
      mode: "mock",
    };
  }

  const [healthRes, agentsRes] = await Promise.all([
    fetch(companionHealthUrl(), {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    }),
    fetch(companionAgentsUrl(), {
      method: "GET",
      headers: authHeaders(),
      signal: AbortSignal.timeout(10_000),
    }),
  ]);

  if (!agentsRes.ok) {
    throw new Error(`agents_${agentsRes.status}`);
  }

  const agents = (await agentsRes.json()) as CompanionAgentsResponse;
  const health = (await healthRes.json().catch(() => ({}))) as {
    ok?: boolean;
    version?: string;
  };

  return {
    agents,
    health: { ok: healthRes.ok && !!health.ok, version: health.version },
    mode: "live",
  };
}

export async function GET() {
  const execution = chatExecutionMode();

  if (execution !== "companion") {
    return Response.json({
      execution,
      ok: false,
      error: "not_companion_mode",
      agents: [],
      inferenceChannel: "api_fallback",
    });
  }

  try {
    const { agents, health, mode } = await fetchAgentsFromCompanion();
    return Response.json({
      execution,
      ok: health.ok,
      mode,
      version: health.version,
      ...agents,
    });
  } catch (err) {
    return Response.json(
      {
        execution,
        ok: false,
        mode: "unreachable",
        error: err instanceof Error ? err.message : "unreachable",
        agents: [],
        inferenceChannel: "api_fallback",
      },
      { status: 503 },
    );
  }
}

export async function POST() {
  const execution = chatExecutionMode();

  if (execution !== "companion") {
    return Response.json(
      { error: "not_companion_mode", message: "当前未启用 Companion 执行面" },
      { status: 400 },
    );
  }

  try {
    if (companionConfig.useMock) {
      const agents = mockCompanionAgents();
      return Response.json({
        ok: true,
        mode: "mock",
        count: agents.agents.filter((a) => a.status === "available").length,
        ...agents,
      });
    }

    const res = await fetch(companionAgentsDetectUrl(), {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      // Fastify rejects Content-Type: application/json without a body
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`detect_${res.status}`);
    }

    const agents = (await res.json()) as CompanionAgentsResponse;
    const available = agents.agents.filter((a) => a.status === "available").length;

    return Response.json({
      ok: true,
      mode: "live",
      count: available,
      ...agents,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "detect_failed",
        agents: [],
        inferenceChannel: "api_fallback",
      },
      { status: 503 },
    );
  }
}

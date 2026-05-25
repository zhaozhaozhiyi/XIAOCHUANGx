import {
  chatExecutionMode,
  companionConfig,
  companionAgentsUrl,
  companionHealthUrl,
} from "@/lib/companion/config";
import { mockCompanionAgents, mockCompanionHealth } from "@/lib/companion/mock";
import { hermesConfig, hermesHealthUrl } from "@/lib/hermes/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const execution = chatExecutionMode();

  if (execution === "companion") {
    if (companionConfig.useMock) {
      const health = mockCompanionHealth();
      const agents = mockCompanionAgents();
      return Response.json({
        execution,
        ok: health.ok,
        mode: "mock",
        baseUrl: companionConfig.baseUrl,
        version: health.version,
        agents: agents.agents,
        inferenceChannel: agents.inferenceChannel,
      });
    }

    try {
      const [healthRes, agentsRes] = await Promise.all([
        fetch(companionHealthUrl(), {
          method: "GET",
          headers: companionConfig.apiToken
            ? { Authorization: `Bearer ${companionConfig.apiToken}` }
            : {},
          signal: AbortSignal.timeout(5000),
        }),
        fetch(companionAgentsUrl(), {
          method: "GET",
          headers: companionConfig.apiToken
            ? { Authorization: `Bearer ${companionConfig.apiToken}` }
            : {},
          signal: AbortSignal.timeout(5000),
        }),
      ]);

      const health = (await healthRes.json().catch(() => ({}))) as {
        ok?: boolean;
        version?: string;
        runMode?: string;
      };
      const agentsPayload = agentsRes.ok
        ? ((await agentsRes.json().catch(() => null)) as {
            agents?: unknown[];
            inferenceChannel?: string;
          } | null)
        : null;

      return Response.json({
        execution,
        ok: healthRes.ok && !!health.ok,
        mode: "live",
        baseUrl: companionConfig.baseUrl,
        version: health.version,
        runMode: health.runMode,
        agents: agentsPayload?.agents,
        inferenceChannel: agentsPayload?.inferenceChannel ?? "cli",
        agentsStatus: agentsRes.status,
      });
    } catch (err) {
      return Response.json({
        execution,
        ok: false,
        mode: "live",
        baseUrl: companionConfig.baseUrl,
        error: err instanceof Error ? err.message : "unreachable",
      });
    }
  }

  if (hermesConfig.useMock) {
    return Response.json({
      execution: "hermes",
      ok: true,
      mode: "mock",
      baseUrl: hermesConfig.baseUrl,
      model: hermesConfig.model,
    });
  }

  try {
    const res = await fetch(hermesHealthUrl(), {
      method: "GET",
      headers: hermesConfig.apiKey
        ? { Authorization: `Bearer ${hermesConfig.apiKey}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text().catch(() => "");
    return Response.json({
      execution: "hermes",
      ok: res.ok,
      mode: "live",
      status: res.status,
      baseUrl: hermesConfig.baseUrl,
      model: hermesConfig.model,
      body: text.slice(0, 200),
    });
  } catch (err) {
    return Response.json({
      execution: "hermes",
      ok: false,
      mode: "live",
      baseUrl: hermesConfig.baseUrl,
      error: err instanceof Error ? err.message : "unreachable",
    });
  }
}

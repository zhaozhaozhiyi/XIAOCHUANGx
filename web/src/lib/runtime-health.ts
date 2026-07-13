import type { AgentId } from "@/lib/settings";
import { getAgentDisplayName } from "@/lib/settings";
import type { CompanionAgentState } from "@/lib/companion/types";
import type { ChatExecutionMode } from "@/lib/companion/config";

export type RuntimeHealthResponse = {
  execution: ChatExecutionMode | "hermes";
  ok: boolean;
  mode?: "mock" | "live";
  baseUrl?: string;
  version?: string;
  /** Companion `/v1/health` 的 `runMode`（cli / simulate / spawn） */
  runMode?: string;
  model?: string;
  agents?: CompanionAgentState[];
  inferenceChannel?: string;
  agentsStatus?: number | "skipped";
  error?: string;
};

export async function fetchRuntimeHealth(): Promise<RuntimeHealthResponse> {
  try {
    const res = await fetch("/api/runtime/health", { cache: "no-store" });
    return (await res.json()) as RuntimeHealthResponse;
  } catch (err) {
    return {
      execution: "hermes",
      ok: false,
      error: err instanceof Error ? err.message : "health check failed",
    };
  }
}

export function runtimeStatusTitle(
  health: RuntimeHealthResponse,
  selectedAgentId?: AgentId,
  agentAliases?: Partial<Record<AgentId, string>>,
): string {
  if (health.execution === "companion") {
    if (!health.ok) {
      return `Companion 未连接 · ${health.error ?? "请启动本机 Companion 或开启 COMPANION_USE_MOCK"}`;
    }
    if (health.mode === "mock") {
      const agentName = selectedAgentId
        ? getAgentDisplayName(selectedAgentId, agentAliases)
        : null;
      return agentName
        ? `Companion Mock · 将模拟 spawn ${agentName}`
        : "Companion Mock · 本机 CLI 模拟";
    }
    const agent = health.agents?.find((a) => a.agentId === selectedAgentId);
    const runSuffix = health.runMode ? ` · ${health.runMode}` : "";
    if (selectedAgentId && agent) {
      const agentName = getAgentDisplayName(selectedAgentId, agentAliases);
      return agent.status === "available"
        ? `Companion 已连接 · ${agentName} 可用${runSuffix}`
        : `Companion 已连接 · ${agentName}: ${agent.status}${runSuffix}`;
    }
    if (health.agentsStatus === "skipped") {
      return `Companion 已连接${runSuffix} · Agent 状态请在设置中检测`;
    }
    return `Companion 已连接${runSuffix}`;
  }

  if (health.mode === "mock") {
    return "Hermes Gateway Mock（开发捷径，非量产路径）";
  }
  return health.ok
    ? "Hermes Gateway 已连接（开发捷径）"
    : "Hermes Gateway 未连接";
}

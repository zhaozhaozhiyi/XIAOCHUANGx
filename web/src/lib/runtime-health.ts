import type { AgentId } from "@/lib/settings";
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
): string {
  if (health.execution === "companion") {
    if (!health.ok) {
      return `Companion 未连接 · ${health.error ?? "请启动本机 Companion 或开启 COMPANION_USE_MOCK"}`;
    }
    if (health.mode === "mock") {
      return selectedAgentId
        ? `Companion Mock · 将模拟 spawn ${selectedAgentId} CLI`
        : "Companion Mock · 本机 CLI 模拟";
    }
    const agent = health.agents?.find((a) => a.agentId === selectedAgentId);
    const runSuffix = health.runMode ? ` · ${health.runMode}` : "";
    if (selectedAgentId && agent) {
      return agent.status === "available"
        ? `Companion 已连接 · ${selectedAgentId} CLI 可用${runSuffix}`
        : `Companion 已连接 · ${selectedAgentId}: ${agent.status}${runSuffix}`;
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

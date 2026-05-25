import {
  companionAgentsUrl,
  companionConfig,
  chatExecutionMode,
} from "@/lib/companion/config";
import { mockCompanionAgents } from "@/lib/companion/mock";
import type { CompanionAgentState } from "@/lib/companion/types";
import { agentLabel, type AgentId } from "@/lib/settings";

export async function fetchServerAgentStates(): Promise<CompanionAgentState[]> {
  if (chatExecutionMode() !== "companion") {
    return [];
  }
  if (companionConfig.useMock) {
    return mockCompanionAgents().agents;
  }
  try {
    const res = await fetch(companionAgentsUrl(), {
      headers: companionConfig.apiToken
        ? { Authorization: `Bearer ${companionConfig.apiToken}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const payload = (await res.json()) as { agents?: CompanionAgentState[] };
    return payload.agents ?? [];
  } catch {
    return [];
  }
}

export async function assertAgentAvailableServer(
  agentId: AgentId,
): Promise<string | null> {
  const agents = await fetchServerAgentStates();
  const state = agents.find((a) => a.agentId === agentId);
  if (!state) {
    return `${agentLabel(agentId)} 状态未知，请在设置中重新检测`;
  }
  if (state.status === "available") return null;
  if (state.status === "needs_login") {
    return `${agentLabel(agentId)} 需要先完成登录${state.hint ? `：${state.hint}` : ""}`;
  }
  if (state.status === "not_installed") {
    return `${agentLabel(agentId)} 未安装，请联系管理员安装小窗智能体组件`;
  }
  return `${agentLabel(agentId)} 版本过低，请联系管理员升级`;
}

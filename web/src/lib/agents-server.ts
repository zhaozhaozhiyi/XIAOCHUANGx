import {
  companionAgentsUrl,
  companionConfig,
  chatExecutionMode,
} from "@/lib/companion/config";
import { mockCompanionAgents } from "@/lib/companion/mock";
import type { CompanionAgentState } from "@/lib/companion/types";
import { agentLabel, type AgentId } from "@/lib/settings";

export type ServerAgentStatesResult = {
  agents: CompanionAgentState[];
  error: string | null;
};

export async function fetchServerAgentStates(): Promise<ServerAgentStatesResult> {
  if (chatExecutionMode() !== "companion") {
    return { agents: [], error: null };
  }
  if (companionConfig.useMock) {
    return { agents: mockCompanionAgents().agents, error: null };
  }
  try {
    const res = await fetch(companionAgentsUrl(), {
      headers: companionConfig.apiToken
        ? { Authorization: `Bearer ${companionConfig.apiToken}` }
        : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { agents: [], error: `Companion agents_${res.status}` };
    }
    const payload = (await res.json()) as { agents?: CompanionAgentState[] };
    return { agents: payload.agents ?? [], error: null };
  } catch (err) {
    return {
      agents: [],
      error: err instanceof Error ? err.message : "无法连接 Companion",
    };
  }
}

export async function assertAgentAvailableServer(
  agentId: AgentId,
): Promise<string | null> {
  const { agents, error } = await fetchServerAgentStates();
  if (error) {
    return `无法连接本机 Companion 或智能体状态探测超时：${error}`;
  }
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
  if (state.status === "timeout") {
    return `${agentLabel(agentId)} 探测超时${state.hint ? `：${state.hint}` : ""}`;
  }
  return `${agentLabel(agentId)} 版本过低，请联系管理员升级`;
}

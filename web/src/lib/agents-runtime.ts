import { AGENT_FALLBACK_MODELS } from "@/lib/agent-catalog";
import type {
  AgentModelOption,
  CompanionAgentState,
  CompanionAgentsResponse,
} from "@/lib/companion/types";
import {
  AGENT_DEFINITIONS,
  agentLabel,
  type AgentDefinition,
  type AgentId,
  type CliStatus,
  type InferenceChannel,
} from "@/lib/settings";

export type AgentsRuntimeState = {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  execution: "companion" | "hermes" | "unknown";
  companionOk: boolean;
  companionVersion: string | null;
  mode: "live" | "mock" | "unreachable";
  inferenceChannel: InferenceChannel;
  agents: CompanionAgentState[];
  detectedAt: number | null;
};

export const EMPTY_AGENTS_RUNTIME: AgentsRuntimeState = {
  loaded: false,
  loading: false,
  error: null,
  execution: "unknown",
  companionOk: false,
  companionVersion: null,
  mode: "unreachable",
  inferenceChannel: "api_fallback",
  agents: [],
  detectedAt: null,
};

export function agentStateMap(
  agents: CompanionAgentState[],
): Record<AgentId, CompanionAgentState> {
  const map = {} as Record<AgentId, CompanionAgentState>;
  for (const a of agents) {
    map[a.agentId] = a;
  }
  return map;
}

export function getAgentRuntimeState(
  runtime: AgentsRuntimeState,
  id: AgentId,
): CompanionAgentState | undefined {
  return runtime.agents.find((a) => a.agentId === id);
}

export function getAgentCapabilityRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
) {
  return getAgentRuntimeState(runtime, id)?.capability;
}

export function cliStatusFromRuntime(
  state: CompanionAgentState | undefined,
): CliStatus {
  return state?.status ?? "not_installed";
}

export function isAgentAvailableRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): boolean {
  return getAgentRuntimeState(runtime, id)?.status === "available";
}

export function agentSupportsInterruptRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): boolean {
  return getAgentCapabilityRuntime(runtime, id)?.supportsInterrupt === true;
}

export function agentSupportsSteerRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): boolean {
  return getAgentCapabilityRuntime(runtime, id)?.supportsSteer === true;
}

export function agentSupportsQueueRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): boolean {
  return getAgentCapabilityRuntime(runtime, id)?.supportsInterrupt === true;
}

export function agentSupportsResumeThreadRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): boolean {
  return getAgentCapabilityRuntime(runtime, id)?.supportsResumeThread === true;
}

export function getAvailableAgentsRuntime(
  runtime: AgentsRuntimeState,
): AgentDefinition[] {
  return AGENT_DEFINITIONS.filter((a) =>
    isAgentAvailableRuntime(runtime, a.id),
  );
}

export function resolveSelectableAgentIdRuntime(
  runtime: AgentsRuntimeState,
  preferred: AgentId,
): AgentId {
  if (isAgentAvailableRuntime(runtime, preferred)) return preferred;
  return getAvailableAgentsRuntime(runtime)[0]?.id ?? preferred;
}

/** 发送前校验：Companion 用运行时探测；未加载时交给 BFF；Hermes mock 走静态表 */
export function assertAgentAvailableRuntime(
  runtime: AgentsRuntimeState,
  agentId: AgentId,
): string | null {
  if (runtime.execution === "companion" && runtime.mode === "live") {
    if (!runtime.loaded) return null;
    const state = getAgentRuntimeState(runtime, agentId);
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
  return null;
}

export function cliStatusHintRuntime(
  runtime: AgentsRuntimeState,
  id: AgentId,
): string | undefined {
  const state = getAgentRuntimeState(runtime, id);
  if (!state || state.status === "available") return undefined;
  if (state.hint) return state.hint;
  switch (state.status) {
    case "needs_login":
      return "该智能体需完成 CLI 授权后方可使用";
    case "not_installed":
      return "未检测到该智能体组件，请联系管理员安装";
    case "outdated":
      return "智能体版本过低，请升级后使用";
    case "timeout":
      return "智能体探测超时，请稍后重试或在设置中单独测试";
  }
}

export function modelOptionsForAgent(
  state: CompanionAgentState | undefined,
  agentId: AgentId,
): AgentModelOption[] {
  if (state?.models?.length) return state.models;
  return AGENT_FALLBACK_MODELS[agentId];
}

export function modelsSourceLabel(
  source: CompanionAgentState["modelsSource"],
): string | undefined {
  if (source === "live") return "来自 CLI";
  if (source === "fallback") return "默认档位";
  return undefined;
}

export function applyAgentsResponse(
  payload: CompanionAgentsResponse,
  meta: {
    execution: AgentsRuntimeState["execution"];
    companionOk: boolean;
    companionVersion: string | null;
    mode: AgentsRuntimeState["mode"];
  },
): AgentsRuntimeState {
  return {
    loaded: true,
    loading: false,
    error: null,
    execution: meta.execution,
    companionOk: meta.companionOk,
    companionVersion: meta.companionVersion,
    mode: meta.mode,
    inferenceChannel: payload.inferenceChannel,
    agents: payload.agents,
    detectedAt: Date.now(),
  };
}

export function agentsWarning(runtime: AgentsRuntimeState): boolean {
  if (runtime.inferenceChannel === "api_fallback") return true;
  if (!runtime.loaded) return false;
  return !runtime.agents.some((a) => a.status === "available");
}

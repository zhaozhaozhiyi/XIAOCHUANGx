import { buildHermesSessionKey } from "@jlc/runtime-core/hermes-session";
import { hermesConfig } from "@/lib/hermes/config";
import {
  AGENT_DEFINITIONS,
  agentLabel,
  MOCK_CLI_STATES,
  type AgentId,
} from "@/lib/settings";

const VALID_AGENT_IDS = new Set(AGENT_DEFINITIONS.map((a) => a.id));

export function isValidAgentId(id: string): id is AgentId {
  return VALID_AGENT_IDS.has(id as AgentId);
}

export function assertAgentAvailable(agentId: AgentId): string | null {
  const state = MOCK_CLI_STATES[agentId];
  if (state.status === "available") return null;
  if (state.status === "needs_login") {
    return `${agentLabel(agentId)} 需要先完成登录${state.hint ? `：${state.hint}` : ""}`;
  }
  if (state.status === "not_installed") {
    return `${agentLabel(agentId)} 未安装，请联系管理员安装小窗智能体组件`;
  }
  return `${agentLabel(agentId)} 版本过低，请联系管理员升级`;
}

/** 发往 Hermes 的 model 字段（非 default 时用用户所选档位） */
export function resolveUpstreamModel(
  agentId: AgentId,
  agentModel: string,
): string {
  if (agentModel && agentModel !== "default") return agentModel;
  if (agentId === "hermes") return hermesConfig.model;
  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId);
  return agent?.models[0]?.id ?? hermesConfig.model;
}

/** 注入 system 提示，标明当前会话使用的预置 CLI */
export function getAgentSystemSuffix(agentId: AgentId, agentModel: string): string {
  const agent = AGENT_DEFINITIONS.find((a) => a.id === agentId);
  const modelLabel =
    agent?.models.find((m) => m.id === agentModel)?.label ?? agentModel;
  return `\n\n当前会话由「${agent?.name ?? agentId}」处理（模型档位：${modelLabel}）。请按该智能体能力风格作答。`;
}

/** 按 Agent 隔离 Hermes 长期记忆 / 会话键 */
export function gatewaySessionKey(
  webSessionId: string,
  agentId: AgentId,
): string {
  return buildHermesSessionKey(
    webSessionId,
    agentId,
    hermesConfig.sessionPrefix,
  );
}

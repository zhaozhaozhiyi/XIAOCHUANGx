import type { RunConversationMessage } from "./conversation-prompt.js";

export type TranscriptScopeResult = {
  messages: RunConversationMessage[];
  workspaceChanged: boolean;
  agentChanged: boolean;
};

/**
 * 工作区切换：不跨 cwd 续聊 transcript（对齐 OD「换项目 = 新上下文」）。
 * 仅保留本轮 user（若有），避免把上一项目对话灌进新 cwd。
 */
export function scopeHistoryToWorkspace(
  messages: RunConversationMessage[],
  workspaceProjectId: string,
  previousWorkspaceProjectId: string | null | undefined,
): TranscriptScopeResult {
  if (
    !previousWorkspaceProjectId ||
    previousWorkspaceProjectId === workspaceProjectId
  ) {
    return { messages, workspaceChanged: false, agentChanged: false };
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return {
    messages: lastUser ? [lastUser] : [],
    workspaceChanged: true,
    agentChanged: false,
  };
}

/**
 * Agent 切换：丢弃上一 Agent 的 assistant 之前的整段历史（对齐 OD scopeHistoryToAgent）。
 * 若上一轮已是不同 Agent，仅保留该分界点之后的消息。
 */
export function scopeHistoryToAgentChange(
  messages: RunConversationMessage[],
  targetAgentId: string,
  previousAgentId: string | null | undefined,
): TranscriptScopeResult {
  if (!previousAgentId || previousAgentId === targetAgentId) {
    return { messages, workspaceChanged: false, agentChanged: false };
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === "assistant") {
      return {
        messages: messages.slice(i + 1),
        workspaceChanged: false,
        agentChanged: true,
      };
    }
  }
  return { messages, workspaceChanged: false, agentChanged: true };
}

/** 工作区优先于 Agent（换项目时直接清空旧 transcript） */
export function applyTranscriptScope(
  messages: RunConversationMessage[],
  options: {
    workspaceProjectId: string;
    previousWorkspaceProjectId?: string | null;
    agentId: string;
    previousAgentId?: string | null;
  },
): TranscriptScopeResult {
  const ws = scopeHistoryToWorkspace(
    messages,
    options.workspaceProjectId,
    options.previousWorkspaceProjectId,
  );
  if (ws.workspaceChanged) return ws;
  return scopeHistoryToAgentChange(
    ws.messages,
    options.agentId,
    options.previousAgentId,
  );
}

import type { RunConversationMessage } from "./conversation-prompt.js";

/** 对齐 Open Design `MAX_TRANSCRIPT_MESSAGE_CHARS` */
export const MAX_TRANSCRIPT_MESSAGE_CHARS = 12_000;

/** 单条 assistant 正文超过此长度时计入 context warning */
export const LARGE_ASSISTANT_MESSAGE_CHARS = 8_000;

/** transcript 总字符超过此值时提示压缩（近似 OD 200k input tokens） */
export const HIGH_TRANSCRIPT_CHARS_THRESHOLD = 200_000;

/** 硬上限：超过则 Companion 应拒绝 spawn 并提示新开对话 */
export const HARD_MAX_COMPOSED_PROMPT_BYTES = 1_200_000;

const MAX_TRANSCRIPT_TURNS = 48;

function truncateForTranscript(content: string): string {
  if (content.length <= MAX_TRANSCRIPT_MESSAGE_CHARS) return content;
  const omitted = content.length - MAX_TRANSCRIPT_MESSAGE_CHARS;
  return `${content.slice(0, MAX_TRANSCRIPT_MESSAGE_CHARS)}\n\n[小窗 truncated ${omitted} chars from this prior message before sending it to the agent. Full content remains in persisted history.]`;
}

/** 避免 transcript 内出现伪造的 `## role` 分段 */
function escapeTranscriptRoleDelimiters(content: string): string {
  return content.replace(/^##\s+(user|assistant|system)\s*$/gim, "## $1 (message)");
}

/**
 * 换 Agent 后丢弃上一 Agent 的 assistant 之前的历史（对齐 OD scopeHistoryToAgent）。
 */
export function scopeHistoryToAgent(
  messages: RunConversationMessage[],
  targetAgentId?: string,
): RunConversationMessage[] {
  if (!targetAgentId) return messages;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (
      m?.role === "assistant" &&
      typeof (m as { agentId?: string }).agentId === "string" &&
      (m as { agentId?: string }).agentId !== targetAgentId
    ) {
      return messages.slice(i + 1);
    }
  }
  return messages;
}

function normalizeTranscriptMessages(
  messages: RunConversationMessage[] | undefined,
): RunConversationMessage[] {
  if (!messages?.length) return [];
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({
      role: m.role,
      content: truncateForTranscript(m.content.trim()),
    }))
    .slice(-MAX_TRANSCRIPT_TURNS);
}

/**
 * 对齐 OD `buildPriorRunContextWarning`（基于已截断前的原始长度估算）。
 */
export function buildPriorRunContextWarning(
  messages: RunConversationMessage[] | undefined,
): string | null {
  const raw = messages ?? [];
  let largeAssistantBodies = 0;
  let totalChars = 0;

  for (const m of raw) {
    if (typeof m.content !== "string") continue;
    totalChars += m.content.length;
    if (
      m.role === "assistant" &&
      m.content.length > LARGE_ASSISTANT_MESSAGE_CHARS
    ) {
      largeAssistantBodies += 1;
    }
  }

  const notes: string[] = [];
  if (totalChars >= HIGH_TRANSCRIPT_CHARS_THRESHOLD) {
    notes.push(
      `对话 transcript 约 ${Math.round(totalChars / 1000)}k 字符（已按每条 12k 截断后发送）`,
    );
  }
  if (largeAssistantBodies > 0) {
    notes.push(
      `${largeAssistantBodies} 条较长的助手回复（含工具过程摘要），勿整段复述`,
    );
  }
  if (raw.length >= 36) {
    notes.push(`已有 ${raw.length} 条消息，优先延续当前用户目标`);
  }
  if (notes.length === 0) return null;

  return [
    "## context warning",
    `小窗检测到：${notes.join("；")}。`,
    "本轮请保持紧凑：概括先前工具输出，只引用与当前问题相关的片段；若上下文已不足，请建议用户新开对话。",
  ].join("\n");
}

/**
 * 将多轮消息格式化为 OD 风格 transcript（`## user` / `## assistant`）。
 */
export function buildAgentTranscript(
  messages: RunConversationMessage[] | undefined,
  options?: { agentId?: string; contextWarning?: string | null },
): string {
  const scoped = scopeHistoryToAgent(
    normalizeTranscriptMessages(messages),
    options?.agentId,
  );
  if (scoped.length === 0) return "";

  const blocks: string[] = [];
  if (options?.contextWarning?.trim()) {
    blocks.push(options.contextWarning.trim(), "");
  }
  blocks.push(
    scoped
      .map(
        (m) =>
          `## ${m.role}\n${escapeTranscriptRoleDelimiters(m.content)}`,
      )
      .join("\n\n"),
  );
  return blocks.join("\n").trim();
}

/** 当前轮用户原文（最后一条 user），用于 telemetry / 表单过渡 */
export function latestUserTurnFromMessages(
  messages: RunConversationMessage[] | undefined,
): string {
  if (!messages?.length) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m?.role === "user" && m.content.trim()) return m.content.trim();
  }
  return "";
}

export type RunConversationMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: Array<{
    name?: string;
    path?: string;
    size?: number;
    mimeType?: string;
    type?: string;
  }>;
  /** 生成该条 assistant 的 Agent（用于换 CLI 时裁剪历史） */
  agentId?: string;
};

const MAX_TURNS = 48;
const MAX_MESSAGE_CHARS = 16_000;
const MAX_TOTAL_CHARS = 96_000;

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 20)}\n\n…（已截断）`;
}

function formatAttachmentList(
  attachments: RunConversationMessage["attachments"],
): string {
  if (!attachments?.length) return "";
  const lines = attachments
    .map((attachment) => {
      const path = attachment.path?.trim() || attachment.name?.trim();
      if (!path) return null;
      const label =
        attachment.name?.trim() && attachment.name.trim() !== path
          ? ` (${attachment.name.trim()})`
          : "";
      return `- ${path}${label}`;
    })
    .filter((line): line is string => !!line);
  if (lines.length === 0) return "";
  return `\n\n附件文件（已放入当前工作区，可直接读取）：\n${lines.join("\n")}`;
}

function messageBodyWithAttachments(message: RunConversationMessage): string {
  const body = message.content.trim();
  const attachments = formatAttachmentList(message.attachments);
  return `${body}${attachments}`.trim();
}

/** 过滤空消息并限制单条长度 */
export function normalizeRunMessages(
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
      content: truncateText(messageBodyWithAttachments(m), MAX_MESSAGE_CHARS),
      attachments: m.attachments,
      agentId: m.agentId,
    }))
    .slice(-MAX_TURNS);
}

function roleLabel(role: RunConversationMessage["role"]): string {
  return role === "user" ? "用户" : "助手";
}

/** 在总长度预算内保留尽可能多的较早轮次，当前用户消息优先完整保留 */
function fitMessagesWithinBudget(
  messages: RunConversationMessage[],
): RunConversationMessage[] {
  if (messages.length === 0) return [];
  const last = messages[messages.length - 1]!;
  let total = last.content.length;
  const keptFromEnd: RunConversationMessage[] = [last];

  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i]!;
    const nextTotal = total + m.content.length + 32;
    if (nextTotal > MAX_TOTAL_CHARS) break;
    total = nextTotal;
    keptFromEnd.unshift(m);
  }

  return keptFromEnd;
}

/**
 * 将客户端会话历史格式化为 CLI 的 user 侧 prompt。
 * 单条用户消息时保持原文，避免多余包装。
 */
export function formatConversationUserPrompt(
  messages: RunConversationMessage[] | undefined,
): string {
  const normalized = fitMessagesWithinBudget(normalizeRunMessages(messages));
  if (normalized.length === 0) return "";
  if (normalized.length === 1 && normalized[0]!.role === "user") {
    return normalized[0]!.content;
  }

  const last = normalized[normalized.length - 1]!;
  const prior = normalized.slice(0, -1);
  const blocks: string[] = [];

  if (prior.length > 0) {
    blocks.push("## 对话历史（按时间序）\n");
    for (const m of prior) {
      blocks.push(`**${roleLabel(m.role)}：**\n${m.content}\n`);
    }
    blocks.push("\n---\n\n");
  }

  blocks.push("## 当前用户消息\n\n", last.content);

  return blocks.join("").trim();
}

export function hasMultiTurnContext(
  messages: RunConversationMessage[] | undefined,
): boolean {
  return normalizeRunMessages(messages).length >= 2;
}

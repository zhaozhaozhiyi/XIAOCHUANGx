import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { interleavedTimelineParts } from "@/lib/chat-timeline";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import { buildExploreSummaryTitle } from "@/lib/tool-family";

export type ActivityLogEntry = {
  id: string;
  turnIndex: number;
  messageId: string;
  partId: string;
  kind: ChatPart["kind"];
  line: string;
  completedAt?: number;
  streamSeq?: number;
};

export type ActivityLogGroup = {
  turnIndex: number;
  messageId: string;
  userPreview: string;
  entries: ActivityLogEntry[];
};

const LOG_KINDS = new Set<ChatPart["kind"]>([
  "skill",
  "status",
  "status_chip",
  "tool",
  "command",
  "tool_batch",
  "reasoning",
  "narration",
  "file_read",
  "file_edit",
  "document_read",
  "document_edit",
  "error",
  "artifact",
  "deliverables",
]);

function isConnectStatus(part: Extract<ChatPart, { kind: "status" }>): boolean {
  return part.phase === "connect" || part.label.includes("连接");
}

/** 工作区「记录」与 API 回灌共用的单行摘要 */
export function activityLogLineForPart(
  part: ChatPart,
  options: { fullReasoning?: boolean } = {},
): string | null {
  switch (part.kind) {
    case "skill":
      return `- Skill: ${part.slug}${part.role ? ` (${part.role})` : ""}`;
    case "file_read":
      return part.lineRange
        ? `- 读取 ${part.path} · L${part.lineRange.start}–${part.lineRange.end}`
        : `- 读取 ${part.path}`;
    case "document_read":
      return `- 读取文档 ${part.path} (${part.docType})`;
    case "file_edit":
      return `- 编辑 ${part.path}${part.additions != null ? ` (+${part.additions}/-${part.deletions ?? 0})` : ""}`;
    case "document_edit":
      return `- 编辑文档 ${part.path} (${part.docType})${part.additions != null ? ` (+${part.additions}/-${part.deletions ?? 0})` : ""}`;
    case "tool_batch":
      return `- ${buildExploreSummaryTitle(part.items)}`;
    case "tool":
      return part.message
        ? `- ${part.tool}: ${part.message}`
        : `- ${part.tool}${part.status ? ` (${part.status})` : ""}`;
    case "command":
      return `- 命令: ${part.command.slice(0, 200)}`;
    case "reasoning": {
      const body = part.markdown.trim();
      if (!body || body === "思考中") return null;
      if (options.fullReasoning) {
        return `- 推理: ${body}`;
      }
      return `- 推理: ${body.slice(0, 400)}${body.length > 400 ? "…" : ""}`;
    }
    case "narration": {
      const body = part.markdown.trim();
      if (!body) return null;
      return `- 说明: ${body.slice(0, 280)}${body.length > 280 ? "…" : ""}`;
    }
    case "status":
      if (isConnectStatus(part)) return null;
      return `- ${part.label}${part.phase ? ` (${part.phase})` : ""}`;
    case "status_chip":
      return `- ${part.chip}`;
    case "error":
      return `- 错误: ${part.message}`;
    case "artifact":
      return `- 产出: ${part.path}`;
    case "deliverables": {
      const paths = part.items.map((i) => i.path).join(", ");
      return `- 成品: ${paths}`;
    }
    default:
      return null;
  }
}

export function activityContextForHistory(parts: ChatPart[] | undefined): string {
  if (!parts?.length) return "";
  const lines = parts
    .map((part) => activityLogLineForPart(part))
    .filter((line): line is string => !!line);
  if (lines.length === 0) return "";
  const text = lines.join("\n");
  if (text.length <= 4_000) return text;
  return `${text.slice(0, 4_000 - 24)}\n…（过程摘要已截断）`;
}

export function buildActivityLogEntries(
  messages: ChatMessage[],
): ActivityLogEntry[] {
  const turns = groupMessagesIntoTurns(messages);
  const entries: ActivityLogEntry[] = [];

  turns.forEach((turn, turnIndex) => {
    for (const message of turn.assistants) {
      const timeline = interleavedTimelineParts(message.parts).filter((part) =>
        LOG_KINDS.has(part.kind),
      );
      for (const part of timeline) {
        const line = activityLogLineForPart(part, { fullReasoning: true });
        if (!line) continue;
        entries.push({
          id: `${message.id}-${part.id}`,
          turnIndex: turnIndex + 1,
          messageId: message.id,
          partId: part.id,
          kind: part.kind,
          line,
          completedAt: "completedAt" in part ? part.completedAt : undefined,
          streamSeq: part.streamSeq,
        });
      }
    }
  });

  return entries;
}

export function buildActivityLogGroups(
  messages: ChatMessage[],
): ActivityLogGroup[] {
  const turns = groupMessagesIntoTurns(messages);
  const groups: ActivityLogGroup[] = [];

  turns.forEach((turn, index) => {
    for (const message of turn.assistants) {
      const entries = buildActivityLogEntries([turn.user, message]).filter(
        (entry) => entry.messageId === message.id,
      );
      if (entries.length === 0) continue;
      const userPreview = turn.user.content.trim().slice(0, 48);
      groups.push({
        turnIndex: index + 1,
        messageId: message.id,
        userPreview: userPreview || `第 ${index + 1} 轮`,
        entries,
      });
    }
  });

  return groups;
}

const ACTIVITY_TAIL_RE = /\n\n---\n\[上轮执行过程\]\n[\s\S]*$/;
const ACTIVITY_ONLY_RE = /^\[上轮执行过程\]\n[\s\S]*$/;

/** 从展示用 markdown 中移除 API 注入的过程块 */
export function stripInjectedActivityContext(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (ACTIVITY_ONLY_RE.test(trimmed)) return "";
  return trimmed.replace(ACTIVITY_TAIL_RE, "").trim();
}

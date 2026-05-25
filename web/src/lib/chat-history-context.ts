import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";
import { selectAssistantDisplayContent } from "@/lib/chat-message-selectors";
import { buildExploreSummaryTitle } from "@/lib/tool-family";

const MAX_ACTIVITY_CHARS = 4_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 24)}\n…（过程摘要已截断）`;
}

function lineForPart(p: ChatPart): string | null {
  switch (p.kind) {
    case "skill":
      return `- Skill: ${p.slug}${p.role ? ` (${p.role})` : ""}`;
    case "file_read":
      return p.lineRange
        ? `- 读取 ${p.path} · L${p.lineRange.start}–${p.lineRange.end}`
        : `- 读取 ${p.path}`;
    case "document_read":
      return `- 读取文档 ${p.path} (${p.docType})`;
    case "file_edit":
      return `- 编辑 ${p.path}${p.additions != null ? ` (+${p.additions}/-${p.deletions ?? 0})` : ""}`;
    case "document_edit":
      return `- 编辑文档 ${p.path} (${p.docType})${p.additions != null ? ` (+${p.additions}/-${p.deletions ?? 0})` : ""}`;
    case "tool_batch":
      return `- ${buildExploreSummaryTitle(p.items)}`;
    case "tool":
      return p.message
        ? `- ${p.tool}: ${p.message}`
        : `- ${p.tool}${p.status ? ` (${p.status})` : ""}`;
    case "command":
      return `- 命令: ${p.command.slice(0, 200)}`;
    case "reasoning": {
      const body = p.markdown.trim();
      if (!body || body === "思考中") return null;
      return `- 推理: ${body.slice(0, 400)}${body.length > 400 ? "…" : ""}`;
    }
    case "status":
      return p.phase === "connect" || p.label.includes("连接")
        ? null
        : `- ${p.label}${p.phase ? ` (${p.phase})` : ""}`;
    case "error":
      return `- 错误: ${p.message}`;
    case "artifact":
      return `- 产出: ${p.path}`;
    case "deliverables": {
      const paths = p.items.map((i) => i.path).join(", ");
      return `- 成品: ${paths}`;
    }
    default:
      return null;
  }
}

/** 从 parts 提取可回灌模型的过程摘要 */
export function activityContextForHistory(parts: ChatPart[] | undefined): string {
  if (!parts?.length) return "";
  const lines = parts.map(lineForPart).filter((l): l is string => !!l);
  if (lines.length === 0) return "";
  return truncate(lines.join("\n"), MAX_ACTIVITY_CHARS);
}

/**
 * 发给 Companion / Hermes 的单条消息正文：结论 + 过程摘要。
 */
export function messageContentForApi(msg: ChatMessage): string {
  const body =
    msg.role === "assistant" ? selectAssistantDisplayContent(msg) : msg.content;
  if (msg.role !== "assistant") return body;

  const activity = activityContextForHistory(msg.parts);
  if (!activity) return body;
  if (!body.trim()) return `[上轮执行过程]\n${activity}`;
  return `${body.trim()}\n\n---\n[上轮执行过程]\n${activity}`;
}

import type { ActivityCollapse, ChatPart } from "@/lib/chat-parts";
import type { ChatMessage } from "@/lib/chat";
import { prepareChatMarkdown } from "@/lib/prepare-chat-markdown";
import { classifyToolFamily, type ToolFamily } from "@/lib/tool-family";

export function newPartId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function partMarkdown(part: ChatPart): string {
  if (part.kind === "summary" || part.kind === "text") return part.markdown;
  if (part.kind === "narration") return part.markdown;
  if (part.kind === "reasoning") return part.markdown;
  if (part.kind === "error") return part.message;
  return "";
}

function canonicalAnswerMarkdown(msg: ChatMessage): string {
  if (msg.role !== "assistant") return "";
  return normalizeMarkdown(msg.canonicalOutput?.finalAnswer.markdown ?? "");
}

/** 去掉正文首尾空行并压缩连续空行（流式与展示共用） */
export function normalizeMarkdown(text: string): string {
  return prepareChatMarkdown(text);
}

export function isRenderablePart(part: ChatPart): boolean {
  if (part.kind === "summary" || part.kind === "text") {
    return normalizeMarkdown(part.markdown).length > 0 || !!part.streaming;
  }
  if (part.kind === "reasoning") {
    return normalizeMarkdown(part.markdown).length > 0 && part.markdown !== "思考中";
  }
  if (part.kind === "narration") {
    return normalizeMarkdown(part.markdown).length > 0;
  }
  if (part.kind === "error") return !!part.message.trim();
  if (part.kind === "turn_meta") return !!part.label?.trim();
  if (part.kind === "deliverables") return part.items.length > 0;
  if (part.kind === "tool_batch") return part.items.length > 0 || !!part.streaming;
  if (part.kind === "todo") return part.items.length > 0;
  return true;
}

/** API 历史与兼容：优先 parts 中的正文，否则 content */
export function messageDisplayContent(msg: ChatMessage): string {
  if (msg.role === "user") return msg.content;
  const fromCanonical = canonicalAnswerMarkdown(msg);
  if (msg.status !== "loading" && msg.status !== "streaming" && fromCanonical) {
    return fromCanonical;
  }
  if (msg.parts?.length) {
    const fromParts = msg.parts
      .filter((p) => p.kind === "summary" || p.kind === "text")
      .map((p) => normalizeMarkdown(partMarkdown(p)))
      .join("\n\n")
      .trim();
    if (fromParts) return fromParts;
  }
  if (fromCanonical) return fromCanonical;
  return msg.content;
}

export function hasSummaryContent(msg: ChatMessage): boolean {
  if (msg.role !== "assistant") return !!msg.content.trim();
  return messageDisplayContent(msg).length > 0;
}

export function activityParts(parts: ChatPart[] | undefined): ChatPart[] {
  return (parts ?? []).filter((p) => p.zone === "activity");
}

export function summaryParts(parts: ChatPart[] | undefined): ChatPart[] {
  return (parts ?? []).filter((p) => p.zone === "summary");
}

/**
 * @deprecated 使用 `interleavedTimelineParts`（`chat-timeline.ts`）。
 * 保留签名供历史引用；不再按 zone 折叠 activity。
 */
export function visibleTimelineParts(
  parts: ChatPart[] | undefined,
  _activityOpen?: boolean,
): ChatPart[] {
  void _activityOpen;
  return (parts ?? []).filter(
    (p) => isRenderablePart(p) && p.kind !== "todo",
  );
}

export function activitySummaryLabel(parts: ChatPart[]): string {
  if (parts.length === 0) return "无执行过程";

  const counts: Record<ToolFamily, number> = {
    read: 0,
    search: 0,
    query: 0,
    explore: 0,
    command: 0,
    write: 0,
    other: 0,
  };
  let waitingLabel: string | null = null;

  for (const p of parts) {
    if (p.kind === "tool_batch") {
      for (const item of p.items) {
        counts[classifyToolFamily(item.tool)] += 1;
      }
      continue;
    }
    if (p.kind === "tool") {
      counts[classifyToolFamily(p.tool)] += 1;
      continue;
    }
    if (p.kind === "file_read" || p.kind === "document_read") {
      counts.read += 1;
      continue;
    }
    if (p.kind === "file_edit" || p.kind === "document_edit") {
      counts.write += 1;
      continue;
    }
    if (p.kind === "command") {
      counts.command += 1;
      continue;
    }
    if (p.kind === "status" && /确认|填写|选择|授权|请补充/.test(p.label)) {
      waitingLabel = p.label;
    }
  }

  const segments: string[] = [];
  if (counts.read > 0) segments.push(`读取 ${counts.read} 个文件`);
  if (counts.search > 0) segments.push(`搜索 ${counts.search} 次`);
  if (counts.query > 0) segments.push(`检索 ${counts.query} 次`);
  if (counts.explore > 0) segments.push(`探索 ${counts.explore} 项`);
  if (counts.command > 0) segments.push(`运行 ${counts.command} 条命令`);
  if (counts.write > 0) segments.push(`修改 ${counts.write} 个文件`);
  if (counts.other > 0) segments.push(`处理 ${counts.other} 项`);

  if (segments.length > 0) return segments.join(" · ");
  if (waitingLabel) return waitingLabel;
  return `过程 ${parts.length} 项`;
}

export function isActivityExpanded(
  collapse: ActivityCollapse | undefined,
  status: ChatMessage["status"],
): boolean {
  if (status === "loading" || status === "streaming") {
    return collapse !== "user_collapsed";
  }
  if (collapse === "user_expanded") return true;
  if (collapse === "user_collapsed" || collapse === "collapsed") return false;
  return collapse === "expanded";
}

export function defaultActivityCollapse(
  status: ChatMessage["status"],
): ActivityCollapse {
  if (status === "loading" || status === "streaming") return "expanded";
  if (status === "error") return "expanded";
  return "collapsed";
}

export function partsFromPlainContent(
  content: string,
  status: ChatMessage["status"] = "complete",
): ChatPart[] {
  const trimmed = normalizeMarkdown(content);
  if (!trimmed) return [];
  return [
    {
      id: newPartId("summary"),
      zone: "summary",
      kind: status === "complete" ? "summary" : "text",
      markdown: trimmed,
      streaming: status === "streaming",
      completedAt: status === "complete" ? Date.now() : undefined,
    },
  ];
}

export function withAssistantContentSnapshot(msg: ChatMessage): ChatMessage {
  if (msg.role !== "assistant") return msg;
  const text = messageDisplayContent(msg);
  return { ...msg, content: text };
}

/** @deprecated 使用 withAssistantContentSnapshot 标明这是边界兼容快照 */
export const syncAssistantContent = withAssistantContentSnapshot;

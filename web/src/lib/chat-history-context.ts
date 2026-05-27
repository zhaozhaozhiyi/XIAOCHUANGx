import type { ChatMessage } from "@/lib/chat";
import { selectAssistantDisplayContent } from "@/lib/chat-message-selectors";
import {
  activityContextForHistory,
} from "@/lib/activity-log";

/**
 * 发给 Companion / Hermes 的单条消息正文：结论 + 过程摘要（仅 API，不进 UI）。
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

export { activityContextForHistory } from "@/lib/activity-log";

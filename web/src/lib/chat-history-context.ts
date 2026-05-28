import type { ChatMessage } from "@/lib/chat";
import { selectAssistantDisplayContent } from "@/lib/chat-message-selectors";
import {
  activityContextForHistory,
} from "@/lib/activity-log";

export function messageContentForApi(msg: ChatMessage): string {
  const body =
    msg.role === "assistant" ? selectAssistantDisplayContent(msg) : msg.content;
  if (msg.role !== "assistant") {
    const attachments = msg.attachments ?? [];
    if (attachments.length === 0) return body;
    const paths = attachments.map((u) => u.path || u.name);
    if (!body.trim()) {
      return `I've uploaded ${attachments.length} file(s): ${paths.join(", ")}`;
    }
    return `${body.trim()}\n\n[Attached files: ${paths.join(", ")}]`;
  }

  const activity = activityContextForHistory(msg.parts);
  if (!activity) return body;
  if (!body.trim()) return `[上轮执行过程]\n${activity}`;
  return `${body.trim()}\n\n---\n[上轮执行过程]\n${activity}`;
}

export { activityContextForHistory } from "@/lib/activity-log";

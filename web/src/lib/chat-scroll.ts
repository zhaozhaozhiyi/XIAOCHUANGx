import type { ChatMessage } from "@/lib/chat";
import type { ChatPart } from "@/lib/chat-parts";

function partScrollSignature(part: ChatPart): string {
  let sig = part.kind;
  if ("markdown" in part && typeof part.markdown === "string") {
    sig += `:m${part.markdown.length}`;
  }
  if ("message" in part && typeof part.message === "string") {
    sig += `:x${part.message.length}`;
  }
  if ("streaming" in part && part.streaming) sig += ":s";
  if (part.kind === "tool") sig += `:${part.status}`;
  if (part.kind === "command") sig += part.streaming ? ":r" : ":d";
  if (part.kind === "tool_batch") sig += part.streaming ? ":b" : "";
  if (part.kind === "deliverables") sig += `:${part.items.length}`;
  return sig;
}

/** 流式追加 part / 文本时 revision 会变，用于触发贴底滚动 */
export function buildChatScrollContentKey(messages: ChatMessage[]): string {
  if (messages.length === 0) return "0";
  return messages
    .map((message) => {
      const parts = message.parts ?? [];
      const partsSig = parts.map(partScrollSignature).join(";");
      return `${message.id}|${message.status ?? ""}|${message.content.length}|${parts.length}|${partsSig}`;
    })
    .join("||");
}

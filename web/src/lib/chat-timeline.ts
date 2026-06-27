import type { ChatPart, TodoPart } from "@/lib/chat-parts";
import type { ChatMessage } from "@/lib/chat";
import { isRenderablePart } from "@/lib/chat-parts-utils";

/** 气泡内按 SSE 到达顺序展示；Todo 由 PinnedTodoBar 单独展示，避免重复 */
export function interleavedTimelineParts(
  parts: ChatPart[] | undefined,
): ChatPart[] {
  const list = (parts ?? []).filter(
    (p) => isRenderablePart(p) && p.kind !== "todo",
  );
  return [...list].sort((a, b) => {
    const sa = a.streamSeq;
    const sb = b.streamSeq;
    if (sa != null && sb != null && sa !== sb) return sa - sb;
    if (sa != null && sb == null) return -1;
    if (sa == null && sb != null) return 1;
    return 0;
  });
}

/** 取最近一条助手消息中的 Todo（对齐 Open Design pinned canonical todo） */
export function latestTodoPartFromMessages(
  messages: ChatMessage[],
): TodoPart | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "assistant" || !m.parts?.length) continue;
    const todo = m.parts.find((p): p is TodoPart => p.kind === "todo");
    if (todo && todo.items.length > 0) return todo;
  }
  return null;
}

export function todoPartKey(part: TodoPart): string {
  return part.items.map((i) => `${i.id}:${i.status}`).join("|");
}

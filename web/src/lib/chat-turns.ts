import type { ChatMessage } from "@/lib/chat";

export type ChatTurn = {
  id: string;
  user: ChatMessage;
  assistants: ChatMessage[];
};

/** 将平铺消息列表按「用户问 → 若干 assistant」分组为 Turn */
export function groupMessagesIntoTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  let current: ChatTurn | null = null;

  for (const msg of messages) {
    if (msg.role === "user") {
      current = { id: msg.id, user: msg, assistants: [] };
      turns.push(current);
      continue;
    }
    if (msg.role === "assistant") {
      if (!current) {
        current = {
          id: `turn-before-${msg.id}`,
          user: {
            id: `user-synthetic-${msg.id}`,
            role: "user",
            content: "",
            status: "complete",
          },
          assistants: [],
        };
        turns.push(current);
      }
      current.assistants.push(msg);
    }
  }

  return turns;
}

export function lastTurnId(turns: ChatTurn[]): string | null {
  return turns.length > 0 ? turns[turns.length - 1]!.id : null;
}

"use client";

import type { ChatMessage } from "@/lib/chat";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";

type Props = {
  messages: ChatMessage[];
  bottomRef?: React.RefObject<HTMLDivElement | null>;
};

export function ChatMessageList({
  messages,
  bottomRef,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="w-full"
        >
          {msg.role === "user" ? (
            <div className="bubble-user w-full whitespace-pre-wrap">{msg.content}</div>
          ) : (
            <AssistantMessageBubble message={msg} />
          )}
        </div>
      ))}
      <div ref={bottomRef} className="h-1" aria-hidden />
    </div>
  );
}

"use client";

import type { ChatMessage } from "@/lib/chat";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";

type Props = {
  messages: ChatMessage[];
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  onClarificationSubmitted?: (partId: string, answer: string) => void;
  onClarificationContinue?: (answer: string) => void;
  onClarificationDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      draft?: string;
    },
  ) => void;
};

export function ChatMessageList({
  messages,
  bottomRef,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
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
            <AssistantMessageBubble
              message={msg}
              onClarificationSubmitted={onClarificationSubmitted}
              onClarificationContinue={onClarificationContinue}
              onClarificationDraftChange={onClarificationDraftChange}
            />
          )}
        </div>
      ))}
      <div ref={bottomRef} className="h-1" aria-hidden />
    </div>
  );
}

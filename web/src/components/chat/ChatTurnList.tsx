"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/lib/chat";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";

type Props = {
  messages: ChatMessage[];
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  /** 深度模式显示更短的步间思考间隔 */
  thinkingGapMinMs?: number;
};

export function ChatTurnList({
  messages,
  scrollRootRef,
  bottomRef,
  thinkingGapMinMs,
}: Props) {
  void scrollRootRef;
  const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);

  return (
    <div className="chat-scroll-content mx-auto max-w-3xl">
      {turns.map((turn) => {
        return (
          <section
            key={turn.id}
            data-turn-id={turn.id}
            className="chat-turn"
          >
            {turn.user.content.trim() ? (
              <div className="chat-turn-user-panel">
                <div className="chat-turn-user-label">问题</div>
                <div className="bubble-user whitespace-pre-wrap">
                  {turn.user.content}
                </div>
              </div>
            ) : null}

            <div className="chat-turn-assistant flex flex-col gap-4">
              {turn.assistants.map((msg) => (
                <div key={msg.id} className="w-full">
                  <AssistantMessageBubble
                    message={msg}
                    thinkingGapMinMs={thinkingGapMinMs}
                  />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/lib/chat";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";
import { Bot } from "lucide-react";

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
    <div className="chat-scroll-content mx-auto max-w-[var(--chat-message-max)]">
      {turns.map((turn) => {
        return (
          <section
            key={turn.id}
            data-turn-id={turn.id}
            className="chat-turn"
          >
            {turn.user.content.trim() ? (
              <div className="chat-turn-user-panel" data-role="user">
                <div className="bubble-user whitespace-pre-wrap">
                  {turn.user.content}
                </div>
              </div>
            ) : null}

            {turn.assistants.length > 0 ? (
              <div className="chat-turn-assistant">
                <div className="chat-turn-assistant__avatar" aria-hidden>
                  <Bot className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
                <div className="chat-turn-assistant__rail" aria-hidden />
                <div className="chat-turn-assistant__body">
                  <div className="chat-turn-assistant__name">小窗</div>
                  <div className="flex flex-col gap-5">
                    {turn.assistants.map((msg) => (
                      <AssistantMessageBubble
                        key={msg.id}
                        message={msg}
                        thinkingGapMinMs={thinkingGapMinMs}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
      <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { ChatMessage } from "@/lib/chat";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";

type Props = {
  messages: ChatMessage[];
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  /** 深度模式显示更短的步间思考间隔 */
  thinkingGapMinMs?: number;
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

export function ChatTurnList({
  messages,
  scrollRootRef,
  bottomRef,
  thinkingGapMinMs,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
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
            {turn.user.content.trim() || turn.user.attachments?.length ? (
              <div className="chat-turn-user-panel" data-role="user">
                <UserMessageBubble message={turn.user} />
              </div>
            ) : null}

            {turn.assistants.length > 0 ? (
              <div className="chat-turn-assistant">
                <div className="chat-turn-assistant__body">
                  <div className="flex flex-col gap-5">
                    {turn.assistants.map((msg) => (
                      <AssistantMessageBubble
                        key={msg.id}
                        message={msg}
                        thinkingGapMinMs={thinkingGapMinMs}
                        onClarificationSubmitted={onClarificationSubmitted}
                        onClarificationContinue={onClarificationContinue}
                        onClarificationDraftChange={
                          onClarificationDraftChange
                        }
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

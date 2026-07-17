"use client";

import { useEffect, useMemo } from "react";
import type { ChatMessage } from "@/lib/chat";
import type { ActivityCollapse, OutlineCommitPayload } from "@/lib/chat-parts";
import { groupMessagesIntoTurns } from "@/lib/chat-turns";
import { isTurnActive, resolveTurnDisplayState } from "@/lib/chat-turn-display-state";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";
import { useActiveTurn } from "./useActiveTurn";

type Props = {
  messages: ChatMessage[];
  sessionId?: string;
  scrollRootRef: React.RefObject<HTMLDivElement | null>;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  /** 深度模式显示更短的步间思考间隔 */
  thinkingGapMinMs?: number;
  onActivityCollapseChange?: (messageId: string, collapse: ActivityCollapse) => void;
  onDisclosureIntent?: (trigger: HTMLElement) => void;
  onClarificationSubmitted?: (partId: string, answer: string) => void;
  onClarificationContinue?: (answer: string) => void;
  onClarificationDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      draft?: string;
    },
  ) => void;
  onRequirementsSubmitted?: (partId: string, answer: string) => void;
  onRequirementsContinue?: (answer: string) => void;
  onRequirementsDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      answers?: Record<string, string>;
    },
  ) => void;
  onOutlineCommitted?: (partId: string, patch: OutlineCommitPayload) => void;
};

export function ChatTurnList({
  messages,
  sessionId,
  scrollRootRef,
  bottomRef,
  thinkingGapMinMs,
  onActivityCollapseChange,
  onDisclosureIntent,
  onClarificationSubmitted,
  onClarificationContinue,
  onClarificationDraftChange,
  onRequirementsSubmitted,
  onRequirementsContinue,
  onRequirementsDraftChange,
  onOutlineCommitted,
}: Props) {
  const turns = useMemo(() => groupMessagesIntoTurns(messages), [messages]);
  const turnIds = useMemo(() => turns.map((turn) => turn.id), [turns]);
  const activeTurnId = useActiveTurn(turnIds, scrollRootRef);
  const latestExecutingMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (
        message?.role === "assistant" &&
        isTurnActive(resolveTurnDisplayState(message))
      ) {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root || !activeTurnId) return;
    const section = Array.from(root.querySelectorAll<HTMLElement>("[data-turn-id]")).find(
      (element) => element.dataset.turnId === activeTurnId,
    );
    if (!section) return;
    const userPanel = section.querySelector<HTMLElement>(".chat-turn-user-panel");
    const update = () => {
      section.style.setProperty(
        "--chat-active-user-sticky-height",
        `${userPanel?.getBoundingClientRect().height ?? 0}px`,
      );
    };
    update();
    if (!userPanel) return;
    const observer = new ResizeObserver(update);
    observer.observe(userPanel);
    return () => observer.disconnect();
  }, [activeTurnId, scrollRootRef]);

  return (
    <div className="chat-scroll-content mx-auto w-full max-w-[var(--chat-message-max)]">
      {turns.map((turn) => {
        const active = activeTurnId === turn.id;
        return (
          <section
            key={turn.id}
            data-turn-id={turn.id}
            data-active-turn={active ? "true" : undefined}
            className={`chat-turn ${active ? "chat-turn--active" : ""}`}
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
                        sessionId={sessionId}
                        thinkingGapMinMs={thinkingGapMinMs}
                        isLatestExecutingMessage={latestExecutingMessageId === msg.id}
                        onActivityCollapseChange={onActivityCollapseChange}
                        onDisclosureIntent={onDisclosureIntent}
                        onClarificationSubmitted={onClarificationSubmitted}
                        onClarificationContinue={onClarificationContinue}
                        onClarificationDraftChange={
                          onClarificationDraftChange
                        }
                        onRequirementsSubmitted={onRequirementsSubmitted}
                        onRequirementsContinue={onRequirementsContinue}
                        onRequirementsDraftChange={onRequirementsDraftChange}
                        onOutlineCommitted={onOutlineCommitted}
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

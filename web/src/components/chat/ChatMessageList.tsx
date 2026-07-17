"use client";

import type { ChatMessage } from "@/lib/chat";
import type { ActivityCollapse, OutlineCommitPayload } from "@/lib/chat-parts";
import { isTurnActive, resolveTurnDisplayState } from "@/lib/chat-turn-display-state";
import { AssistantMessageBubble } from "@/components/chat/parts/AssistantMessageBubble";
import { UserMessageBubble } from "@/components/chat/UserMessageBubble";

type Props = {
  messages: ChatMessage[];
  bottomRef?: React.RefObject<HTMLDivElement | null>;
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

export function ChatMessageList({
  messages,
  bottomRef,
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
  const latestExecutingMessageId = (() => {
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
  })();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className="w-full"
        >
          {msg.role === "user" ? (
            <UserMessageBubble message={msg} />
          ) : (
            <AssistantMessageBubble
              message={msg}
              isLatestExecutingMessage={latestExecutingMessageId === msg.id}
              onActivityCollapseChange={onActivityCollapseChange}
              onDisclosureIntent={onDisclosureIntent}
              onClarificationSubmitted={onClarificationSubmitted}
              onClarificationContinue={onClarificationContinue}
              onClarificationDraftChange={onClarificationDraftChange}
              onRequirementsSubmitted={onRequirementsSubmitted}
              onRequirementsContinue={onRequirementsContinue}
              onRequirementsDraftChange={onRequirementsDraftChange}
              onOutlineCommitted={onOutlineCommitted}
            />
          )}
        </div>
      ))}
      <div ref={bottomRef} className="h-1" aria-hidden />
    </div>
  );
}

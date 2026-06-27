"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ChatMessage } from "@/lib/chat";

type ChatSessionSnapshot = {
  sessionId: string;
  messages: ChatMessage[];
};

type ChatSessionContextValue = {
  snapshot: ChatSessionSnapshot | null;
  publishSession: (sessionId: string, messages: ChatMessage[]) => void;
};

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null);

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ChatSessionSnapshot | null>(null);

  const publishSession = useCallback(
    (sessionId: string, messages: ChatMessage[]) => {
      setSnapshot((prev) => {
        if (prev?.sessionId === sessionId && prev.messages === messages) {
          return prev;
        }
        return { sessionId, messages };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ snapshot, publishSession }),
    [snapshot, publishSession],
  );

  return (
    <ChatSessionContext.Provider value={value}>
      {children}
    </ChatSessionContext.Provider>
  );
}

export function useChatSessionOptional() {
  return useContext(ChatSessionContext);
}

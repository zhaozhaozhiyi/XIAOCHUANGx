"use client";

import { useEffect, useState } from "react";
import {
  getGroupedChatHistory,
  getGroupedChatHistoryServerSnapshot,
  type GroupedChatHistory,
} from "@/lib/chat-history";

const SERVER_SNAPSHOT = getGroupedChatHistoryServerSnapshot();

export function useChatHistory(): GroupedChatHistory {
  const [data, setData] = useState<GroupedChatHistory>(SERVER_SNAPSHOT);

  useEffect(() => {
    setData(getGroupedChatHistory());

    const onUpdate = () => setData(getGroupedChatHistory());
    window.addEventListener("jlc-chat-history-updated", onUpdate);
    return () => window.removeEventListener("jlc-chat-history-updated", onUpdate);
  }, []);

  return data;
}

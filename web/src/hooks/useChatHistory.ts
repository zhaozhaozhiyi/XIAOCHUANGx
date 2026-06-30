"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getGroupedChatHistory,
  getGroupedChatHistoryServerSnapshot,
  type GroupedChatHistory,
} from "@/lib/chat-history";

const SERVER_SNAPSHOT = getGroupedChatHistoryServerSnapshot();

export function useChatHistory(): GroupedChatHistory {
  const load = useCallback(() => {
    return getGroupedChatHistory();
  }, []);
  const [data, setData] = useState<GroupedChatHistory>(SERVER_SNAPSHOT);

  useEffect(() => {
    const onUpdate = () => setData(load());
    onUpdate();
    window.addEventListener("jlc-chat-history-updated", onUpdate);
    return () => window.removeEventListener("jlc-chat-history-updated", onUpdate);
  }, [load]);

  return data;
}

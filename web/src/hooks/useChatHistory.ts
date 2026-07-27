"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getGroupedChatHistory,
  getGroupedChatHistoryServerSnapshot,
  importCompanionChatHistory,
  needsCompanionHistoryImport,
  type GroupedChatHistory,
} from "@/lib/chat-history";
import { fetchCompanionSessions } from "@/lib/companion/session-messages";

const SERVER_SNAPSHOT = getGroupedChatHistoryServerSnapshot();

export function useChatHistory(): GroupedChatHistory {
  const load = useCallback(() => {
    return getGroupedChatHistory();
  }, []);
  const [data, setData] = useState<GroupedChatHistory>(SERVER_SNAPSHOT);

  useEffect(() => {
    let cancelled = false;
    const onUpdate = () => setData(load());
    onUpdate();
    window.addEventListener("jlc-chat-history-updated", onUpdate);
    if (needsCompanionHistoryImport()) {
      void fetchCompanionSessions().then((items) => {
        if (cancelled || !items) return;
        importCompanionChatHistory(items);
      });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("jlc-chat-history-updated", onUpdate);
    };
  }, [load]);

  return data;
}

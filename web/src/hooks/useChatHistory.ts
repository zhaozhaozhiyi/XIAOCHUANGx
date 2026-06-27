"use client";

import { useEffect, useState } from "react";
import type { ChatSurfaceModuleId } from "@/lib/module-chat-config";
import {
  getGroupedChatHistory,
  getGroupedChatHistoryForSurface,
  getGroupedChatHistoryServerSnapshot,
  type GroupedChatHistory,
} from "@/lib/chat-history";

const SERVER_SNAPSHOT = getGroupedChatHistoryServerSnapshot();

export function useChatHistory(
  surfaceModuleId: ChatSurfaceModuleId = "chat",
): GroupedChatHistory {
  const [data, setData] = useState<GroupedChatHistory>(SERVER_SNAPSHOT);

  useEffect(() => {
    const load = () =>
      surfaceModuleId === "chat"
        ? getGroupedChatHistory()
        : getGroupedChatHistoryForSurface(surfaceModuleId);
    setData(load());

    const onUpdate = () => setData(load());
    window.addEventListener("jlc-chat-history-updated", onUpdate);
    return () => window.removeEventListener("jlc-chat-history-updated", onUpdate);
  }, [surfaceModuleId]);

  return data;
}

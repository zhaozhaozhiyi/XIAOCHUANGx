"use client";

import { Loader2 } from "lucide-react";
import type { ChatSessionIndicator } from "@/lib/chat-history";

type ChatSessionStatusIndicatorProps = {
  indicator: ChatSessionIndicator;
  className?: string;
};

/** 侧栏会话状态：灰=已读、蓝=未读、转圈=执行中、橙=待用户确认 */
export function ChatSessionStatusIndicator({
  indicator,
  className = "",
}: ChatSessionStatusIndicatorProps) {
  if (indicator === "running") {
    return (
      <span
        className={`chat-history-sidebar__status chat-history-sidebar__status--running ${className}`}
        aria-label="执行中"
        title="执行中"
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.25} />
      </span>
    );
  }

  if (indicator === "waiting_user") {
    return (
      <span
        className={`chat-history-sidebar__status chat-history-sidebar__status--waiting ${className}`}
        aria-label="待您确认或填写"
        title="待您确认或填写"
      />
    );
  }

  if (indicator === "unread") {
    return (
      <span
        className={`chat-history-sidebar__status chat-history-sidebar__status--unread ${className}`}
        aria-label="有新结果未读"
        title="有新结果未读"
      />
    );
  }

  return (
    <span
      className={`chat-history-sidebar__status chat-history-sidebar__status--read ${className}`}
      aria-label="已完成"
      title="已完成"
    />
  );
}

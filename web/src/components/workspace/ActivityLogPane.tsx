"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@/lib/chat";
import { buildActivityLogGroups } from "@/lib/activity-log";
import { loadSessionMessagesHybrid } from "@/lib/chat-session-sync";
import { useChatSessionOptional } from "@/contexts/ChatSessionContext";
import { useWorkspace } from "@/components/workspace/WorkspaceContext";

function formatLogTime(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function ActivityLogPane() {
  const { sessionKey } = useWorkspace();
  const chatSession = useChatSessionOptional();

  const liveMessages =
    chatSession?.snapshot?.sessionId === sessionKey
      ? chatSession.snapshot.messages
      : null;

  const [messages, setMessages] = useState<ChatMessage[]>(() => liveMessages ?? []);

  useEffect(() => {
    if (liveMessages && liveMessages.length > 0) {
      return;
    }
    let cancelled = false;
    void loadSessionMessagesHybrid(sessionKey).then((loaded) => {
      if (!cancelled) setMessages(loaded.messages);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionKey, liveMessages]);

  const effectiveMessages = liveMessages && liveMessages.length > 0 ? liveMessages : messages;

  const groups = useMemo(
    () => buildActivityLogGroups(effectiveMessages),
    [effectiveMessages],
  );

  if (groups.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="text-sm text-[var(--fg-secondary)]">暂无运行记录</p>
        <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-[var(--fg-tertiary)]">
          Agent 加载 Skill、运行 CLI、推理等过程会按时间顺序显示在这里。
        </p>
      </div>
    );
  }

  return (
    <div className="activity-log-pane min-h-0 flex-1 overflow-y-auto px-4 py-3">
      {groups.map((group) => (
        <section key={group.messageId} className="activity-log-group">
          <header className="activity-log-group__head">
            <span className="activity-log-group__turn">第 {group.turnIndex} 轮</span>
            {group.userPreview ? (
              <span className="activity-log-group__user">{group.userPreview}</span>
            ) : null}
          </header>
          <ul className="activity-log-group__list">
            {group.entries.map((entry) => (
              <li key={entry.id} className="activity-log-entry">
                {entry.completedAt ? (
                  <time
                    className="activity-log-entry__time"
                    dateTime={new Date(entry.completedAt).toISOString()}
                  >
                    {formatLogTime(entry.completedAt)}
                  </time>
                ) : (
                  <span className="activity-log-entry__time activity-log-entry__time--muted">
                    ···
                  </span>
                )}
                <pre className="activity-log-entry__line">{entry.line}</pre>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

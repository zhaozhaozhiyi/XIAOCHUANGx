"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatAiDisclaimer } from "./ChatAiDisclaimer";
import { ChatAgentModelPicker } from "./ChatAgentModelPicker";
import { ChatComposer } from "./ChatComposer";
import { ChatTurnList } from "./ChatTurnList";
import { ChatTopBar } from "./ChatTopBar";
import { PinnedTodoBar } from "./PinnedTodoBar";
import { useChatAgentSelection } from "./useChatAgentSelection";
import { buildChatScrollContentKey } from "@/lib/chat-scroll";
import { useChatScrollPin } from "./useChatScrollPin";
import { useChatSend } from "./useChatSend";
import { useSettings } from "@/components/settings/SettingsContext";
import { consumePendingSession } from "@/lib/chat";
import {
  applyRunRecordToMessage,
  loadSessionMessagesHybrid,
  saveSessionMessagesHybrid,
} from "@/lib/chat-session-sync";
import {
  latestTodoPartFromMessages,
  todoPartKey,
} from "@/lib/chat-timeline";
import {
  getChatSession,
  isSessionStarted,
  markSessionRead,
  setSessionRunStatus,
} from "@/lib/chat-history";
import { useSidebarCollapsed } from "@/components/layout/SidebarLayoutContext";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import {
  getResearchProject,
  getSessionProjectId,
  isUsingLocalProject,
  NO_PROJECT_ID,
} from "@/lib/research-projects";
import type { ChatModeId } from "@/lib/navigation";
import { normalizeChatMode } from "@/lib/navigation";
import { fetchRunEvents, fetchRunRecord } from "@/lib/companion/runtime";
import { applyRunEventsToMessage } from "@/lib/chat-run-events";
import { useChatSessionOptional } from "@/contexts/ChatSessionContext";
import { ChevronDown } from "lucide-react";
import type { ChatComposerSendPayload } from "@/components/chat/ChatComposer";

export function ChatThread({ id }: { id: string }) {
  const sidebarCollapsed = useSidebarCollapsed();
  const { settings } = useSettings();
  const { executionSource, agentId, agentModel, selectAgentModel } =
    useChatAgentSelection();
  const { messages, sendMessage, isReplying, stopReply, bottomRef, setMessages } =
    useChatSend(id, []);
  const [hydrated, setHydrated] = useState(false);
  const pendingHandled = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [dismissedTodoKey, setDismissedTodoKey] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<ChatModeId>("fast");

  const pinnedTodo = useMemo(
    () => latestTodoPartFromMessages(messages),
    [messages],
  );
  const pinnedTodoKey = pinnedTodo ? todoPartKey(pinnedTodo) : null;
  const showPinnedTodo =
    pinnedTodo != null && pinnedTodoKey !== dismissedTodoKey;
  const deliverablesKey = useMemo(
    () =>
      messages
        .flatMap((message) =>
          (message.parts ?? [])
            .filter((part) => part.kind === "deliverables")
            .flatMap((part) =>
              part.items.map(
                (item) =>
                  `${part.id}:${part.completedAt ?? ""}:${item.path}`,
              ),
            ),
        )
        .join("|"),
    [messages],
  );

  const scrollContentKey = useMemo(
    () => buildChatScrollContentKey(messages),
    [messages],
  );
  const { showJumpToBottom, scrollToBottom, markPinned } = useChatScrollPin(
    scrollRootRef,
    {
      messageCount: messages.length,
      isReplying,
      contentKey: scrollContentKey,
    },
  );

  const sessionProjectId = getSessionProjectId(id);
  const { setWorkspaceProject } = useWorkspaceProject();
  const workspace = useWorkspaceOptional();
  const chatSession = useChatSessionOptional();
  const publishSessionRef = useRef(chatSession?.publishSession);
  const lastRefreshedDeliverablesKey = useRef("");

  useEffect(() => {
    publishSessionRef.current = chatSession?.publishSession;
  }, [chatSession?.publishSession]);

  useEffect(() => {
    publishSessionRef.current?.(id, messages);
  }, [id, messages]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false);
    void loadSessionMessagesHybrid(id).then((msgs) => {
      if (cancelled) return;
      if (msgs.length > 0) setMessages(msgs);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, setMessages]);

  useEffect(() => {
    const p = getResearchProject(sessionProjectId);
    setWorkspaceProject(sessionProjectId, p?.name ?? "临时工作区");
  }, [sessionProjectId, setWorkspaceProject]);

  const showProjectPicker =
    !isSessionStarted(id) && messages.length === 0;

  let hasInflightAssistant = false;
  let inflightRunId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (
      message?.role === "assistant" &&
      (message.status === "loading" || message.status === "streaming")
    ) {
      hasInflightAssistant = true;
      inflightRunId = message.runId;
      break;
    }
  }

  const composerGenerating = isReplying || hasInflightAssistant;

  const handleStop = useCallback(() => {
    stopReply(inflightRunId);
  }, [inflightRunId, stopReply]);

  const handleSend = useCallback(
    async (payload: ChatComposerSendPayload) => {
      markPinned();
      setDismissedTodoKey(null);
      setLastMode(normalizeChatMode(payload.mode) ?? "fast");
      await sendMessage(payload.text, {
        executionSource: payload.executionSource,
        mode: payload.mode,
        agentId: payload.agentId,
        agentModel: payload.agentModel,
        apiProvider: settings.apiProvider,
        projectId: payload.projectId,
        attachments: payload.attachments,
      });
    },
    [markPinned, sendMessage, settings.apiProvider],
  );

  const handleClarificationSubmitted = useCallback(
    (partId: string, answer: string) => {
      setSessionRunStatus(id, "running");
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (part.id !== partId || part.kind !== "clarification") {
              return part;
            }
            changed = true;
            return {
              ...part,
              submitted: true,
              answer,
              streaming: false,
              completedAt: Date.now(),
            };
          });
          return changed
            ? {
                ...message,
                parts,
                status: "complete" as const,
              }
            : message;
        }),
      );
    },
    [id, setMessages],
  );

  const handleClarificationDraftChange = useCallback(
    (
      partId: string,
      patch: {
        selectedOptions?: Record<string, string[]>;
        draft?: string;
      },
    ) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (part.id !== partId || part.kind !== "clarification") {
              return part;
            }
            changed = true;
            return {
              ...part,
              ...patch,
            };
          });
          return changed ? { ...message, parts } : message;
        }),
      );
    },
    [setMessages],
  );

  const handleClarificationContinue = useCallback(
    (answer: string) => {
      markPinned();
      sendMessage(`我补充的信息如下，请继续完成刚才的任务：\n\n${answer}`, {
        executionSource,
        mode: lastMode,
        agentId,
        agentModel,
        apiProvider: settings.apiProvider,
        projectId: sessionProjectId ?? NO_PROJECT_ID,
      });
    },
    [
      agentId,
      agentModel,
      executionSource,
      lastMode,
      markPinned,
      sendMessage,
      sessionProjectId,
      settings.apiProvider,
    ],
  );

  const stored = getChatSession(id);
  const title =
    messages.find((m) => m.role === "user")?.content.slice(0, 40) ??
    stored?.title ??
    "新对话";

  const project = isUsingLocalProject(sessionProjectId)
    ? getResearchProject(sessionProjectId)
    : undefined;

  useEffect(() => {
    if (!hydrated || pendingHandled.current) return;
    const pending = consumePendingSession(id);
    if (pending) {
      pendingHandled.current = true;
      markPinned();
      sendMessage(pending.text, {
        executionSource: pending.executionSource,
        mode: pending.mode,
        agentId: pending.agentId,
        agentModel: pending.agentModel,
        apiProvider: settings.apiProvider,
        projectId: pending.projectId ?? sessionProjectId ?? NO_PROJECT_ID,
        attachments: pending.attachments,
      });
    }
  }, [
    hydrated,
    id,
    markPinned,
    sendMessage,
    sessionProjectId,
    settings.apiProvider,
  ]);

  useEffect(() => {
    if (!hydrated || messages.length === 0) return;
    const t = window.setTimeout(() => {
      void saveSessionMessagesHybrid(id, messages, sessionProjectId);
    }, 400);
    return () => window.clearTimeout(t);
  }, [hydrated, id, messages, sessionProjectId]);

  useEffect(() => {
    if (!hydrated || !deliverablesKey || !workspace) return;
    if (deliverablesKey === lastRefreshedDeliverablesKey.current) return;
    lastRefreshedDeliverablesKey.current = deliverablesKey;
    workspace.refreshTree();
  }, [deliverablesKey, hydrated, workspace]);

  useEffect(() => {
    if (!hydrated || isReplying) return;
    const restorableRunIds = messages
      .filter(
        (message) =>
          message.role === "assistant" &&
          !!message.runId &&
          ((message.status === "loading" || message.status === "streaming") ||
            !message.parts?.length),
      )
      .map((message) => message.runId!)
      .filter((runId, index, list) => list.indexOf(runId) === index);

    if (restorableRunIds.length === 0) return;
    const hasInflight = messages.some(
      (message) =>
        message.role === "assistant" &&
        !!message.runId &&
        (message.status === "loading" || message.status === "streaming"),
    );
    if (hasInflight) setSessionRunStatus(id, "running");
    let cancelled = false;

    const poll = async () => {
      const records = await Promise.all(
        restorableRunIds.map(async (runId) => {
          try {
            return await fetchRunRecord(runId);
          } catch {
            return null;
          }
        }),
      );
      const eventResults = await Promise.all(
        restorableRunIds.map(async (runId) => {
          try {
            return [runId, await fetchRunEvents(runId)] as const;
          } catch {
            return [runId, null] as const;
          }
        }),
      );
      if (cancelled) return;
      const byRunId = new Map(
        records
          .filter((record): record is NonNullable<typeof record> => record != null)
          .map((record) => [record.runId, record]),
      );
      const eventsByRunId = new Map(eventResults);
      if (byRunId.size === 0) return;

      setMessages((prev) =>
        prev.map((message) => {
          if (!message.runId || !byRunId.has(message.runId)) return message;
          const events = eventsByRunId.get(message.runId);
          if (events?.items?.length) {
            return applyRunEventsToMessage(
              message,
              events.items,
              byRunId.get(message.runId)!,
            );
          }
          return applyRunRecordToMessage(message, byRunId.get(message.runId)!);
        }),
      );

      const stillRunning = [...byRunId.values()].some(
        (record) =>
          record.status === "accepted" ||
          record.status === "queued" ||
          record.status === "starting" ||
          record.status === "running",
      );
      const waitingUser = [...byRunId.values()].some(
        (record) => record.status === "waiting_user",
      );
      if (waitingUser) setSessionRunStatus(id, "waiting_user");
      else if (hasInflight && !stillRunning) setSessionRunStatus(id, "idle");
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrated, id, isReplying, messages, setMessages]);

  useEffect(() => {
    markSessionRead(id);
  }, [id]);

  useEffect(() => {
    if (!isReplying) {
      markSessionRead(id);
    }
  }, [id, isReplying]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-sm text-[var(--fg-tertiary)]">
        <span className="inline-flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:300ms]" />
        </span>
        加载会话…
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatTopBar
        sidebarCollapsed={sidebarCollapsed}
        left={
          <ChatAgentModelPicker
            executionSource={executionSource}
            agentId={agentId}
            agentModel={agentModel}
            onChange={selectAgentModel}
          />
        }
        center={
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <h1 className="font-display line-clamp-1 w-full text-center text-sm text-[var(--fg)]">
              {title}
            </h1>
            {project && (
              <span className="line-clamp-1 max-w-full text-center text-[11px] text-[var(--fg-tertiary)]">
                {project.name}
              </span>
            )}
          </div>
        }
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRootRef}
          className="chat-scroll-root min-h-0 flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <div className="chat-scroll-content mx-auto max-w-[var(--chat-message-max)]">
              <p className="text-center text-sm text-[var(--fg-tertiary)]">
                {showProjectPicker
                  ? "选择项目并发送第一条消息开始对话"
                  : "发送第一条消息开始对话"}
              </p>
            </div>
          ) : (
            <ChatTurnList
              messages={messages}
              scrollRootRef={scrollRootRef}
              bottomRef={bottomRef}
              thinkingGapMinMs={lastMode === "deep" ? 3_000 : 8_000}
              onClarificationSubmitted={handleClarificationSubmitted}
              onClarificationContinue={handleClarificationContinue}
              onClarificationDraftChange={handleClarificationDraftChange}
            />
          )}
        </div>

        {showJumpToBottom ? (
          <button
            type="button"
            className="pointer-events-auto absolute bottom-40 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
            onClick={() => scrollToBottom(isReplying ? "auto" : "smooth")}
            aria-label="回到底部"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            回到底部
          </button>
        ) : null}

        <footer className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="pointer-events-auto mx-auto max-w-[var(--chat-message-max)]">
            {showPinnedTodo ? (
              <PinnedTodoBar
                part={pinnedTodo}
                onDismiss={() => setDismissedTodoKey(pinnedTodoKey)}
              />
            ) : null}
            <ChatComposer
              sessionId={id}
              executionSource={executionSource}
              agentId={agentId}
              agentModel={agentModel}
              showProjectPicker={showProjectPicker}
              placeholder={
                showProjectPicker
                  ? "输入问题… 输入 @ 提及当前项目内文件"
                  : "继续提问… 输入 @ 提及当前项目文件"
              }
              onSend={handleSend}
              generating={composerGenerating}
              onStop={handleStop}
            />
            <ChatAiDisclaimer />
          </div>
        </footer>
      </div>
    </div>
  );
}

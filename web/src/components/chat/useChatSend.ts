"use client";

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  createAssistantPlaceholder,
  createMessage,
  type ChatMessage,
} from "@/lib/chat";
import {
  isWaitingUserSignal,
  markSessionStarted,
  setSessionRunStatus,
  upsertChatSession,
} from "@/lib/chat-history";
import type { ChatSendContext } from "@/lib/chat-send";
import {
  applyPartsStateToMessage,
  initAssistantPartsState,
  reduceAppendPart,
  reducePartPatch,
  reduceRunStarted,
  reduceClarificationRequired,
  reduceInterimAssistant,
  reduceRunSkills,
  reduceStatusLabel,
  reduceStreamCancelled,
  reduceStreamError,
  reduceStreamFinished,
  reduceTextDelta,
  reduceTodoItems,
  reduceToolProgress,
  type AssistantPartsState,
} from "@/lib/chat-parts-reducer";
import { withAssistantContentSnapshot } from "@/lib/chat-parts-utils";
import type {
  CanonicalEvent,
  CanonicalTurnOutput,
  ChatPart,
} from "@/lib/chat-parts";
import { reduceCanonicalOutput } from "@/lib/canonical-output";
import {
  useChatRunController,
  type AssistantStateUpdater,
} from "@/components/chat/useChatRunController";

function inferNextStreamSeq(parts: ChatPart[] | undefined): number {
  if (!parts?.length) return 0;
  const max = parts.reduce(
    (m, p) => (p.streamSeq != null && p.streamSeq > m ? p.streamSeq : m),
    -1,
  );
  return max + 1;
}
import { assertAgentAvailableRuntime } from "@/lib/agents-runtime";
import { useSettings } from "@/components/settings/SettingsContext";
import { assertAgentAvailable } from "@/lib/hermes/agent";
import { streamChatCompletion } from "@/lib/hermes/client";
import { agentLabel } from "@/lib/settings";
import {
  persistedAttachment,
  uploadChatAttachments,
} from "@/lib/chat-attachments";
import { saveSessionMessagesHybrid } from "@/lib/chat-session-sync";

function finalizeInFlightMessages(prev: ChatMessage[]): ChatMessage[] {
  return prev.map((m) => {
    if (m.status !== "loading" && m.status !== "streaming") return m;
    const cancelledAt = Date.now();
    const cancelled =
      m.role === "assistant"
        ? (() => {
            const next = withAssistantContentSnapshot({
              ...applyPartsStateToMessage(
                m,
                reduceStreamCancelled({
                  ...initAssistantPartsState(),
                  parts: m.parts ?? [],
                  activityCollapse: m.activityCollapse ?? "expanded",
                  runId: m.runId,
                  runStartedAt: m.runStartedAt,
                  nextStreamSeq: inferNextStreamSeq(m.parts),
                }),
              ),
              status: "cancelled",
            });
            return {
              ...next,
              canonicalOutput: {
                ...(next.canonicalOutput ?? {
                  protocolVersion: 1,
                  sessionId: "local",
                  turnId: next.id,
                  runId: next.runId ?? next.id,
                  provider: {
                    agentId: next.agentId ?? "unknown",
                    providerId: next.agentId ?? "unknown",
                  },
                  finalAnswer: { markdown: next.content },
                }),
                outcome: {
                  ...(next.canonicalOutput?.outcome ?? {}),
                  status: "cancelled",
                  finishedAt: cancelledAt,
                  durationMs: next.runStartedAt
                    ? Math.max(0, cancelledAt - next.runStartedAt)
                    : undefined,
                  message: "已中断",
                },
                finalAnswer: {
                  ...(next.canonicalOutput?.finalAnswer ?? {}),
                  markdown: next.content,
                },
                nextAction: { type: "none" },
              },
            } satisfies ChatMessage;
          })()
        : {
            ...m,
            status: "cancelled" as const,
            content: m.content.trim() || "（已中断）",
          };
    return cancelled;
  });
}

function appendCanonicalEvent(
  message: ChatMessage,
  event: CanonicalEvent,
  sessionId: string,
): ChatMessage {
  if (message.role !== "assistant") return message;
  const canonicalEvents = [...(message.canonicalEvents ?? []), event];
  const canonicalOutput = reduceCanonicalOutput(message.canonicalOutput, event, {
    sessionId,
    turnId: message.id,
  });
  return { ...message, canonicalEvents, canonicalOutput };
}

function applyCanonicalOutput(
  message: ChatMessage,
  canonicalOutput: CanonicalTurnOutput,
): ChatMessage {
  if (message.role !== "assistant") return message;
  return withAssistantContentSnapshot({
    ...message,
    canonicalOutput,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败";
}

export function useChatSend(sessionId: string, initialMessages: ChatMessage[] = []) {
  const { agentsRuntime } = useSettings();
  const [messages, setMessagesState] = useState<ChatMessage[]>(initialMessages);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  const setMessages: Dispatch<SetStateAction<ChatMessage[]>> = useCallback(
    (next) => {
      const resolved =
        typeof next === "function"
          ? (next as (value: ChatMessage[]) => ChatMessage[])(
              messagesRef.current,
            )
          : next;
      messagesRef.current = resolved;
      setMessagesState(resolved);
    },
    [],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const partsStateRef = useRef<AssistantPartsState>(initAssistantPartsState());
  const {
    isReplying,
    beginRun,
    cancelPendingFlush,
    drainPendingFlush,
    finishRunUiState,
    isCurrentRun,
    interruptCurrentRun,
    markReplying,
    schedulePatch: scheduleRunPatch,
    setCompanionRunId,
  } = useChatRunController(sessionId);

  const patchAssistant = useCallback(
    (
      assistantId: string,
      runId: number,
      updater: (s: AssistantPartsState) => AssistantPartsState,
      options?: { status?: ChatMessage["status"] },
    ) => {
      if (!isCurrentRun(runId)) return;
      partsStateRef.current = updater(partsStateRef.current);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const next = applyPartsStateToMessage(m, partsStateRef.current, {
            syncContent: false,
          });
          return options?.status ? { ...next, status: options.status } : next;
        }),
      );
    },
    [isCurrentRun, setMessages],
  );

  const appendAssistantCanonicalEvent = useCallback(
    (assistantId: string, runId: number, event: CanonicalEvent) => {
      if (!isCurrentRun(runId)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? appendCanonicalEvent(m, event, sessionId) : m,
        ),
      );
    },
    [isCurrentRun, sessionId, setMessages],
  );

  const applyAssistantCanonicalOutput = useCallback(
    (
      assistantId: string,
      runId: number,
      canonicalOutput: CanonicalTurnOutput,
    ) => {
      if (!isCurrentRun(runId)) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? applyCanonicalOutput(m, canonicalOutput) : m,
        ),
      );
    },
    [isCurrentRun, setMessages],
  );

  const drainRunPatches = useCallback(
    (runId: number) => {
      const finishQueue = drainPendingFlush(runId);
      partsStateRef.current = finishQueue.reduce(
        (s, fn) => fn(s),
        partsStateRef.current,
      );
    },
    [drainPendingFlush],
  );

  const commitAssistantSnapshot = useCallback(
    (
      assistantId: string,
      patch: {
        status: ChatMessage["status"];
        agentId?: ChatMessage["agentId"];
      },
    ) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? withAssistantContentSnapshot({
                ...applyPartsStateToMessage(m, partsStateRef.current),
                ...patch,
              })
            : m,
        ),
      );
    },
    [setMessages],
  );

  const sendMessage = useCallback(
    async (text: string, context: ChatSendContext) => {
      const trimmed = text.trim();
      if (!trimmed && !context.attachments?.length) return;
      const sessionTitle =
        trimmed.slice(0, 48) ||
        context.attachments?.[0]?.name.slice(0, 48) ||
        "附件";

      const agentError =
        context.executionSource === "api"
          ? null
          : agentsRuntime.execution === "companion"
            ? assertAgentAvailableRuntime(agentsRuntime, context.agentId)
            : assertAgentAvailable(context.agentId);
      if (agentError) {
        markSessionStarted(sessionId);
        upsertChatSession({
          id: sessionId,
          title: sessionTitle,
          projectId: context.projectId,
          runStatus: "idle",
        });
        const userMsg = createMessage(
          "user",
          trimmed,
          "complete",
          context.attachments?.map(persistedAttachment),
        );
        setMessages((prev) => [
          ...prev,
          userMsg,
          createMessage("assistant", agentError, "error"),
        ]);
        return;
      }

      const { runId, controller } = beginRun();
      let uploadedAttachments;
      try {
        uploadedAttachments = await uploadChatAttachments(
          sessionId,
          context.attachments,
          context.projectId,
          controller.signal,
        );
      } catch (error) {
        finishRunUiState(runId, controller);
        markSessionStarted(sessionId);
        upsertChatSession({
          id: sessionId,
          title: sessionTitle,
          projectId: context.projectId,
          runStatus: "idle",
        });
        throw error;
      }
      const sendContext: ChatSendContext = {
        ...context,
        attachments: uploadedAttachments,
      };

      const userMsg = createMessage(
        "user",
        trimmed,
        "complete",
        uploadedAttachments?.map(persistedAttachment),
      );
      const userMsgForApi: ChatMessage = {
        ...userMsg,
        attachments: uploadedAttachments,
      };
      markSessionStarted(sessionId);
      upsertChatSession({
        id: sessionId,
        title: sessionTitle,
        projectId: context.projectId,
        runStatus: "running",
      });

      const assistantId = `assistant-${Date.now()}`;
      partsStateRef.current = reduceRunStarted(initAssistantPartsState());
      const assistantPlaceholder: ChatMessage = {
        ...createAssistantPlaceholder(assistantId),
        status: "streaming",
        parts: partsStateRef.current.parts,
        activityCollapse: partsStateRef.current.activityCollapse,
      };

      /** 始终携带客户端已持久化的会话历史（与 Companion Session API 对齐） */
      const useClientHistory = true;
      const currentMessages = messagesRef.current;
      const steering = currentMessages.some(
        (m) => m.status === "loading" || m.status === "streaming",
      );
      const baseMessages = steering
        ? finalizeInFlightMessages(currentMessages)
        : currentMessages;
      const historyForUi = [...baseMessages, userMsg];
      const historyForApi = [...baseMessages, userMsgForApi];
      messagesRef.current = [...historyForUi, assistantPlaceholder];
      setMessages(messagesRef.current);
      void saveSessionMessagesHybrid(sessionId, historyForUi, context.projectId).catch(console.error);
      markReplying();

      const schedulePatch = (updater: AssistantStateUpdater) => {
        scheduleRunPatch(runId, updater, (queue) => {
          patchAssistant(assistantId, runId, (s) =>
            queue.reduce((acc, fn) => fn(acc), s),
          );
        });
      };

      let result: Awaited<ReturnType<typeof streamChatCompletion>>;
      try {
        result = await streamChatCompletion({
          sessionId,
          context: sendContext,
          messages: historyForApi,
          useClientHistory,
          signal: controller.signal,
          onStreamStart: () => {
            if (!isCurrentRun(runId)) return;
            schedulePatch((s) =>
              s.runStartedAt ? s : reduceRunStarted(s, s.runId),
            );
          },
          onRunStarted: (payload) => {
            setCompanionRunId(payload.runId);
            schedulePatch((s) =>
              reduceRunSkills(reduceRunStarted(s, payload), {
                processSkill: payload.processSkill,
                platformNormSkill: payload.platformNormSkill,
                catalogSlugs: payload.catalogSlugs,
                injectedSkills: payload.injectedSkills,
              }),
            );
          },
          onDelta: (chunk) => {
            schedulePatch((s) => reduceTextDelta(s, chunk));
          },
          onInterimAssistant: (payload) => {
            schedulePatch((s) => reduceInterimAssistant(s, payload));
          },
          onCanonicalEvent: (event) => {
            appendAssistantCanonicalEvent(assistantId, runId, event);
          },
          onCanonicalOutput: (canonicalOutput) => {
            applyAssistantCanonicalOutput(assistantId, runId, canonicalOutput);
          },
          onToolProgress: (payload) => {
            schedulePatch((s) => reduceToolProgress(s, payload));
          },
          onClarificationRequired: (payload) => {
            setSessionRunStatus(sessionId, "waiting_user");
            schedulePatch((s) =>
              reduceClarificationRequired(s, {
                runId: payload.runId,
                clarificationId: payload.clarificationId,
                toolUseId: payload.toolUseId,
                question: payload.question,
                questions: payload.questions,
              }),
            );
          },
          onPartAppend: (part) => {
            schedulePatch((s) => reduceAppendPart(s, part));
          },
          onPartPatch: (patch) => {
            schedulePatch((s) => reducePartPatch(s, patch));
          },
          onTodoUpdate: (items) => {
            schedulePatch((s) => reduceTodoItems(s, items));
          },
          onStatus: (label, phase) => {
            if (isWaitingUserSignal(label, phase)) {
              setSessionRunStatus(sessionId, "waiting_user");
            }
            schedulePatch((s) => reduceStatusLabel(s, label, phase));
          },
          onRunFinished: () => {
            if (!isCurrentRun(runId)) return;
            partsStateRef.current = reduceStreamFinished(partsStateRef.current);
          },
          onRunCancelled: () => {
            if (!isCurrentRun(runId)) return;
            partsStateRef.current = reduceStreamCancelled(partsStateRef.current);
          },
          onRunError: (message) => {
            if (!isCurrentRun(runId)) return;
            partsStateRef.current = reduceStreamError(
              partsStateRef.current,
              message,
            );
          },
        });
      } catch (error) {
        if (controller.signal.aborted || !isCurrentRun(runId)) {
          cancelPendingFlush(runId);
          return;
        }

        drainRunPatches(runId);
        partsStateRef.current = reduceStreamError(
          partsStateRef.current,
          accumulatedErrorMessage(
            errorMessage(error),
            context.agentId,
            context.executionSource,
          ),
        );
        commitAssistantSnapshot(assistantId, { status: "error" });
        finishRunUiState(runId, controller);
        return;
      }

      if (controller.signal.aborted || !isCurrentRun(runId)) {
        cancelPendingFlush(runId);
        return;
      }

      if (!result.ok) {
        drainRunPatches(runId);
        partsStateRef.current = reduceStreamError(
          partsStateRef.current,
          accumulatedErrorMessage(
            result.error,
            context.agentId,
            context.executionSource,
          ),
        );
        commitAssistantSnapshot(assistantId, { status: "error" });
        finishRunUiState(runId, controller);
        return;
      }

      drainRunPatches(runId);
      partsStateRef.current = reduceStreamFinished(partsStateRef.current);
      commitAssistantSnapshot(assistantId, {
        status: "complete",
        agentId: context.agentId,
      });
      finishRunUiState(runId, controller);
    },
    [
      agentsRuntime,
      appendAssistantCanonicalEvent,
      applyAssistantCanonicalOutput,
      beginRun,
      cancelPendingFlush,
      commitAssistantSnapshot,
      drainRunPatches,
      finishRunUiState,
      isCurrentRun,
      markReplying,
      patchAssistant,
      scheduleRunPatch,
      sessionId,
      setCompanionRunId,
      setMessages,
    ],
  );

  const stopReply = useCallback((runId?: string) => {
    interruptCurrentRun(() =>
      setMessages((prev) => finalizeInFlightMessages(prev)),
      runId,
    );
  }, [interruptCurrentRun, setMessages]);

  return {
    messages,
    sendMessage,
    isReplying,
    stopReply,
    bottomRef,
    setMessages,
  };
}

function accumulatedErrorMessage(
  error: string,
  agentId: Parameters<typeof agentLabel>[0],
  executionSource: ChatSendContext["executionSource"],
) {
  if (executionSource === "api") {
    return `无法通过模型 API 完成请求：${error}\n\n请检查 Provider 地址、API Key、模型 ID 与网络连通性；若是企业网关，也请确认该地址未被安全策略拦截。`;
  }
  return `无法通过 ${agentLabel(agentId)} 完成请求：${error}\n\n请检查本机 Companion、对应 CLI 登录/权限与网络状态；若使用 Hermes 捷径，请确认 gateway 已启动且 HERMES_API_URL 可访问。`;
}

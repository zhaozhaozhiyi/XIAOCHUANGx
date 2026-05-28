"use client";

import { useCallback, useRef, useState } from "react";
import { patchChatSession } from "@/lib/chat-history";
import type { AssistantPartsState } from "@/lib/chat-parts-reducer";
import { cancelCompanionRun } from "@/lib/companion/cancel-run";

export type AssistantStateUpdater = (
  state: AssistantPartsState,
) => AssistantPartsState;

type PendingAssistantFlush = {
  runId: number;
  frame: number | null;
  updaters: AssistantStateUpdater[];
};

type ActiveChatRun = {
  runId: number;
  controller: AbortController;
};

export function useChatRunController(sessionId: string) {
  const [isReplying, setIsReplying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const companionRunIdRef = useRef<string | null>(null);
  const runIdRef = useRef(0);
  const pendingFlushRef = useRef<PendingAssistantFlush | null>(null);

  const isCurrentRun = useCallback((runId: number) => {
    return runId === runIdRef.current;
  }, []);

  const cancelPendingFlush = useCallback((runId?: number) => {
    const pending = pendingFlushRef.current;
    if (!pending || (runId != null && pending.runId !== runId)) return;
    if (pending.frame !== null) {
      cancelAnimationFrame(pending.frame);
    }
    pendingFlushRef.current = null;
  }, []);

  const beginRun = useCallback((): ActiveChatRun => {
    const runId = ++runIdRef.current;
    cancelPendingFlush();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    pendingFlushRef.current = { runId, frame: null, updaters: [] };

    return { runId, controller };
  }, [cancelPendingFlush]);

  const schedulePatch = useCallback(
    (
      runId: number,
      updater: AssistantStateUpdater,
      flush: (queue: AssistantStateUpdater[]) => void,
    ) => {
      const pending = pendingFlushRef.current;
      if (!pending || pending.runId !== runId) return;
      pending.updaters.push(updater);
      if (pending.frame !== null) return;
      pending.frame = requestAnimationFrame(() => {
        const current = pendingFlushRef.current;
        if (!current || current.runId !== runId) return;
        current.frame = null;
        const queue = current.updaters.splice(0);
        if (queue.length === 0) return;
        flush(queue);
      });
    },
    [],
  );

  const drainPendingFlush = useCallback((runId: number): AssistantStateUpdater[] => {
    const pending = pendingFlushRef.current;
    if (!pending || pending.runId !== runId) return [];
    if (pending.frame !== null) {
      cancelAnimationFrame(pending.frame);
    }
    const queue = pending.updaters.splice(0);
    pendingFlushRef.current = null;
    return queue;
  }, []);

  const markReplying = useCallback(() => {
    setIsReplying(true);
  }, []);

  const setCompanionRunId = useCallback((runId: string | null) => {
    companionRunIdRef.current = runId;
  }, []);

  const finishRunUiState = useCallback(
    (runId: number, controller: AbortController) => {
      if (!isCurrentRun(runId)) return;
      if (abortRef.current === controller) abortRef.current = null;
      companionRunIdRef.current = null;
      patchChatSession(sessionId, {
        runStatus: "idle",
        updatedAt: Date.now(),
      });
      setIsReplying(false);
    },
    [isCurrentRun, sessionId],
  );

  const stopCurrentRun = useCallback(
    (finalizeMessages: () => void, runIdOverride?: string) => {
      const companionRunId = runIdOverride ?? companionRunIdRef.current;
      if (!runIdOverride || companionRunIdRef.current === runIdOverride) {
        companionRunIdRef.current = null;
      }
      if (companionRunId) {
        void cancelCompanionRun(companionRunId);
      }
      runIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      cancelPendingFlush();
      patchChatSession(sessionId, {
        runStatus: "idle",
        updatedAt: Date.now(),
      });
      setIsReplying(false);
      finalizeMessages();
    },
    [cancelPendingFlush, sessionId],
  );

  const interruptCurrentRun = useCallback(
    (finalizeMessages: () => void, runIdOverride?: string) => {
      stopCurrentRun(finalizeMessages, runIdOverride);
    },
    [stopCurrentRun],
  );

  return {
    isReplying,
    beginRun,
    cancelPendingFlush,
    drainPendingFlush,
    finishRunUiState,
    isCurrentRun,
    markReplying,
    schedulePatch,
    setCompanionRunId,
    interruptCurrentRun,
    stopCurrentRun,
  };
}

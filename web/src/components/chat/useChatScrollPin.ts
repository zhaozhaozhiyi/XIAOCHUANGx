"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PIN_THRESHOLD_PX = 80;
const JUMP_THRESHOLD_PX = 120;
const DISCLOSURE_MAX_MS = 900;

type Options = {
  messageCount: number;
  isReplying: boolean;
  active?: boolean;
  resetKey?: string;
  /** 随流式 part / 文本增长而变，避免仅 messageCount 不触发贴底 */
  contentKey: string;
};

type VisibleAnswerAnchor = {
  answerId: string;
  blockId: string;
  top: number;
};

type LayoutSnapshot = {
  answerPhases: Map<string, string>;
  visibleAnswerAnchor: VisibleAnswerAnchor | null;
  scrollTop: number;
  pinned: boolean;
};

type DisclosureIntent = {
  trigger: HTMLElement;
  top: number;
  deadline: number;
  lastHeight: number;
  stableFrames: number;
};

function distanceToBottom(element: HTMLElement): number {
  return element.scrollHeight - element.scrollTop - element.clientHeight;
}

function captureLayoutSnapshot(root: HTMLElement): LayoutSnapshot {
  const rootRect = root.getBoundingClientRect();
  const answerPhases = new Map<string, string>();
  let visibleAnswerAnchor: VisibleAnswerAnchor | null = null;

  for (const answer of root.querySelectorAll<HTMLElement>("[data-answer-id]")) {
    const answerId = answer.dataset.answerId;
    if (!answerId) continue;
    answerPhases.set(answerId, answer.dataset.answerPhase ?? "");
    if (visibleAnswerAnchor) continue;
    const answerRect = answer.getBoundingClientRect();
    if (answerRect.bottom <= rootRect.top || answerRect.top >= rootRect.bottom) {
      continue;
    }
    for (const block of answer.querySelectorAll<HTMLElement>("[data-scroll-anchor]")) {
      const rect = block.getBoundingClientRect();
      if (rect.bottom <= rootRect.top || rect.top >= rootRect.bottom) continue;
      const blockId = block.dataset.scrollAnchor;
      if (!blockId) continue;
      visibleAnswerAnchor = {
        answerId,
        blockId,
        top: rect.top - rootRect.top,
      };
      break;
    }
  }

  return {
    answerPhases,
    visibleAnswerAnchor,
    scrollTop: root.scrollTop,
    pinned: distanceToBottom(root) < PIN_THRESHOLD_PX,
  };
}

function findAnswerBlock(
  root: HTMLElement,
  anchor: VisibleAnswerAnchor,
): HTMLElement | null {
  const answer = Array.from(
    root.querySelectorAll<HTMLElement>("[data-answer-id]"),
  ).find((candidate) => candidate.dataset.answerId === anchor.answerId);
  if (!answer) return null;
  return (
    Array.from(answer.querySelectorAll<HTMLElement>("[data-scroll-anchor]")).find(
      (candidate) => candidate.dataset.scrollAnchor === anchor.blockId,
    ) ?? null
  );
}

function reconciledAnswerIds(
  previous: Map<string, string>,
  current: Map<string, string>,
): Set<string> {
  const answerIds = new Set<string>();
  for (const [answerId, phase] of current) {
    if (phase === "final" && previous.get(answerId) === "provisional") {
      answerIds.add(answerId);
    }
  }
  return answerIds;
}

/**
 * 流式增长只在贴底时跟随；disclosure 和 provisional/final 协调各自恢复锚点。
 */
export function useChatScrollPin(
  scrollRootRef: React.RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const pinnedRef = useRef(true);
  const prevHeightRef = useRef(0);
  const snapshotRef = useRef<LayoutSnapshot | null>(null);
  const committedAnswerPhasesRef = useRef<Map<string, string>>(new Map());
  const resetKeyRef = useRef(options.resetKey);
  const disclosureRef = useRef<DisclosureIntent | null>(null);
  const disclosureFrameRef = useRef<number | null>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const measurePin = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    const distance = distanceToBottom(root);
    pinnedRef.current = distance < PIN_THRESHOLD_PX;
    setShowJumpToBottom(distance > JUMP_THRESHOLD_PX);
    const snapshot = captureLayoutSnapshot(root);
    if (
      reconciledAnswerIds(
        committedAnswerPhasesRef.current,
        snapshot.answerPhases,
      ).size === 0
    ) {
      snapshotRef.current = snapshot;
    }
  }, [scrollRootRef]);

  const finishDisclosure = useCallback(() => {
    disclosureRef.current = null;
    if (disclosureFrameRef.current !== null) {
      window.cancelAnimationFrame(disclosureFrameRef.current);
      disclosureFrameRef.current = null;
    }
    measurePin();
  }, [measurePin]);

  const restoreDisclosureAnchor = useCallback(() => {
    const root = scrollRootRef.current;
    const intent = disclosureRef.current;
    if (!root || !intent) return;
    if (!intent.trigger.isConnected || !root.contains(intent.trigger)) {
      finishDisclosure();
      return;
    }
    const currentTop =
      intent.trigger.getBoundingClientRect().top - root.getBoundingClientRect().top;
    const delta = currentTop - intent.top;
    if (Math.abs(delta) > 0.5) root.scrollTop += delta;
  }, [finishDisclosure, scrollRootRef]);

  const scheduleDisclosureSettle = useCallback(() => {
    if (disclosureFrameRef.current !== null) {
      window.cancelAnimationFrame(disclosureFrameRef.current);
    }
    const settle = () => {
      const root = scrollRootRef.current;
      const intent = disclosureRef.current;
      if (!root || !intent) return;
      restoreDisclosureAnchor();
      const height = root.scrollHeight;
      intent.stableFrames = Math.abs(height - intent.lastHeight) < 0.5
        ? intent.stableFrames + 1
        : 0;
      intent.lastHeight = height;
      if (intent.stableFrames >= 2 || performance.now() >= intent.deadline) {
        finishDisclosure();
        return;
      }
      disclosureFrameRef.current = window.requestAnimationFrame(settle);
    };
    disclosureFrameRef.current = window.requestAnimationFrame(settle);
  }, [finishDisclosure, restoreDisclosureAnchor, scrollRootRef]);

  const cancelLayoutIntent = useCallback(() => {
    disclosureRef.current = null;
    if (disclosureFrameRef.current !== null) {
      window.cancelAnimationFrame(disclosureFrameRef.current);
      disclosureFrameRef.current = null;
    }
  }, []);

  const beginUserDisclosure = useCallback(
    (trigger: HTMLElement) => {
      const root = scrollRootRef.current;
      if (!root || !root.contains(trigger)) return;
      cancelLayoutIntent();
      disclosureRef.current = {
        trigger,
        top: trigger.getBoundingClientRect().top - root.getBoundingClientRect().top,
        deadline: performance.now() + DISCLOSURE_MAX_MS,
        lastHeight: root.scrollHeight,
        stableFrames: 0,
      };
      scheduleDisclosureSettle();
    },
    [cancelLayoutIntent, scheduleDisclosureSettle, scrollRootRef],
  );

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const root = scrollRootRef.current;
      if (!root) return;
      cancelLayoutIntent();
      if (behavior === "smooth") {
        root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
      } else {
        root.scrollTop = root.scrollHeight;
      }
      pinnedRef.current = true;
      prevHeightRef.current = root.scrollHeight;
      setShowJumpToBottom(false);
      const snapshot = captureLayoutSnapshot(root);
      committedAnswerPhasesRef.current = snapshot.answerPhases;
      snapshotRef.current = snapshot;
    },
    [cancelLayoutIntent, scrollRootRef],
  );

  const applyStreamGrowth = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root) return;
    if (disclosureRef.current) {
      restoreDisclosureAnchor();
      return;
    }
    if (pinnedRef.current) root.scrollTop = root.scrollHeight;
    prevHeightRef.current = root.scrollHeight;
    measurePin();
  }, [measurePin, restoreDisclosureAnchor, scrollRootRef]);

  useEffect(() => {
    if (options.active === false) return;
    const root = scrollRootRef.current;
    if (!root) return;
    root.addEventListener("scroll", measurePin, { passive: true });
    measurePin();
    return () => root.removeEventListener("scroll", measurePin);
  }, [measurePin, options.active, scrollRootRef]);

  useLayoutEffect(() => {
    if (options.active === false) return;
    const root = scrollRootRef.current;
    if (!root) return;
    if (resetKeyRef.current !== options.resetKey) {
      resetKeyRef.current = options.resetKey;
      cancelLayoutIntent();
      pinnedRef.current = true;
      root.scrollTop = root.scrollHeight;
      prevHeightRef.current = root.scrollHeight;
      setShowJumpToBottom(false);
      const resetSnapshot = captureLayoutSnapshot(root);
      committedAnswerPhasesRef.current = resetSnapshot.answerPhases;
      snapshotRef.current = resetSnapshot;
      return;
    }
    const before = snapshotRef.current;
    const current = captureLayoutSnapshot(root);
    const reconciledIds = reconciledAnswerIds(
      committedAnswerPhasesRef.current,
      current.answerPhases,
    );

    if (disclosureRef.current) {
      restoreDisclosureAnchor();
    } else if (before && reconciledIds.size > 0) {
      if (before.pinned) {
        root.scrollTop = root.scrollHeight;
      } else {
        const anchor = before.visibleAnswerAnchor;
        const block =
          anchor && reconciledIds.has(anchor.answerId)
            ? findAnswerBlock(root, anchor)
            : null;
        if (block && anchor) {
          const currentTop =
            block.getBoundingClientRect().top - root.getBoundingClientRect().top;
          root.scrollTop += currentTop - anchor.top;
        } else {
          const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);
          root.scrollTop = Math.min(before.scrollTop, maxScrollTop);
        }
      }
      prevHeightRef.current = root.scrollHeight;
      measurePin();
    } else {
      applyStreamGrowth();
    }

    const settled = captureLayoutSnapshot(root);
    committedAnswerPhasesRef.current = settled.answerPhases;
    snapshotRef.current = settled;

  }, [
    applyStreamGrowth,
    cancelLayoutIntent,
    measurePin,
    options.contentKey,
    options.active,
    options.isReplying,
    options.messageCount,
    options.resetKey,
    restoreDisclosureAnchor,
    scrollRootRef,
  ]);

  useEffect(() => {
    if (options.active === false) return;
    const root = scrollRootRef.current;
    if (!root) return;
    const content = root.querySelector(".chat-scroll-content");
    const observeTarget = content ?? root;
    const observer = new ResizeObserver(() => {
      if (disclosureRef.current) {
        restoreDisclosureAnchor();
        scheduleDisclosureSettle();
        return;
      }
      applyStreamGrowth();
    });
    observer.observe(observeTarget);
    return () => observer.disconnect();
  }, [
    applyStreamGrowth,
    options.active,
    restoreDisclosureAnchor,
    scheduleDisclosureSettle,
    scrollRootRef,
  ]);

  useEffect(() => {
    if (!options.isReplying) return;
    pinnedRef.current = true;
    scrollToBottom("auto");
  }, [options.isReplying, scrollToBottom]);

  useEffect(
    () => () => {
      cancelLayoutIntent();
    },
    [cancelLayoutIntent],
  );

  return {
    showJumpToBottom,
    scrollToBottom,
    beginUserDisclosure,
    markPinned: () => {
      cancelLayoutIntent();
      pinnedRef.current = true;
    },
  };
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PIN_THRESHOLD_PX = 80;
const JUMP_THRESHOLD_PX = 120;

type Options = {
  messageCount: number;
  isReplying: boolean;
  /** 随流式 part / 文本增长而变，避免仅 messageCount 不触发贴底 */
  contentKey: string;
};

/**
 * 贴底才自动跟随；流式输出时 instant 滚到底部；
 * 用户上滑阅读时不被拽回（显示「回到底部」）。
 */
export function useChatScrollPin(
  scrollRootRef: React.RefObject<HTMLDivElement | null>,
  options: Options,
) {
  const pinnedRef = useRef(true);
  const prevHeightRef = useRef(0);
  const prevCountRef = useRef(options.messageCount);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const measurePin = useCallback(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distance < PIN_THRESHOLD_PX;
    setShowJumpToBottom(distance > JUMP_THRESHOLD_PX);
  }, [scrollRootRef]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = scrollRootRef.current;
      if (!el) return;
      if (behavior === "smooth") {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } else {
        el.scrollTop = el.scrollHeight;
      }
      pinnedRef.current = true;
      prevHeightRef.current = el.scrollHeight;
      setShowJumpToBottom(false);
    },
    [scrollRootRef],
  );

  const applyPinnedScroll = useCallback(
    (countIncreased: boolean) => {
      const el = scrollRootRef.current;
      if (!el) return;
      const prevHeight = prevHeightRef.current;
      const nextHeight = el.scrollHeight;

      if (pinnedRef.current) {
        el.scrollTop = nextHeight;
      } else if (countIncreased && nextHeight > prevHeight) {
        el.scrollTop += nextHeight - prevHeight;
      }

      prevHeightRef.current = nextHeight;
      measurePin();
    },
    [measurePin, scrollRootRef],
  );

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    el.addEventListener("scroll", measurePin, { passive: true });
    measurePin();
    return () => el.removeEventListener("scroll", measurePin);
  }, [measurePin, scrollRootRef]);

  useLayoutEffect(() => {
    const countIncreased = options.messageCount > prevCountRef.current;
    applyPinnedScroll(countIncreased);
    prevCountRef.current = options.messageCount;
  }, [
    applyPinnedScroll,
    options.contentKey,
    options.isReplying,
    options.messageCount,
  ]);

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;

    const content = el.querySelector(".chat-scroll-content");
    const observeTarget = content ?? el;

    const ro = new ResizeObserver(() => {
      applyPinnedScroll(false);
    });
    ro.observe(observeTarget);

    return () => ro.disconnect();
  }, [applyPinnedScroll, scrollRootRef]);

  useEffect(() => {
    if (!options.isReplying) return;
    pinnedRef.current = true;
    scrollToBottom("auto");
  }, [options.isReplying, scrollToBottom]);

  return {
    showJumpToBottom,
    scrollToBottom,
    markPinned: () => {
      pinnedRef.current = true;
    },
  };
}

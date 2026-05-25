"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const PIN_THRESHOLD_PX = 80;
const JUMP_THRESHOLD_PX = 120;

type Options = {
  messageCount: number;
  isReplying: boolean;
};

/**
 * 对齐 Open Design ChatPane：贴底才自动跟随；流式用 instant scroll；
 * 用户上滑阅读时不被拽回底部。
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
      setShowJumpToBottom(false);
    },
    [scrollRootRef],
  );

  useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    el.addEventListener("scroll", measurePin, { passive: true });
    measurePin();
    return () => el.removeEventListener("scroll", measurePin);
  }, [measurePin, scrollRootRef]);

  useLayoutEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const prevHeight = prevHeightRef.current;
    const nextHeight = el.scrollHeight;
    const countIncreased = options.messageCount > prevCountRef.current;

    if (pinnedRef.current) {
      el.scrollTop = nextHeight;
    } else if (countIncreased && nextHeight > prevHeight) {
      el.scrollTop += nextHeight - prevHeight;
    }

    prevHeightRef.current = nextHeight;
    prevCountRef.current = options.messageCount;
    measurePin();
  }, [
    measurePin,
    options.isReplying,
    options.messageCount,
    scrollRootRef,
  ]);

  return {
    showJumpToBottom,
    scrollToBottom,
    markPinned: () => {
      pinnedRef.current = true;
    },
  };
}

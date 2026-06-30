"use client";

import { useCallback, useEffect, useState } from "react";

/** 与 CSS --chat-sticky-gap 一致，吸顶判定锚点 */
const STICKY_TOP_OFFSET_PX = 12;

/**
 * 根据滚动位置判定当前视口内的 Turn（PRD F-QA-009）。
 * 规则：选中覆盖 sticky 锚点、且用户问仍有空间吸顶的 Turn。
 */
export function useActiveTurn(
  turnIds: string[],
  scrollRootRef: React.RefObject<HTMLElement | null>,
) {
  const fallbackActiveTurnId =
    turnIds.length > 0 ? turnIds[turnIds.length - 1]! : null;
  const [activeTurnId, setActiveTurnId] = useState<string | null>(
    fallbackActiveTurnId,
  );

  const update = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root || turnIds.length === 0) {
      setActiveTurnId(null);
      return;
    }

    const anchor = root.getBoundingClientRect().top + STICKY_TOP_OFFSET_PX;
    let active = turnIds[0]!;

    for (const id of turnIds) {
      const el = root.querySelector<HTMLElement>(`[data-turn-id="${id}"]`);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      const bottom = el.getBoundingClientRect().bottom;
      const userPanel = el.querySelector<HTMLElement>(".chat-turn-user-panel");
      const stickyHeight = userPanel?.getBoundingClientRect().height ?? 0;
      const stickyEnd = anchor + stickyHeight + 4;
      if (top <= anchor + 2 && bottom > stickyEnd) {
        active = id;
        break;
      }
      if (top > anchor + 2 && bottom > stickyEnd) {
        active = id;
        break;
      }
    }

    setActiveTurnId(active);
  }, [scrollRootRef, turnIds]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };

    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(root);

    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [scrollRootRef, update, turnIds]);

  if (activeTurnId && turnIds.includes(activeTurnId)) {
    return activeTurnId;
  }
  return fallbackActiveTurnId;
}

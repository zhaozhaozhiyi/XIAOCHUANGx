"use client";

import { useCallback, useEffect, useState } from "react";

/** 与 CSS --chat-sticky-gap 一致，吸顶判定锚点 */
const STICKY_TOP_OFFSET_PX = 12;

/**
 * 根据滚动位置判定当前视口内的 Turn（PRD F-QA-009）。
 * 规则：最后一个「顶部已越过滚动容器上沿」的 Turn 为 active。
 */
export function useActiveTurn(
  turnIds: string[],
  scrollRootRef: React.RefObject<HTMLElement | null>,
) {
  const [activeTurnId, setActiveTurnId] = useState<string | null>(
    turnIds.length > 0 ? turnIds[turnIds.length - 1]! : null,
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
      if (top <= anchor + 2) {
        active = id;
      }
    }

    setActiveTurnId(active);
  }, [scrollRootRef, turnIds]);

  useEffect(() => {
    setActiveTurnId((prev) => {
      if (prev && turnIds.includes(prev)) return prev;
      return turnIds.length > 0 ? turnIds[turnIds.length - 1]! : null;
    });
  }, [turnIds]);

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

  return activeTurnId;
}

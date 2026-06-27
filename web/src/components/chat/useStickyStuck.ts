"use client";

import { useEffect, useState } from "react";

/**
 * 检测 sticky 是否已吸顶：sentinel 须在 sticky 块**之前**的文档流中，
 * 吸顶后 sentinel 滚出视口上沿 → stuck=true。
 */
export function useStickyStuck(
  sentinelRef: React.RefObject<HTMLElement | null>,
  scrollRootRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setStuck(false);
      return;
    }

    const sentinel = sentinelRef.current;
    const root = scrollRootRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      setStuck(false);
    };
  }, [enabled, scrollRootRef, sentinelRef]);

  return stuck;
}

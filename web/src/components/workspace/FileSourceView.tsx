"use client";

import { useEffect, useRef } from "react";

export function FileSourceView({
  content,
  highlightLine,
  highlightEndLine,
  onRevealed,
}: {
  content: string;
  highlightLine?: number;
  highlightEndLine?: number;
  onRevealed?: () => void;
}) {
  const lineRef = useRef<HTMLDivElement>(null);
  const lines = content.split("\n");
  const start = highlightLine ?? 0;
  const end = highlightEndLine ?? start;

  useEffect(() => {
    if (!highlightLine || !lineRef.current) return;
    lineRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    onRevealed?.();
  }, [content, highlightLine, onRevealed]);

  return (
    <pre className="font-mono text-[13px] leading-relaxed text-[var(--fg)]">
      {lines.map((line, i) => {
        const n = i + 1;
        const inRange =
          highlightLine != null && n >= start && n <= (end || start);
        return (
          <div
            key={i}
            ref={n === highlightLine ? lineRef : undefined}
            className={`flex gap-3 px-1 ${inRange ? "bg-[var(--accent-muted)]" : ""}`}
          >
            <span className="w-8 shrink-0 select-none text-right text-[11px] text-[var(--fg-tertiary)]">
              {n}
            </span>
            <code className="min-w-0 flex-1 whitespace-pre-wrap break-words">
              {line || " "}
            </code>
          </div>
        );
      })}
    </pre>
  );
}

"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

function TimelineCompleteRow({ label }: { label: string }) {
  return (
    <div className="chat-timeline-complete-row mt-1.5">
      <span className="chat-timeline-complete-row__icon" aria-hidden>
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </span>
      <span className="chat-timeline-complete-row__label text-xs text-[var(--fg-tertiary)]">
        {label}
      </span>
    </div>
  );
}

const COLLAPSE_LINE_LIMIT = 5;
const COLLAPSE_CHAR_LIMIT = 320;

export function TimelineCollapsible({
  text,
  streaming = false,
  streamingLabel = "思考中…",
  completeLabel,
  className = "",
}: {
  text: string;
  streaming?: boolean;
  streamingLabel?: string;
  /** 设置后始终全文展示，完成后显示该文案（如「结束」），不再展开/收起 */
  completeLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const preRef = useRef<HTMLPreElement | null>(null);
  const shouldFollowTailRef = useRef(true);

  const { preview, collapsible } = useMemo(() => {
    if (completeLabel || streaming || !text) {
      return { preview: text, collapsible: false };
    }
    const lines = text.split("\n");
    if (lines.length > COLLAPSE_LINE_LIMIT || text.length > COLLAPSE_CHAR_LIMIT) {
      const clipped = lines.slice(0, COLLAPSE_LINE_LIMIT).join("\n");
      const previewText =
        clipped.length > COLLAPSE_CHAR_LIMIT
          ? `${clipped.slice(0, COLLAPSE_CHAR_LIMIT).trimEnd()}…`
          : `${clipped}${lines.length > COLLAPSE_LINE_LIMIT ? "…" : ""}`;
      return { preview: previewText, collapsible: true };
    }
    return { preview: text, collapsible: false };
  }, [completeLabel, streaming, text]);

  const showFull = streaming || expanded || !collapsible;

  useEffect(() => {
    if (!streaming) return;
    if (!shouldFollowTailRef.current) return;
    const el = preRef.current;
    if (!el) return;
    const frame = window.requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [streaming, text]);

  return (
    <div className={className}>
      <pre
        ref={preRef}
        className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-[var(--fg-secondary)]"
        onScroll={(event) => {
          const el = event.currentTarget;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          shouldFollowTailRef.current = distanceToBottom < 24;
        }}
      >
        {showFull ? text : preview}
        {streaming ? (
          <span className="mt-1 block text-[var(--accent)]">{streamingLabel}</span>
        ) : null}
      </pre>
      {completeLabel && !streaming && text ? (
        <TimelineCompleteRow label={completeLabel} />
      ) : null}
      {collapsible && !streaming ? (
        <button
          type="button"
          className="mt-1.5 text-xs text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-secondary)]"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "收起" : "展开"}
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useOpenFileAt } from "@/hooks/useOpenFileAt";
import { INLINE_FILE_REF_RE } from "@/lib/file-path-resolve";

type Segment =
  | { type: "text"; value: string }
  | { type: "file"; path: string; line?: number; endLine?: number };

function splitInlineFileRefs(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  const re = new RegExp(INLINE_FILE_REF_RE.source, INLINE_FILE_REF_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      segments.push({ type: "text", value: text.slice(last, m.index) });
    }
    const path = m[2]!;
    const line = m[3] ? Number.parseInt(m[3], 10) : undefined;
    const endLine = m[4] ? Number.parseInt(m[4], 10) : undefined;
    segments.push({
      type: "file",
      path,
      line: Number.isFinite(line) ? line : undefined,
      endLine: Number.isFinite(endLine) ? endLine : undefined,
    });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: "text", value: text.slice(last) });
  }
  return segments.length ? segments : [{ type: "text", value: text }];
}

export function InlinePathText({ text }: { text: string }) {
  const { openFileAt } = useOpenFileAt();
  const segments = useMemo(() => splitInlineFileRefs(text), [text]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "text" ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <button
            key={i}
            type="button"
            className="inline text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2 hover:decoration-[var(--accent)]"
            onClick={() =>
              openFileAt({
                path: seg.path,
                line: seg.line,
                endLine: seg.endLine,
              })
            }
            title={seg.path}
          >
            {seg.path}
            {seg.line != null &&
              ` (line ${seg.line}${seg.endLine != null ? `–${seg.endLine}` : ""})`}
          </button>
        ),
      )}
    </>
  );
}

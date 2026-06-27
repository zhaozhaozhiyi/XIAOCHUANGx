"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { trackUnknownPartKind } from "@/lib/chat-part-telemetry";
import { useEffect } from "react";

const seen = new Set<string>();

export function UnsupportedPartCard({
  part,
  presentation,
}: {
  part: ChatPart;
  presentation: "default" | "timeline";
}) {
  useEffect(() => {
    const key = `${part.id}:${presentation}`;
    if (seen.has(key)) return;
    seen.add(key);
    trackUnknownPartKind({
      kind: part.kind,
      zone: part.zone,
      partId: part.id,
      presentation,
    });
  }, [part.id, part.kind, part.zone, presentation]);

  return (
    <div className="my-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-2 text-xs text-[var(--fg-tertiary)]">
      当前版本暂不支持该内容的完整展示，我们已记录并将尽快支持。
    </div>
  );
}

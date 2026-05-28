"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { ExternalLink } from "lucide-react";

type CitationPart = Extract<ChatPart, { kind: "citation" }>;

export function CitationPartCard({ part }: { part: CitationPart }) {
  return (
    <div className="my-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
      <p className="text-[11px] text-[var(--fg-tertiary)]">引用来源</p>
      <p className="mt-0.5 font-medium text-[var(--fg)]">{part.title}</p>
      <p className="mt-0.5 text-xs text-[var(--fg-tertiary)]">{part.source}</p>
      {part.snippet ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--fg-secondary)] line-clamp-3">
          {part.snippet}
        </p>
      ) : null}
      {part.url ? (
        <a
          href={part.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
        >
          打开来源
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

"use client";

import type { ChatPart } from "@/lib/chat-parts";

type ImagePart = Extract<ChatPart, { kind: "image" }>;

export function ImagePartCard({ part }: { part: ImagePart }) {
  return (
    <figure className="my-1 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-2">
      <a href={part.src} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={part.src}
          alt={part.alt ?? "图片"}
          className="max-h-[360px] w-full rounded-[var(--radius-sm)] object-contain"
          loading="lazy"
        />
      </a>
      {part.alt ? (
        <figcaption className="mt-1 text-xs text-[var(--fg-tertiary)]">
          {part.alt}
        </figcaption>
      ) : null}
    </figure>
  );
}

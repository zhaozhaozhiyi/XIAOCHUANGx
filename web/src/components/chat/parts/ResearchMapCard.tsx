"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { MermaidDiagram } from "@/components/chat/parts/MermaidDiagram";

type ResearchMapPart = Extract<ChatPart, { kind: "research_map" }>;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[无法序列化 payload]";
  }
}

function extractMermaidSource(payload: unknown): string | null {
  if (typeof payload === "string") {
    const text = payload.trim();
    return text.length > 0 ? text : null;
  }
  if (!payload || typeof payload !== "object") return null;

  const candidateKeys = ["mermaid", "code", "source", "diagram", "content"] as const;
  for (const key of candidateKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function ResearchMapCard({ part }: { part: ResearchMapPart }) {
  const source = extractMermaidSource(part.payload);

  return (
    <div className="my-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="mb-2 text-[11px] font-medium text-[var(--fg-tertiary)]">
        研究导图
      </p>
      {source ? (
        <MermaidDiagram
          source={source}
          sourceType="research_map"
          partId={part.id}
        />
      ) : (
        <div className="rounded-[var(--radius-sm)] border border-[var(--border)]/70 bg-[var(--surface)]/80 px-2 py-1.5">
          <p className="text-xs text-[var(--warn)]">
            未识别到 Mermaid 源，已展示原始结构化数据。
          </p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-[var(--fg-secondary)]">
            {safeStringify(part.payload)}
          </pre>
        </div>
      )}
    </div>
  );
}

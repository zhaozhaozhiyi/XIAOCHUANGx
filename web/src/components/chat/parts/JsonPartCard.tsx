"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";

type JsonPart = Extract<ChatPart, { kind: "json" }>;

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[无法序列化 JSON]";
  }
}

function renderJsonLine(line: string, keyPrefix: string) {
  const tokenRegex =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let idx = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={`${keyPrefix}-plain-${idx}`}>
          {line.slice(last, match.index)}
        </Fragment>,
      );
    }

    const token = match[0];
    const isKey = !!match[2];
    const isString = !!match[1];
    const isKeyword = !!match[3];
    const cls = isKey
      ? "text-sky-600"
      : isString
        ? "text-emerald-600"
        : isKeyword
          ? "text-violet-600"
          : "text-amber-600";

    nodes.push(
      <span key={`${keyPrefix}-token-${idx}`} className={cls}>
        {token}
      </span>,
    );

    last = tokenRegex.lastIndex;
    idx += 1;
  }

  if (last < line.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{line.slice(last)}</Fragment>,
    );
  }
  return nodes;
}

export function JsonPartCard({ part }: { part: JsonPart }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const jsonText = useMemo(() => safeStringify(part.value), [part.value]);
  const jsonLines = useMemo(() => jsonText.split("\n"), [jsonText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="my-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs font-medium text-[var(--fg-secondary)]"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {part.label?.trim() || "结构化数据"}
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
              onClick={() => void handleCopy()}
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--surface)_90%,var(--sidebar-hover))] px-2 py-1.5 font-mono text-xs text-[var(--fg-secondary)]">
            {jsonLines.map((line, idx) => (
              <div key={`json-line-${idx}`}>{renderJsonLine(line, `line-${idx}`)}</div>
            ))}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

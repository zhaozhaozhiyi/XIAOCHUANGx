"use client";

import { useEffect, useRef, useState } from "react";
import { formatUserPrompt } from "@/lib/terminal";
import { useTerminal } from "./TerminalContext";

function LineRow({ kind, text }: { kind: string; text: string }) {
  if (kind === "stderr") {
    return <span className="block text-[#c41e3a]">{text}</span>;
  }
  if (kind === "system") {
    return <span className="block text-[var(--fg-tertiary)]">{text}</span>;
  }
  if (kind === "prompt") {
    return <span className="block whitespace-pre-wrap break-words">{text}</span>;
  }
  return <span className="block whitespace-pre-wrap break-words">{text}</span>;
}

function BlockCursor() {
  return (
    <span
      className="inline-block h-[14px] w-[7px] shrink-0 bg-[#1a1a1a] animate-pulse"
      aria-hidden
    />
  );
}

export function TerminalView() {
  const { activeSession, runCommand } = useTerminal();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!activeSession) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-xs text-[var(--fg-tertiary)]">
        暂无终端会话
      </div>
    );
  }

  const isUser = activeSession.group === "user";
  const editable = isUser && !activeSession.readOnly;
  const showAgentBanner = activeSession.readOnly && activeSession.agentUsing;

  const historyLines = editable
    ? activeSession.lines.filter((ln) => ln.kind !== "prompt")
    : activeSession.lines.slice(0, -1).filter((ln) => ln.kind !== "prompt");

  const trailingPrompt = [...activeSession.lines]
    .reverse()
    .find((ln) => ln.kind === "prompt");

  const promptText = isUser
    ? trailingPrompt?.text ?? formatUserPrompt(activeSession.cwd)
    : (trailingPrompt?.text ?? "$ ");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeSession.lines, activeSession.id]);

  useEffect(() => {
    setInput("");
    if (editable) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [activeSession.id, editable]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white text-[#1a1a1a]">
      {showAgentBanner && (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[11px] text-[var(--fg-secondary)]">
          Agent is using this terminal. It&apos;s read-only.
        </div>
      )}

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed"
        onClick={() => {
          if (editable) inputRef.current?.focus();
        }}
      >
        {historyLines.map((ln, i) => (
          <LineRow key={`${activeSession.id}-h-${i}`} kind={ln.kind} text={ln.text} />
        ))}

        <div className="mt-1 flex flex-wrap items-baseline gap-0">
          {editable ? (
            <>
              <span className="whitespace-pre text-[#1a1a1a]">{promptText}</span>
              <span className="inline-flex min-w-[8ch] items-baseline">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!input.trim()) return;
                      runCommand(input);
                      setInput("");
                    }
                  }}
                  className="min-w-[4ch] flex-1 border-0 bg-transparent p-0 font-mono text-[12px] text-[#1a1a1a] outline-none caret-transparent"
                  spellCheck={false}
                  autoComplete="off"
                  aria-label="终端命令"
                />
                <BlockCursor />
              </span>
            </>
          ) : (
            <span className="inline-flex items-baseline whitespace-pre-wrap">
              <span>{promptText}</span>
              <BlockCursor />
            </span>
          )}
        </div>

        <div ref={bottomRef} className="h-2" aria-hidden />
      </div>
    </div>
  );
}

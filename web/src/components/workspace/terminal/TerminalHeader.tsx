"use client";

import { List } from "lucide-react";
import { useTerminal } from "./TerminalContext";

export function TerminalHeader() {
  const { activeSession, sessionListOpen, toggleSessionList } = useTerminal();
  const title = !activeSession
    ? "终端"
    : activeSession.group === "agent-other" || activeSession.group === "agent"
      ? activeSession.title.split(" (")[0] ?? activeSession.title
      : activeSession.title;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
      <button
        type="button"
        className={`btn-icon h-7 w-7 shrink-0 ${
          sessionListOpen
            ? "bg-[var(--sidebar-hover)] text-[var(--fg)]"
            : "text-[var(--fg-secondary)]"
        }`}
        onClick={toggleSessionList}
        aria-label={sessionListOpen ? "收起终端列表" : "展开终端列表"}
        title={sessionListOpen ? "收起终端列表" : "展开终端列表"}
        aria-pressed={sessionListOpen}
      >
        <List className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--fg)]">
        {title}
      </span>
    </div>
  );
}

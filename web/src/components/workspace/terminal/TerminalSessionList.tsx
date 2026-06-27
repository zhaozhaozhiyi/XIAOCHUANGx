"use client";

import { Infinity, Plus, SquareTerminal, X } from "lucide-react";
import {
  parseAgentSessionTitle,
  type TerminalSession,
  type TerminalSessionGroup,
} from "@/lib/terminal";
import { useTerminal } from "./TerminalContext";

function UserSessionRow({
  session,
  active,
  canClose,
  onSelect,
  onClose,
}: {
  session: TerminalSession;
  active: boolean;
  canClose: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <li>
      <div
        className={`group flex items-center gap-0.5 pr-1 ${
          active ? "bg-[var(--sidebar-hover)]" : "hover:bg-[var(--sidebar-hover)]/60"
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[12px] text-[var(--fg)]"
          title={session.title}
        >
          <SquareTerminal
            className="h-3.5 w-3.5 shrink-0 text-[var(--fg-tertiary)]"
            strokeWidth={1.75}
          />
          <span className="truncate">{session.title}</span>
        </button>
        {canClose && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--fg-secondary)] opacity-0 transition-[opacity,background-color,box-shadow,color] group-hover:opacity-100 hover:bg-white hover:text-[var(--fg)] hover:shadow-[var(--shadow-ring)]"
            aria-label="关闭终端"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    </li>
  );
}

function AgentSessionRow({
  session,
  active,
  onSelect,
  onClose,
}: {
  session: TerminalSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const { agent, preview } = parseAgentSessionTitle(session.title);
  const commandPreview = session.commandPreview ?? preview;

  return (
    <li>
      <div
        className={`group flex items-start gap-0.5 pr-1 ${
          active ? "bg-[var(--sidebar-hover)]" : "hover:bg-[var(--sidebar-hover)]/60"
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1.5 text-left"
          title={session.title}
        >
          <Infinity
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
            strokeWidth={2}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-accent">
              {agent}
            </span>
            {commandPreview && (
              <span className="mt-0.5 block truncate font-mono text-[10px] text-accent/75">
                {commandPreview}
              </span>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="mt-1.5 mr-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--fg-secondary)] opacity-0 transition-[opacity,background-color,box-shadow,color] group-hover:opacity-100 hover:bg-white hover:text-[var(--fg)] hover:shadow-[var(--shadow-ring)]"
          aria-label="删除 Agent 终端"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
    </li>
  );
}

export function TerminalSessionList() {
  const {
    groups,
    activeId,
    userTerminalCount,
    selectSession,
    createSession,
    closeSession,
  } = useTerminal();

  return (
    <aside
      className="flex h-full w-[min(42%,220px)] min-w-[160px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]"
      aria-label="终端会话"
    >
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {groups.map(({ group, label, sessions }) => (
          <TerminalGroupSection
            key={group}
            group={group}
            label={label}
            sessions={sessions}
            activeId={activeId}
            userTerminalCount={userTerminalCount}
            onSelect={selectSession}
            onCreate={createSession}
            onClose={closeSession}
          />
        ))}
      </div>
    </aside>
  );
}

function TerminalGroupSection({
  group,
  label,
  sessions,
  activeId,
  userTerminalCount,
  onSelect,
  onCreate,
  onClose,
}: {
  group: TerminalSessionGroup;
  label: string;
  sessions: TerminalSession[];
  activeId: string;
  userTerminalCount: number;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClose: (id: string) => void;
}) {
  const isUser = group === "user";
  const headerLabel = isUser ? `${userTerminalCount} ${label}` : label;

  return (
    <div className="mb-1">
      <div className="flex shrink-0 items-center justify-between px-2 py-1.5">
        <span className="text-[11px] font-medium text-[var(--fg-secondary)]">
          {headerLabel}
        </span>
        {isUser && (
          <button
            type="button"
            onClick={onCreate}
            className="btn-icon h-7 w-7 text-[var(--fg-tertiary)]"
            aria-label="新建终端"
            title="新建终端"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <ul>
        {sessions.map((session) => {
          const active = session.id === activeId;
          if (isUser) {
            return (
              <UserSessionRow
                key={session.id}
                session={session}
                active={active}
                canClose={userTerminalCount > 1}
                onSelect={() => onSelect(session.id)}
                onClose={() => onClose(session.id)}
              />
            );
          }
          return (
            <AgentSessionRow
              key={session.id}
              session={session}
              active={active}
              onSelect={() => onSelect(session.id)}
              onClose={() => onClose(session.id)}
            />
          );
        })}
      </ul>
    </div>
  );
}

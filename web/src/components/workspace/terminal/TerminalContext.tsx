"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  TERMINAL_GROUP_LABEL,
  TERMINAL_SIDEBAR_GROUPS,
  createUserSession,
  formatUserPrompt,
  mockExecuteCommand,
  type TerminalLine,
  type TerminalSession,
  type TerminalSessionGroup,
} from "@/lib/terminal";

type TerminalContextValue = {
  sessions: TerminalSession[];
  activeId: string;
  activeSession: TerminalSession | null;
  groups: { group: TerminalSessionGroup; label: string; sessions: TerminalSession[] }[];
  userTerminalCount: number;
  sessionListOpen: boolean;
  toggleSessionList: () => void;
  selectSession: (id: string) => void;
  createSession: () => string;
  closeSession: (id: string) => void;
  appendLines: (id: string, lines: TerminalLine[]) => void;
  runCommand: (command: string) => void;
};

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider({
  children,
  initialSessions = [],
}: {
  children: ReactNode;
  initialSessions?: TerminalSession[];
}) {
  const [sessions, setSessions] = useState<TerminalSession[]>(initialSessions);
  const [activeId, setActiveId] = useState(
    () => initialSessions.find((s) => s.group === "user")?.id ?? initialSessions[0]?.id ?? "",
  );
  const [sessionListOpen, setSessionListOpen] = useState(false);

  const activeSession = useMemo(
    () =>
      sessions.find((s) => s.id === activeId) ??
      sessions.find((s) => s.group === "user") ??
      sessions[0] ??
      null,
    [sessions, activeId],
  );

  const groups = useMemo(
    () =>
      TERMINAL_SIDEBAR_GROUPS.map((group) => ({
        group,
        label: TERMINAL_GROUP_LABEL[group],
        sessions: sessions.filter((s) => s.group === group),
      })).filter((g) => g.sessions.length > 0),
    [sessions],
  );

  const userTerminalCount = sessions.filter((s) => s.group === "user").length;

  const toggleSessionList = useCallback(() => {
    setSessionListOpen((open) => !open);
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const createSession = useCallback(() => {
    const next = createUserSession();
    setSessions((prev) => [...prev, next]);
    setActiveId(next.id);
    return next.id;
  }, []);

  const closeSession = useCallback((id: string) => {
    setSessions((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) return prev;
      if (target.group === "user" && prev.filter((s) => s.group === "user").length <= 1) {
        return prev;
      }
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) return prev;
      setActiveId((aid) => {
        if (aid !== id) return aid;
        return next.find((s) => s.group === "user")?.id ?? next[0]?.id ?? aid;
      });
      return next;
    });
  }, []);

  const appendLines = useCallback((id: string, lines: TerminalLine[]) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, lines: [...s.lines, ...lines] } : s)),
    );
  }, []);

  const runCommand = useCallback(
    (command: string) => {
      const session = sessions.find((s) => s.id === activeId);
      if (!session || session.readOnly || !activeId) return;

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
          const withoutTrailingPrompt =
            s.lines.length > 0 && s.lines[s.lines.length - 1].kind === "prompt"
              ? s.lines.slice(0, -1)
              : s.lines;
          const result = mockExecuteCommand(command, s.cwd);
          const echoed: TerminalLine = {
            kind: "stdout",
            text: `${formatUserPrompt(s.cwd)} ${command}`,
          };
          return {
            ...s,
            cwd: result.cwd ?? s.cwd,
            lines: [...withoutTrailingPrompt, echoed, ...result.lines],
          };
        }),
      );
    },
    [activeId, sessions],
  );

  const value = useMemo(
    () => ({
      sessions,
      activeId,
      activeSession,
      groups,
      userTerminalCount,
      sessionListOpen,
      toggleSessionList,
      selectSession,
      createSession,
      closeSession,
      appendLines,
      runCommand,
    }),
    [
      sessions,
      activeId,
      activeSession,
      groups,
      userTerminalCount,
      sessionListOpen,
      toggleSessionList,
      selectSession,
      createSession,
      closeSession,
      appendLines,
      runCommand,
    ],
  );

  return (
    <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
  );
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error("useTerminal must be used within TerminalProvider");
  return ctx;
}

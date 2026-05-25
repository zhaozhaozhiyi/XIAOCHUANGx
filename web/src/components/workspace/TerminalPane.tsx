"use client";

import { useEffect } from "react";
import { TerminalHeader } from "./terminal/TerminalHeader";
import { TerminalSessionList } from "./terminal/TerminalSessionList";
import { TerminalView } from "./terminal/TerminalView";
import { useTerminal } from "./terminal/TerminalContext";

type TerminalPaneProps = {
  sessionId: string;
};

export function TerminalPane({ sessionId }: TerminalPaneProps) {
  const { selectSession, sessionListOpen } = useTerminal();

  useEffect(() => {
    selectSession(sessionId);
  }, [sessionId, selectSession]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <TerminalHeader />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {sessionListOpen && <TerminalSessionList />}
        <TerminalView />
      </div>
    </div>
  );
}

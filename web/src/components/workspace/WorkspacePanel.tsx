"use client";

import { useMemo } from "react";
import { buildTerminalSessionsFromTabs } from "@/lib/terminal";
import { ActivityLogPane } from "./ActivityLogPane";
import { BrowserPane } from "./BrowserPane";
import { FilesWorkspacePane } from "./FilesWorkspacePane";
import { TerminalBridge } from "./TerminalBridge";
import { TerminalPane } from "./TerminalPane";
import { TerminalProvider } from "./terminal/TerminalContext";
import { WorkspaceEmptyState } from "./WorkspaceEmptyState";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { useWorkspace } from "./WorkspaceContext";

export function WorkspacePanel() {
  const { open, activeTab, openTabs, panelWidth, hasTabs, sessionKey } =
    useWorkspace();

  const terminalSessions = useMemo(
    () => buildTerminalSessionsFromTabs(openTabs),
    [openTabs],
  );

  if (!open) return null;

  return (
    <aside
      style={{ width: panelWidth }}
      className="flex h-full shrink-0 flex-col border-l border-[var(--border)] bg-[var(--surface)]"
      aria-label="工作区"
    >
      <TerminalProvider key={sessionKey} initialSessions={terminalSessions}>
        {hasTabs && <WorkspaceTabBar />}
        <TerminalBridge />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {!hasTabs ? (
            <WorkspaceEmptyState />
          ) : (
            openTabs.map((tab) => {
              const visible = tab.id === activeTab?.id;
              return (
                <div
                  key={tab.id}
                  className={
                    visible
                      ? "relative z-10 flex min-h-0 flex-1 flex-col"
                      : "pointer-events-none absolute inset-0 z-0 flex min-h-0 flex-1 flex-col opacity-0"
                  }
                  aria-hidden={!visible}
                >
                  {(tab.kind === "file" || tab.kind === "explorer") && (
                    <FilesWorkspacePane />
                  )}
                  {tab.kind === "terminal" && (
                    <TerminalPane sessionId={tab.sessionId} />
                  )}
                  {tab.kind === "browser" && <BrowserPane tabId={tab.id} />}
                  {tab.kind === "activity-log" && <ActivityLogPane />}
                </div>
              );
            })
          )}
        </div>
      </TerminalProvider>
    </aside>
  );
}

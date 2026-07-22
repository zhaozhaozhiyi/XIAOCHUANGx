"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { SidebarLayoutProvider } from "./SidebarLayoutContext";
import { WorkspacePanel } from "@/components/workspace/WorkspacePanel";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/WorkspaceContext";
import { WorkspaceProjectProvider } from "@/components/workspace/WorkspaceProjectContext";
import { ResearchProjectsProvider } from "@/contexts/ResearchProjectsContext";
import { ChatSessionProvider } from "@/contexts/ChatSessionContext";
import { WorkspaceResizeHandle } from "@/components/workspace/WorkspaceResizeHandle";
import { AuthHydrator } from "@/components/auth/AuthHydrator";
import { SettingsDrawer } from "@/components/settings/SettingsDrawer";
import { SettingsProvider } from "@/components/settings/SettingsContext";
import { WorkspaceRouteSync } from "@/components/workspace/WorkspaceRouteSync";
import { WorkspaceTopRightControls } from "@/components/workspace/WorkspaceTopRightControls";

type AppShellFrameProps = {
  children: React.ReactNode;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
};

function AppShellFrame({
  children,
  sidebarCollapsed,
  onSidebarCollapsedChange,
}: AppShellFrameProps) {
  const { open } = useWorkspace();

  // 桌面壳标题栏由 root layout 统一渲染（src/app/layout.tsx），AppShell 不重复挂载
  return (
    <div className="flex h-full overflow-hidden bg-[var(--background)]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => onSidebarCollapsedChange(!sidebarCollapsed)}
      />
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <SidebarLayoutProvider collapsed={sidebarCollapsed}>
          {children}
        </SidebarLayoutProvider>
      </main>
      <WorkspaceTopRightControls />
      <SettingsDrawer />
      {open && (
        <>
          <WorkspaceResizeHandle sidebarCollapsed={sidebarCollapsed} />
          <WorkspacePanel />
        </>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const syncSidebar = () => setSidebarCollapsed(media.matches);
    syncSidebar();
    media.addEventListener("change", syncSidebar);
    return () => media.removeEventListener("change", syncSidebar);
  }, []);

  return (
    <SettingsProvider>
      <AuthHydrator />
      <ResearchProjectsProvider>
        <ChatSessionProvider>
        <WorkspaceProjectProvider>
        <WorkspaceProvider sidebarCollapsed={sidebarCollapsed}>
          <WorkspaceRouteSync />
          <AppShellFrame
            sidebarCollapsed={sidebarCollapsed}
            onSidebarCollapsedChange={setSidebarCollapsed}
          >
            {children}
          </AppShellFrame>
        </WorkspaceProvider>
        </WorkspaceProjectProvider>
        </ChatSessionProvider>
      </ResearchProjectsProvider>
    </SettingsProvider>
  );
}

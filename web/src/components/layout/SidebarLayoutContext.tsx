"use client";

import { createContext, useContext, type ReactNode } from "react";

const SidebarLayoutContext = createContext(false);

export function SidebarLayoutProvider({
  collapsed,
  children,
}: {
  collapsed: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarLayoutContext.Provider value={collapsed}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarCollapsed() {
  return useContext(SidebarLayoutContext);
}

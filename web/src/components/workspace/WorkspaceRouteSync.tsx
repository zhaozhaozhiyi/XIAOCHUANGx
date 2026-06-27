"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getWorkspaceSessionKey } from "@/lib/workspace-session-cache";
import { useWorkspace } from "./WorkspaceContext";

/** 按路由同步工作区会话键，用于 Tab 缓存的加载/保存 */
export function WorkspaceRouteSync() {
  const pathname = usePathname();
  const { setSessionKey } = useWorkspace();

  useEffect(() => {
    setSessionKey(getWorkspaceSessionKey(pathname));
  }, [pathname, setSessionKey]);

  return null;
}

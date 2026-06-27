"use client";

import { useEffect } from "react";
import { useWorkspace } from "./WorkspaceContext";
import { useTerminal } from "./terminal/TerminalContext";

/** 将终端会话 API 注册到工作区，供页签栏新建/关闭/切换终端 */
export function TerminalBridge() {
  const { registerTerminalApi } = useWorkspace();
  const {
    sessions,
    createSession,
    closeSession,
    selectSession,
  } = useTerminal();

  useEffect(() => {
    registerTerminalApi({
      createSession,
      closeSession,
      selectSession,
      getSessionTitle: (id) =>
        sessions.find((s) => s.id === id)?.title ?? "zsh",
    });
    return () => registerTerminalApi(null);
  }, [
    registerTerminalApi,
    createSession,
    closeSession,
    selectSession,
    sessions,
  ]);

  return null;
}

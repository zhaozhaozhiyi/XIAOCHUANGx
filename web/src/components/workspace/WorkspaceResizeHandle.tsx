"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  WORKSPACE_WIDTH_KEY,
  WORKSPACE_WIDTH_MIN,
  clampWorkspaceWidth,
  getDefaultWorkspaceWidth,
  getWorkspaceWidthMax,
} from "@/lib/workspace";
import { useWorkspace } from "./WorkspaceContext";

type WorkspaceResizeHandleProps = {
  sidebarCollapsed: boolean;
};

export function WorkspaceResizeHandle({
  sidebarCollapsed,
}: WorkspaceResizeHandleProps) {
  const { panelWidth, setPanelWidth } = useWorkspace();
  const widthMax = getWorkspaceWidthMax(sidebarCollapsed);
  const draggingRef = useRef(false);

  const persistWidth = useCallback((width: number) => {
    try {
      localStorage.setItem(WORKSPACE_WIDTH_KEY, String(width));
    } catch {
      /* ignore quota / private mode */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = clampWorkspaceWidth(
        window.innerWidth - e.clientX,
        sidebarCollapsed,
      );
      setPanelWidth(next);
    };

    const onUp = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      persistWidth(
        clampWorkspaceWidth(window.innerWidth - e.clientX, sidebarCollapsed),
      );
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [persistWidth, setPanelWidth, sidebarCollapsed]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const onDoubleClick = () => {
    const width = getDefaultWorkspaceWidth(
      sidebarCollapsed,
      window.innerWidth,
    );
    setPanelWidth(width);
    persistWidth(width);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整工作区宽度"
      aria-valuenow={panelWidth}
      aria-valuemin={WORKSPACE_WIDTH_MIN}
      aria-valuemax={widthMax}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="拖拽调整宽度，双击恢复最大宽度"
      className="group relative z-10 w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-[var(--accent-muted)]"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1 -right-1" />
      <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--border)] transition-colors group-hover:bg-[var(--accent)] group-active:bg-[var(--accent)]" />
    </div>
  );
}

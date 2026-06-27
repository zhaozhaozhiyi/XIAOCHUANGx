"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  WORKSPACE_TREE_WIDTH_DEFAULT,
  WORKSPACE_TREE_WIDTH_KEY,
  clampWorkspaceTreeWidth,
} from "@/lib/workspace";
import { useWorkspace } from "./WorkspaceContext";

export function FileTreePaneResizeHandle() {
  const { treePaneWidth, setTreePaneWidth } = useWorkspace();
  const draggingRef = useRef(false);

  const persist = useCallback((w: number) => {
    try {
      localStorage.setItem(WORKSPACE_TREE_WIDTH_KEY, String(w));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const host = document.getElementById("workspace-files-split");
      if (!host) return;
      const rect = host.getBoundingClientRect();
      setTreePaneWidth(clampWorkspaceTreeWidth(e.clientX - rect.left, rect.width));
    };

    const onUp = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const host = document.getElementById("workspace-files-split");
      if (host) {
        const rect = host.getBoundingClientRect();
        persist(clampWorkspaceTreeWidth(e.clientX - rect.left, rect.width));
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [persist, setTreePaneWidth]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="调整目录树宽度"
      onMouseDown={(e) => {
        e.preventDefault();
        draggingRef.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onDoubleClick={() => {
        setTreePaneWidth(WORKSPACE_TREE_WIDTH_DEFAULT);
        persist(WORKSPACE_TREE_WIDTH_DEFAULT);
      }}
      className="group relative z-10 w-1 shrink-0 cursor-col-resize hover:bg-[var(--accent-muted)]"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-px bg-[var(--border)] group-hover:bg-[var(--accent)]" />
    </div>
  );
}

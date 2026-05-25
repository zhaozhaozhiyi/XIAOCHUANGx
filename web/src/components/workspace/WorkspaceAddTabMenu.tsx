"use client";

import { useEffect, useRef, useState } from "react";
import { FolderTree, Globe, Plus, SquareTerminal } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";

type Props = {
  className?: string;
};

export function WorkspaceAddTabMenu({ className = "" }: Props) {
  const { openTerminalTab, openBrowserTab, openExplorerTab } = useWorkspace();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const pick = (action: () => void) => {
    action();
    setMenuOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className="btn-icon"
        aria-label="新建页签"
        aria-expanded={menuOpen}
        title="新建页签"
        onClick={() => setMenuOpen((v) => !v)}
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {menuOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[var(--shadow-whisper)]"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
            onClick={() => pick(() => openTerminalTab())}
          >
            <SquareTerminal className="h-3.5 w-3.5" strokeWidth={1.75} />
            终端
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
            onClick={() => pick(() => openBrowserTab())}
          >
            <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
            网页预览
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--sidebar-hover)]"
            onClick={() => pick(() => openExplorerTab())}
          >
            <FolderTree className="h-3.5 w-3.5" strokeWidth={1.75} />
            文件
          </button>
        </div>
      )}
    </div>
  );
}

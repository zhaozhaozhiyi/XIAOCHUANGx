"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileCode2, FolderTree, Globe, SquareTerminal, X } from "lucide-react";
import { MAIN_TOP_BAR_CLASS } from "@/components/layout/SidebarExpandButton";
import {
  findFileNodeInRoot,
  getBrowserTabLabel,
  getFileTabLabel,
  getTerminalTabLabel,
  type WorkspaceEditorTab,
} from "@/lib/workspace-tabs";
import { WORKSPACE_TAB_BAR_RIGHT_PADDING } from "./WorkspaceTopRightControls";
import { useWorkspace } from "./WorkspaceContext";
import { useWorkspaceProject } from "./WorkspaceProjectContext";
import { useTerminal } from "./terminal/TerminalContext";

const TAB_ICONS = {
  file: FileCode2,
  explorer: FolderTree,
  terminal: SquareTerminal,
  browser: Globe,
} as const;

function useTabLabel(tab: WorkspaceEditorTab): string {
  const { sessions } = useTerminal();
  const { root } = useWorkspace();
  const { projectLabel } = useWorkspaceProject();

  if (tab.kind === "file") {
    return getFileTabLabel(findFileNodeInRoot(root, tab.fileId));
  }
  if (tab.kind === "explorer") {
    const name = projectLabel.trim() || root.name?.trim() || "";
    return name === "原型" ? "" : name;
  }
  if (tab.kind === "browser") {
    const url = tab.url || "新预览";
    return url ? getBrowserTabLabel(url) : "网页预览";
  }
  const session = sessions.find((s) => s.id === tab.sessionId);
  return getTerminalTabLabel(session?.title ?? "zsh");
}

function EditorTabButton({
  tab,
  active,
  onSelect,
  onClose,
}: {
  tab: WorkspaceEditorTab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const label = useTabLabel(tab);
  const showLabel = label.length > 0;
  const Icon = TAB_ICONS[tab.kind];
  const canClose =
    tab.kind !== "terminal" || !tab.sessionId.startsWith("agent");
  const tabTitle =
    showLabel || tab.kind !== "explorer"
      ? label || (tab.kind === "file" ? "未命名" : "页签")
      : "项目目录";

  return (
    <div
      className={`group flex h-8 shrink-0 items-center overflow-hidden rounded-md border text-xs transition-colors ${
        showLabel ? "max-w-[220px]" : "max-w-none"
      } ${
        active
          ? "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--fg)]"
          : "border-transparent text-[var(--fg-secondary)] hover:border-[var(--border)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className={`flex min-w-0 flex-1 items-center ${showLabel ? "gap-1.5 px-2" : "px-1.5"} py-1`}
        title={tabTitle}
        aria-selected={active}
        aria-label={tabTitle}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        {showLabel ? <span className="truncate">{label}</span> : null}
      </button>
      {canClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-7 w-0 shrink-0 items-center justify-center overflow-hidden rounded-md text-[var(--fg-secondary)] opacity-0 transition-[width,opacity] duration-150 ease-out group-hover:w-7 group-hover:opacity-100 hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
          aria-label={`关闭 ${tabTitle}`}
        >
          <X className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function TabBarTabs() {
  const { openTabs, activeTabId, setActiveTabId, closeTab } = useWorkspace();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);

  const updateScrollFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth - clientWidth > 2;
    setFadeLeft(overflow && scrollLeft > 2);
    setFadeRight(overflow && scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollFades();

    const onScroll = () => updateScrollFades();
    el.addEventListener("scroll", onScroll, { passive: true });

    /** 触控板/鼠标纵滚 → 横向滑动页签（仅隐藏滚动条时需主动转换） */
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 2) return;
      const next = el.scrollLeft + e.deltaY;
      const clamped = Math.max(0, Math.min(maxScroll, next));
      if (clamped === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = clamped;
      updateScrollFades();
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => updateScrollFades());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [openTabs.length, updateScrollFades]);

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[aria-selected="true"]');
    el?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    requestAnimationFrame(() => updateScrollFades());
  }, [activeTabId, openTabs.length, updateScrollFades]);

  return (
    <div className="workspace-tab-strip">
      {fadeLeft && <div className="workspace-tab-fade workspace-tab-fade-left" aria-hidden />}
      <div
        ref={scrollRef}
        className="workspace-tab-scroll h-full min-w-0 overflow-x-auto overflow-y-hidden"
        role="tablist"
        aria-label="工作区页签"
      >
        <div className="flex h-full w-max items-center gap-1 py-0.5 pr-0.5">
          {openTabs.map((tab) => (
            <EditorTabButton
              key={tab.id}
              tab={tab}
              active={tab.id === activeTabId}
              onSelect={() => setActiveTabId(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>
      </div>
      {fadeRight && <div className="workspace-tab-fade workspace-tab-fade-right" aria-hidden />}
    </div>
  );
}

export function WorkspaceTabBar() {
  return (
    <div
      className={`flex ${MAIN_TOP_BAR_CLASS} shrink-0 items-center gap-1 border-b border-[var(--border)] bg-[var(--surface)] px-2 ${WORKSPACE_TAB_BAR_RIGHT_PADDING}`}
    >
      <TabBarTabs />
    </div>
  );
}

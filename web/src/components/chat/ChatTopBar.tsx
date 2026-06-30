"use client";

import { MAIN_TOP_BAR_CLASS } from "@/components/layout/SidebarExpandButton";

type ChatTopBarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  /** 侧栏收起时为展开按钮预留左侧空间 */
  sidebarCollapsed?: boolean;
};

/** 对话区顶栏：左/中/右三列，中间内容居中（如会话标题） */
export function ChatTopBar({
  left,
  center,
  right,
  sidebarCollapsed = false,
}: ChatTopBarProps) {
  return (
    <header
      className={`grid ${MAIN_TOP_BAR_CLASS} shrink-0 grid-cols-[minmax(9.5rem,1fr)_auto_minmax(6rem,1fr)] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] pr-6 ${
        sidebarCollapsed ? "pl-14" : "pl-4"
      }`}
    >
      <div className="flex min-w-0 items-center justify-start gap-2">{left}</div>
      <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center justify-center px-2">
        {center}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2">{right}</div>
    </header>
  );
}

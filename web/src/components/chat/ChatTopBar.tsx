"use client";

import { MAIN_TOP_BAR_CLASS } from "@/components/layout/SidebarExpandButton";

type ChatTopBarProps = {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
};

/** 对话区顶栏：左/中/右三列，中间内容居中（如会话标题） */
export function ChatTopBar({
  left,
  center,
  right,
}: ChatTopBarProps) {
  return (
    <header
      className={`grid ${MAIN_TOP_BAR_CLASS} shrink-0 grid-cols-[minmax(9.5rem,1fr)_auto_minmax(6rem,1fr)] items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] pl-4 pr-6`}
    >
      <div className="flex h-full min-w-0 items-center justify-start gap-2">
        {left}
        <div className="desktop-drag-region h-full min-w-4 flex-1" aria-hidden />
      </div>
      <div className="flex min-w-0 max-w-[min(100%,28rem)] items-center justify-center px-2">
        {center}
      </div>
      <div className="flex h-full min-w-0 items-center justify-end gap-2">
        <div className="desktop-drag-region h-full min-w-4 flex-1" aria-hidden />
        {right}
      </div>
    </header>
  );
}

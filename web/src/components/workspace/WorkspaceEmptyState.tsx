"use client";

import { Folder, Globe, ScrollText, SquareTerminal } from "lucide-react";
import { useWorkspace } from "./WorkspaceContext";

type ShortcutCardProps = {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
};

function ShortcutCard({ icon, title, subtitle, onClick }: ShortcutCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full min-w-0 @min-[22rem]:min-w-[calc(50%-0.3125rem)] @min-[22rem]:max-w-[calc(50%-0.3125rem)] @min-[22rem]:flex-1 @min-[32rem]:min-w-0 @min-[32rem]:max-w-none flex-col items-center gap-2.5 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--sidebar-hover)_55%,var(--surface))] px-3 py-5 text-center transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--sidebar-hover)] hover:shadow-[var(--shadow-whisper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--fg-secondary)] shadow-[var(--shadow-inset)] transition-colors group-hover:text-[var(--fg)]">
        {icon}
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--fg)]">{title}</span>
        <span className="text-xs leading-snug text-[var(--fg-tertiary)]">
          {subtitle}
        </span>
      </span>
    </button>
  );
}

export function WorkspaceEmptyState() {
  const {
    openExplorerTab,
    openBrowserTab,
    openTerminalTab,
    openActivityLogTab,
  } = useWorkspace();

  return (
    <div className="@container flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
      <div
        className="flex w-full max-w-[480px] flex-col gap-2.5 @min-[22rem]:flex-row @min-[22rem]:flex-wrap"
        role="group"
        aria-label="工作区快捷入口"
      >
        <ShortcutCard
          icon={<Folder className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          title="文件"
          subtitle="浏览项目文件"
          onClick={openExplorerTab}
        />
        <ShortcutCard
          icon={<Globe className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          title="浏览器"
          subtitle="打开网站"
          onClick={() => openBrowserTab()}
        />
        <ShortcutCard
          icon={
            <SquareTerminal className="h-[18px] w-[18px]" strokeWidth={1.75} />
          }
          title="终端"
          subtitle="启动交互式 shell"
          onClick={() => openTerminalTab()}
        />
        <ShortcutCard
          icon={<ScrollText className="h-[18px] w-[18px]" strokeWidth={1.75} />}
          title="记录"
          subtitle="查看运行记录"
          onClick={openActivityLogTab}
        />
      </div>
    </div>
  );
}

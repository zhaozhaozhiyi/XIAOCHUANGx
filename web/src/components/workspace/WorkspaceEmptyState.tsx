"use client";

import { Folder, Globe, SquareTerminal } from "lucide-react";
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
      className="group flex min-w-0 flex-1 flex-col items-center gap-2.5 rounded-xl border border-transparent bg-[color-mix(in_srgb,var(--sidebar-hover)_55%,var(--surface))] px-3 py-5 text-center transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[var(--sidebar-hover)] hover:shadow-[var(--shadow-whisper)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
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
  const { openExplorerTab, openBrowserTab, openTerminalTab } = useWorkspace();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-10">
      <div
        className="flex w-full max-w-[420px] flex-row gap-2.5"
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
      </div>
    </div>
  );
}

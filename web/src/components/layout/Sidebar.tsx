"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, Plus } from "lucide-react";
import { UserSettingsTrigger } from "@/components/settings/UserSettingsMenu";
import { ChatHistorySidebar } from "@/components/chat/ChatHistorySidebar";
import { BrandMark } from "@/components/brand/BrandMark";
import { NAV_MODULES } from "@/lib/navigation";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const isChatModule = pathname.startsWith("/chat");

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-200 ${
        collapsed ? "w-[56px]" : "w-[240px]"
      }`}
    >
      <SidebarHeader collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

      <div className={`px-2 pb-2 ${collapsed ? "flex justify-center" : ""}`}>
        <Link
          href="/chat"
          className={`btn btn-sidebar-new flex items-center justify-center gap-2 py-2 ${
            collapsed ? "h-9 w-9 px-0" : "w-full px-3"
          }`}
          title={collapsed ? "新对话" : undefined}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">新对话</span>
              <kbd className="hidden rounded border border-[var(--composer-border)] bg-white px-1.5 py-0.5 text-[10px] font-normal text-[var(--fg-tertiary)] sm:inline">
                ⌘ K
              </kbd>
            </>
          )}
        </Link>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col py-1">
        <ul className="shrink-0 space-y-0.5 px-2">
          {NAV_MODULES.map((mod) => {
            const active =
              pathname === mod.href || pathname.startsWith(`${mod.href}/`);
            const Icon = mod.icon;
            return (
              <li key={mod.id}>
                <Link
                  href={mod.subNav[0]?.href ?? mod.href}
                  title={collapsed ? mod.label : undefined}
                  className={`nav-item ${active ? "nav-item-active" : ""} ${
                    collapsed ? "justify-center px-2" : ""
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {!collapsed && <span className="truncate">{mod.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && isChatModule && (
          <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] pt-3">
            <div className="sidebar-history-scroll min-h-0 flex-1 overflow-y-auto">
              <div className="sidebar-history-scroll__inner">
                <ChatHistorySidebar />
              </div>
            </div>
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-[var(--border)] p-2">
        <UserSettingsTrigger collapsed={collapsed} />
      </div>
    </aside>
  );
}

function SidebarHeader({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  return (
    <div
      className={`flex h-14 items-center gap-2 px-3 ${collapsed ? "justify-center px-2" : "justify-between"}`}
    >
      {!collapsed ? (
        <>
          <Link href="/chat" className="flex items-center gap-2">
            <BrandMark />
            <span className="font-display text-sm tracking-tight text-[var(--fg)]">
              小窗
            </span>
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="btn-icon"
            aria-label="收起侧栏"
            title="收起侧栏"
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </>
      ) : (
        <Link href="/chat" className="flex justify-center">
          <BrandMark />
        </Link>
      )}
    </div>
  );
}


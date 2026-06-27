"use client";

import { ChevronRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSettings } from "@/components/settings/SettingsContext";
import { useAuthProfile } from "@/hooks/useAuthProfile";
import { agentsWarning } from "@/lib/agents-runtime";
import { clearAuthProfile } from "@/lib/auth";
import { popoverMenuItems } from "@/lib/settings";

type UserSettingsMenuProps = {
  collapsed?: boolean;
};

export function UserSettingsTrigger({ collapsed }: UserSettingsMenuProps) {
  const router = useRouter();
  const { profile } = useAuthProfile();
  const { menuOpen, setMenuOpen, openDrawer, settings, agentsRuntime } =
    useSettings();
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = profile?.nickname ?? "研究员";
  const displaySub = profile?.maskedPhone ?? "未登录";
  const showWarning = agentsWarning(agentsRuntime);

  const items = popoverMenuItems(settings.simulateAdmin);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, setMenuOpen]);

  return (
    <div className="relative" ref={rootRef}>
      <div
        className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}
      >
        <button
          type="button"
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--sidebar-hover)] ${
            collapsed ? "justify-center" : ""
          }`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen(!menuOpen)}
          title={collapsed ? "设置与账号" : undefined}
        >
          <UserAvatar showWarning={showWarning} />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--fg)]">{displayName}</p>
                <p className="truncate text-xs text-[var(--fg-tertiary)]">{displaySub}</p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-[var(--fg-tertiary)] transition-transform ${
                  menuOpen ? "rotate-90" : ""
                }`}
                strokeWidth={1.75}
              />
            </>
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          className={`settings-popover ${collapsed ? "settings-popover--collapsed" : ""}`}
          role="menu"
        >
          <div className="border-b border-[var(--border)] px-3 py-2.5">
            <p className="text-sm font-medium text-[var(--fg)]">{displayName}</p>
            <p className="text-xs text-[var(--fg-tertiary)]">
              {profile?.maskedPhone ?? "—"} · {profile?.tenantName ?? "企业租户"}
            </p>
          </div>

          <ul className="py-1">
            {items.map((item) => {
              const showDivider = item.id === "account";
              return (
                <li key={item.id}>
                  {showDivider && (
                    <div className="my-1 border-t border-[var(--border)]" />
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="settings-popover-item"
                    onClick={() => openDrawer(item.id)}
                  >
                    <span className="flex items-center gap-2">
                      {item.label}
                      {item.comingSoon && !["chat_defaults", "workspace"].includes(item.id) && (
                        <span className="rounded bg-[var(--border)] px-1 text-[9px] text-[var(--fg-tertiary)]">
                          后续
                        </span>
                      )}
                      {["chat_defaults", "workspace"].includes(item.id) && (
                        <span className="rounded bg-[var(--accent-muted)] px-1 text-[9px] text-[var(--accent)]">
                          预览
                        </span>
                      )}
                      {item.adminOnly && (
                        <span className="rounded bg-[var(--border)] px-1 text-[9px] text-[var(--fg-tertiary)]">
                          管理员
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-40" strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-[var(--border)] py-1">
            <button
              type="button"
              role="menuitem"
              className="settings-popover-item text-[var(--fg-secondary)]"
              onClick={async () => {
                setMenuOpen(false);
                clearAuthProfile();
                await fetch("/api/auth/logout", { method: "POST" });
                router.replace("/login");
                router.refresh();
              }}
            >
              <span className="flex items-center gap-2">
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                退出登录
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserAvatar({ showWarning }: { showWarning?: boolean }) {
  return (
    <div className="relative shrink-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--border-strong)] text-xs font-medium text-[var(--fg-secondary)]">
        研
      </div>
      {showWarning && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--sidebar-bg)] bg-amber-500"
          title="部分智能体不可用"
        />
      )}
    </div>
  );
}

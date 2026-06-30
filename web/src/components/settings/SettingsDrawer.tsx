"use client";

import { X } from "lucide-react";
import { useSettings } from "@/components/settings/SettingsContext";
import { AccountSettingsSection } from "@/components/settings/sections/AccountSettingsSection";
import {
  AgentSettingsSection,
  ConnectionStatusCard,
} from "@/components/settings/sections/AgentSettingsSection";
import { AboutSettingsSection } from "@/components/settings/sections/AboutSettingsSection";
import { ChatDefaultsSettingsSection } from "@/components/settings/sections/ChatDefaultsSettingsSection";
import { PlaceholderSettingsSection } from "@/components/settings/sections/PlaceholderSettingsSection";
import { WorkspaceSettingsSection } from "@/components/settings/sections/WorkspaceSettingsSection";
import {
  SETTINGS_MENU,
  visibleMenuItems,
  type SettingsSectionId,
} from "@/lib/settings";

function sectionTitle(id: SettingsSectionId): string {
  return SETTINGS_MENU.find((m) => m.id === id)?.label ?? "设置";
}

function SettingsPanel({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case "agent":
      return <AgentSettingsSection />;
    case "chat_defaults":
      return <ChatDefaultsSettingsSection />;
    case "workspace":
      return <WorkspaceSettingsSection />;
    case "account":
      return <AccountSettingsSection />;
    case "about":
      return <AboutSettingsSection />;
    case "admin":
      return <PlaceholderSettingsSection section={section} />;
    default:
      return null;
  }
}

export function SettingsDrawer() {
  const {
    drawerOpen,
    drawerSection,
    closeDrawer,
    openDrawer,
    settings,
    saveStatus,
  } = useSettings();

  if (!drawerOpen || !drawerSection) return null;

  const navItems = visibleMenuItems(settings.simulateAdmin);

  return (
    <div className="settings-drawer-root" role="presentation">
      <button
        type="button"
        className="settings-drawer-backdrop"
        aria-label="关闭设置"
        onClick={closeDrawer}
      />
      <aside
        className="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-drawer-title"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] px-5">
          <h2 id="settings-drawer-title" className="text-base font-semibold tracking-tight text-[var(--fg)]">
            设置
          </h2>
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-xs text-[var(--fg-tertiary)]">保存中…</span>
            )}
            {saveStatus === "saved" && (
              <span className="text-xs text-emerald-700">已保存</span>
            )}
            <button
              type="button"
              className="btn-icon"
              aria-label="关闭"
              onClick={closeDrawer}
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <nav
            className="flex w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]"
            aria-label="设置分类"
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
              {navItems.map((item) => {
                const active = drawerSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openDrawer(item.id)}
                    className={`mb-0.5 flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      active
                        ? "bg-[var(--accent-muted)] font-medium text-[var(--accent)]"
                        : "text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)]"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {item.label}
                      {item.comingSoon && (
                        <span className="rounded bg-[var(--border)] px-1 py-px text-[9px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)]">
                          预览
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="shrink-0 border-t border-[var(--border)] p-2.5">
              <ConnectionStatusCard />
            </div>
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            <h3 className="text-h2 mb-4 text-base">{sectionTitle(drawerSection)}</h3>
            <SettingsPanel section={drawerSection} />
          </div>
        </div>
      </aside>
    </div>
  );
}

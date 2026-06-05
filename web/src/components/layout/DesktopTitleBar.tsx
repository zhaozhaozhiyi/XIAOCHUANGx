"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";

type ElectronAPI = {
  isDesktop?: boolean;
  platform?: string;
  popupTitlebarMenu?: (id: TopMenuId, x: number, y: number) => Promise<unknown>;
};

type TopMenuId = "file" | "edit" | "view" | "window" | "help";

const TOP_MENUS: { id: TopMenuId; label: string }[] = [
  { id: "file", label: "文件" },
  { id: "edit", label: "编辑" },
  { id: "view", label: "视图" },
  { id: "window", label: "窗口" },
  { id: "help", label: "帮助" },
];

/**
 * 桌面壳 — Windows / Linux 自定义标题栏。
 *
 * 行为分支：
 * - Windows / Linux  → 渲染 36px 高标题栏 + 内嵌 5 个菜单按钮（VSCode 同款）
 * - macOS            → 不渲染（交通灯由系统保留，菜单走屏幕顶栏）
 * - 浏览器            → 不渲染
 *
 * 菜单交互：按钮点击 → 通过 IPC 让主进程在按钮位置弹原生 Menu（菜单内容由
 * apps/desktop/src/main/shortcuts.ts 的 buildTopMenuSubmenus 提供）。
 *
 * 设计文档：web/docs/desktop-titlebar-design.md
 */
export function DesktopTitleBar() {
  const [shouldRender, setShouldRender] = useState(false);
  const apiRef = useRef<ElectronAPI | null>(null);

  useEffect(() => {
    const api = (window as unknown as { electronAPI?: ElectronAPI }).electronAPI;
    if (api?.isDesktop && api.platform && api.platform !== "darwin") {
      apiRef.current = api;
      setShouldRender(true);
      // 让 fixed 定位的右上角按钮组（WorkspaceTopRightControls 等）让位 36px 标题栏
      document.documentElement.style.setProperty("--titlebar-offset", "var(--titlebar-h, 36px)");
      // 把平台打到 <html> 上，CSS 用 html[data-platform="win32"|"linux"] 给桌面壳全局滚动条挂样式
      document.documentElement.dataset.platform = api.platform;
      return () => {
        document.documentElement.style.removeProperty("--titlebar-offset");
        delete document.documentElement.dataset.platform;
      };
    }
  }, []);

  if (!shouldRender) return null;

  // 整条标题栏可拖拽；user-select:none 防止拖拽时误选文字
  const dragStyle: CSSProperties = {
    WebkitAppRegion: "drag",
    userSelect: "none",
  } as CSSProperties;

  // 按钮：no-drag + 阻止拖拽吞掉点击
  const noDragStyle: CSSProperties = {
    WebkitAppRegion: "no-drag",
  } as CSSProperties;

  const handleMenuClick = (id: TopMenuId) => (event: MouseEvent<HTMLButtonElement>) => {
    const api = apiRef.current;
    if (!api?.popupTitlebarMenu) return;
    const rect = event.currentTarget.getBoundingClientRect();
    // 弹在按钮左下角；Electron Menu.popup 接受 window 内 CSS 像素
    void api.popupTitlebarMenu(id, Math.round(rect.left), Math.round(rect.bottom));
  };

  return (
    <header
      role="presentation"
      className="flex shrink-0 items-stretch border-b border-[var(--titlebar-border)] bg-[var(--titlebar-bg)]"
      style={{ ...dragStyle, height: "var(--titlebar-h, 36px)" }}
    >
      {/* 左侧菜单按钮组 */}
      <nav
        aria-label="应用菜单"
        className="flex items-stretch pl-2"
        style={noDragStyle}
      >
        {TOP_MENUS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={handleMenuClick(id)}
            className="px-2.5 text-[12.5px] text-[var(--titlebar-fg)] hover:bg-[color-mix(in_srgb,var(--fg-tertiary)_14%,transparent)] active:bg-[color-mix(in_srgb,var(--fg-tertiary)_22%,transparent)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fg-tertiary)]"
            style={noDragStyle}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* 拖拽主区域 */}
      <div className="min-w-0 flex-1" aria-hidden />

      {/* 右侧系统按钮避让区（titleBarOverlay 在此区域绘制 ─ ▢ ✕） */}
      <div
        aria-hidden
        style={{ width: "var(--titlebar-win-trailing, 138px)" }}
      />
    </header>
  );
}

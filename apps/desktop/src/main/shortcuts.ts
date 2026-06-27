import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";

// 与 brand.ts 的 APP_DISPLAY_NAME 同源，但避免循环依赖在此本地化
const APP_DISPLAY_NAME = "小窗";

/**
 * Windows / Linux 顶部菜单（嵌入 36px 自定义标题栏）：
 *
 * - 渲染层在 DesktopTitleBar 里画 5 个按钮：File / Edit / View / Window / Help
 * - 用户点击按钮时通过 IPC desktop:popup-menu 把按钮位置传给主进程
 * - 主进程查 TOP_MENUS[id] 拿到对应 submenu 模板，调 Menu.popup() 弹出原生菜单
 *
 * 同时把所有 accelerator 注册到不可见的 ApplicationMenu 里 — 这样 Ctrl+R /
 * Ctrl+Shift+I / F11 / Ctrl+± / Ctrl+Q / Ctrl+C/V/X/A 等快捷键独立于菜单显隐
 * 仍然全部可用。
 *
 * 详细设计：web/docs/desktop-titlebar-design.md §6.2
 */

export type TopMenuId = "file" | "edit" | "view" | "window" | "help";

export const TOP_MENU_IDS: readonly TopMenuId[] = [
  "file",
  "edit",
  "view",
  "window",
  "help",
];

export const TOP_MENU_LABELS: Record<TopMenuId, string> = {
  file: "文件",
  edit: "编辑",
  view: "视图",
  window: "窗口",
  help: "帮助",
};

function buildTopMenuSubmenus(): Record<TopMenuId, MenuItemConstructorOptions[]> {
  return {
    file: [
      { role: "quit", label: `退出${APP_DISPLAY_NAME}` },
    ],
    edit: [
      { role: "undo", label: "撤销" },
      { role: "redo", label: "重做" },
      { type: "separator" },
      { role: "cut", label: "剪切" },
      { role: "copy", label: "复制" },
      { role: "paste", label: "粘贴" },
      { role: "selectAll", label: "全选" },
    ],
    view: [
      { role: "reload", label: "重新加载" },
      { role: "forceReload", label: "强制重新加载" },
      { role: "toggleDevTools", label: "开发者工具" },
      { type: "separator" },
      { role: "resetZoom", label: "实际大小" },
      { role: "zoomIn", label: "放大" },
      { role: "zoomOut", label: "缩小" },
      { type: "separator" },
      { role: "togglefullscreen", label: "切换全屏" },
    ],
    window: [
      { role: "minimize", label: "最小化" },
      { role: "close", label: "关闭" },
    ],
    help: [
      {
        label: `关于${APP_DISPLAY_NAME}`,
        click: () => {
          // V1.1 接入"关于"对话框；当前先用系统级 about 占位
          app.showAboutPanel?.();
        },
      },
    ],
  };
}

/**
 * 在不可见的 ApplicationMenu 里挂 accelerator，保证快捷键全部可用。
 * 顶级菜单 visible:false → 菜单栏不渲染，但 role 的 accelerator 仍激活。
 */
export function registerHiddenAccelerators(): void {
  const submenus = buildTopMenuSubmenus();
  const template: MenuItemConstructorOptions[] = TOP_MENU_IDS.map((id) => ({
    label: TOP_MENU_LABELS[id],
    visible: false,
    submenu: submenus[id],
  }));
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/**
 * 渲染端通过 IPC 传一个 TopMenuId + 按钮在窗口内的位置（CSS 像素），
 * 主进程在该位置弹原生菜单。位置经 DPI 缩放转 device 像素由 Electron 处理。
 */
export function popupTopMenu(
  win: BrowserWindow,
  id: TopMenuId,
  x: number,
  y: number,
): void {
  const submenus = buildTopMenuSubmenus();
  const items = submenus[id];
  if (!items) return;
  const menu = Menu.buildFromTemplate(items);
  menu.popup({
    window: win,
    x: Math.round(x),
    y: Math.round(y),
  });
}

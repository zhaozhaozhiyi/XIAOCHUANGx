/**
 * TrayManager — V1.1 D1.2（desktop-v1.1-roadmap.md §4）
 *
 * 职责：
 *  1. 创建系统托盘图标（复用 build/icon.png 缩 16/32；TODO: 后续给 mac
 *     补一张 *Template.png 单色模板图，目前先用彩色）
 *  2. 右键菜单（§4.3）：
 *       打开主窗口
 *       Companion: 已连接（绿）/ 重启中（黄）/ 未连接（红）
 *         └─ 重启 Companion
 *       关于小窗 vX.Y
 *       退出
 *  3. tooltip 实时同步 supervisor 状态
 *  4. 左键 / 双击托盘图标 → 显示主窗口
 *  5. 退出菜单项：置位 isQuitting，保证 close 拦截不再阻止 quit
 *
 * 不做：
 *  - 真退出 vs 隐藏到托盘 的"用户偏好" toggle —— V1.1 起步全部
 *    "Win/Linux 关闭=隐藏到托盘"，等设置面板加 toggle 时再读
 *  - mac dock 隐藏 —— mac 沿用系统行为，关闭主窗口仅隐藏窗口（系统默认）
 */

import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeImage,
  type MenuItemConstructorOptions,
  type NativeImage,
} from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_DISPLAY_NAME } from "./brand.js";
import {
  getCompanionSupervisor,
  type CompanionStatus,
} from "./companion-supervisor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// -----------------------------------------------------------------------------
// 图标定位 / 缩放
// -----------------------------------------------------------------------------

/**
 * 找一张 1024×1024 源 png 缩到托盘尺寸。
 * - mac/Linux：建议 16×16
 * - Win：16×16（多显示器下系统会按 DPI 自动选）
 *
 * 后续 D1.2+：mac 走 Template image（黑/透明 + setTemplateImage(true)），
 * 现阶段先用彩色 png 把功能跑通。
 */
function resolveTrayIcon(): NativeImage | null {
  const candidates = [
    join(__dirname, "../../build/icon.png"),
    join(app.getAppPath(), "build/icon.png"),
    join(process.resourcesPath ?? "", "icon.png"),
  ];
  for (const p of candidates) {
    if (!p || !existsSync(p)) continue;
    const raw = nativeImage.createFromPath(p);
    if (raw.isEmpty()) continue;
    // mac 系统托盘高度 22pt → 16px logical；Win/Linux 16px 起步
    const size = process.platform === "darwin" ? 16 : 16;
    const resized = raw.resize({ width: size, height: size, quality: "best" });
    return resized.isEmpty() ? raw : resized;
  }
  return null;
}

// -----------------------------------------------------------------------------
// status → 文案 / 颜色文本
// -----------------------------------------------------------------------------

/** 给托盘菜单/tooltip 用的 status 文本 */
function describeStatus(status: CompanionStatus): {
  /** 菜单项 label：含彩点 emoji（macOS / Win 都能正常渲染） */
  menuLabel: string;
  /** tooltip 文案：标题 + 一行 hint */
  tooltip: string;
  /** 是否允许"重启 Companion" */
  canRestart: boolean;
} {
  const dot =
    status.state === "running"
      ? "🟢"
      : status.state === "starting" || status.state === "restarting"
      ? "🟡"
      : "🔴";

  const label =
    status.state === "running"
      ? status.external
        ? "Companion: 已连接（外部）"
        : "Companion: 已连接（内置）"
      : status.state === "starting"
      ? "Companion: 启动中…"
      : status.state === "restarting"
      ? "Companion: 重启中…"
      : status.state === "crashed"
      ? "Companion: 已崩溃"
      : "Companion: 未连接";

  const tooltipLines = [
    `${APP_DISPLAY_NAME} v${app.getVersion()}`,
    `${dot} ${label.replace(/^Companion:\s*/, "")}`,
  ];
  if (status.hint) tooltipLines.push(status.hint);

  return {
    menuLabel: `${dot} ${label}`,
    tooltip: tooltipLines.join("\n"),
    // crashed / needs-manual-start / restarting 都可点重启；running 也允许
    // 用户主动重连；只有 starting 期间禁用避免重复触发。
    canRestart: status.state !== "starting",
  };
}

// -----------------------------------------------------------------------------
// TrayManager
// -----------------------------------------------------------------------------

export class TrayManager {
  private tray: Tray | null = null;
  private unsubscribeSupervisor: (() => void) | null = null;
  private currentStatus: CompanionStatus | null = null;

  /** 创建托盘并接到 supervisor 状态流上 */
  install(): void {
    if (this.tray) return;
    const icon = resolveTrayIcon();
    if (!icon) {
      console.warn("[desktop] tray icon not found; tray disabled");
      return;
    }

    try {
      this.tray = new Tray(icon);
    } catch (err) {
      // Linux 上某些精简发行版没有系统托盘可用 → 不致命，只记日志
      console.warn("[desktop] failed to create tray:", err);
      this.tray = null;
      return;
    }

    this.tray.setToolTip(`${APP_DISPLAY_NAME} v${app.getVersion()}`);

    // 左键 / 双击托盘图标 → 显示主窗口（mac 上不会触发 click，所以两个都接）
    this.tray.on("click", () => this.showMainWindow());
    this.tray.on("double-click", () => this.showMainWindow());

    // 订阅 supervisor 状态：subscribe 内部会立即推一次当前状态，
    // 因此 install() 之后 tray 菜单 / tooltip 即刻就是最新的。
    const supervisor = getCompanionSupervisor();
    this.unsubscribeSupervisor = supervisor.subscribe((status) => {
      this.currentStatus = status;
      this.refresh();
    });
  }

  /** 显示并聚焦主窗口；窗口不存在时由 activate 回调负责重建 */
  private showMainWindow(): void {
    const wins = BrowserWindow.getAllWindows();
    const win = wins.find((w) => !w.isDestroyed());
    if (!win) {
      // mac 上点 dock / 托盘且无窗口时，由 app.on('activate') 创建
      app.emit("activate");
      return;
    }
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }

  /** 重建右键菜单 + tooltip（status 每变一次就调一次） */
  private refresh(): void {
    if (!this.tray) return;
    const status = this.currentStatus;
    const desc = status
      ? describeStatus(status)
      : {
          menuLabel: "Companion: 未知",
          tooltip: `${APP_DISPLAY_NAME} v${app.getVersion()}`,
          canRestart: false,
        };

    const template: MenuItemConstructorOptions[] = [
      {
        label: "打开主窗口",
        click: () => this.showMainWindow(),
      },
      { type: "separator" },
      {
        label: desc.menuLabel,
        enabled: false,
      },
      {
        label: "重启 Companion",
        enabled: desc.canRestart,
        click: () => {
          void getCompanionSupervisor()
            .restart()
            .catch((err: unknown) => {
              console.warn("[desktop] tray restart companion failed:", err);
            });
        },
      },
      { type: "separator" },
      {
        label: `关于${APP_DISPLAY_NAME} v${app.getVersion()}`,
        click: () => {
          // V1.1 起步：不弹独立窗口，仅打开主窗口聚焦"关于"页（路由由渲染层
          // 自行处理；这里先聚焦窗口）。后续可改 dialog.showMessageBox。
          this.showMainWindow();
        },
      },
      {
        label: "退出",
        click: () => this.quitApp(),
      },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
    this.tray.setToolTip(desc.tooltip);
  }

  /** 标"真退出"语义并触发 app.quit；index.ts 的 close 拦截会放行 */
  private quitApp(): void {
    setQuittingFlag(true);
    app.quit();
  }

  /** app 退出前清理（before-quit 调） */
  destroy(): void {
    if (this.unsubscribeSupervisor) {
      this.unsubscribeSupervisor();
      this.unsubscribeSupervisor = null;
    }
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch (err) {
        console.warn("[desktop] destroy tray failed:", err);
      }
      this.tray = null;
    }
  }

}

// -----------------------------------------------------------------------------
// 真退出标记 —— index.ts close 拦截读取
// -----------------------------------------------------------------------------

/**
 * isQuitting：被托盘"退出"菜单 / before-quit / 系统关机等显式触发时置 true。
 * close 事件时若为 false，则在 Win/Linux 把窗口隐藏到托盘而不是真关闭。
 *
 * 用模块级变量而非 app 私字段，是为了让 index.ts 不依赖 TrayManager 实例
 * 也能读到（例如 tray 创建失败的兜底路径里）。
 */
let _isQuitting = false;

export function setQuittingFlag(v: boolean): void {
  _isQuitting = v;
}

export function isQuitting(): boolean {
  return _isQuitting;
}

// -----------------------------------------------------------------------------
// 单例
// -----------------------------------------------------------------------------

let _instance: TrayManager | null = null;

export function getTrayManager(): TrayManager {
  if (!_instance) _instance = new TrayManager();
  return _instance;
}

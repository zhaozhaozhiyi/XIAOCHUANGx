/**
 * AutoUpdater — V1.1 D1.5（desktop-v1.1-roadmap.md §7）
 *
 * 职责：
 *  1. 启动 30s 后首次 checkForUpdates；之后每 4h 复查
 *  2. 自动后台下载（autoDownload=true）；下次启动应用（autoInstallOnAppQuit=true）
 *  3. 状态广播 'updater:status' → 渲染层（设置「关于」页订阅渲染按钮 / 进度条）
 *  4. 用户主动触发：check() / installNow()
 *
 * 不做（V1.1 桌面单机不在 scope）：
 *  - 强制即时更新（仅触发 quitAndInstall）
 *  - 差分包优化 / blockmap（electron-updater publish:generic 默认开）
 *  - 顶栏小红点（roadmap §7.2 提到，V1.2 polish；本期仅 About 页）
 *
 * 设计取舍：
 *  - 仿 companion-supervisor.ts 体例：模块单例 + 状态机 + listeners + IPC 广播
 *  - !app.isPackaged 全部 no-op，避免 dev 报 "dev-app-update.yml not found"
 *  - 出现的所有 electron-updater 错误（404 / network / signature） 走 'error' 状态
 *    透出 message，不抛；让用户在 About 页能看到失败原因
 *  - publish 源失效（占位 url 还没接服务端）→ 'error' 静默；不阻塞主功能
 */

import { app, BrowserWindow } from "electron";
import type {
  ProgressInfo,
  UpdateCheckResult,
  UpdateDownloadedEvent,
  UpdateInfo,
} from "electron-updater";

// ⬇⬇ 命名 import 在 ESM/CJS 互操作下要走 default 解构（项目是 type:module）
//    electron-updater 的 dist/main.js 是 CJS，next/electron 实测都得这么写
import electronUpdaterPkg from "electron-updater";
const { autoUpdater } = electronUpdaterPkg;

// -----------------------------------------------------------------------------
// 类型 / 常量
// -----------------------------------------------------------------------------

export type UpdaterState =
  | "disabled" // dev 模式 / publish 未配置
  | "idle"
  | "checking"
  | "available" // 检测到更新但还没下载完
  | "downloading"
  | "downloaded" // 已下载完毕，等下次启动 / 立即重启
  | "not-available"
  | "error";

export type UpdaterStatus = {
  state: UpdaterState;
  /** 当前应用版本（始终填，About 页直接读） */
  currentVersion: string;
  /** 检测到的新版本（available 起填） */
  nextVersion?: string;
  /** 下载进度 0–100（downloading 起填） */
  progressPercent?: number;
  /** 错误消息（error 时填） */
  error?: string;
  /** 上次检查时间戳（ms） */
  lastCheckedAt?: number;
  /** 给用户看的中文提示 */
  hint?: string;
};

const FIRST_CHECK_DELAY_MS = 30_000; // 30s
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4h

// -----------------------------------------------------------------------------
// 单例
// -----------------------------------------------------------------------------

class AutoUpdaterController {
  private status: UpdaterStatus = {
    state: "idle",
    currentVersion: app.getVersion(),
  };
  private firstCheckTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  /** 主进程内订阅者；渲染层另走 IPC 广播 */
  private listeners = new Set<(s: UpdaterStatus) => void>();
  /** broadcast 去重 */
  private lastBroadcastJson = "";
  /** 是否已 install hook */
  private wired = false;

  /** 启动入口；dev 与首启都安全调用，不抛 */
  start(): void {
    // dev 模式 (!app.isPackaged) 直接 disable，避免 dev-app-update.yml 报错
    if (!app.isPackaged) {
      this.setStatus({
        state: "disabled",
        currentVersion: app.getVersion(),
        hint: "开发模式下自动更新已禁用",
      });
      return;
    }

    if (!this.wired) {
      this.wireEvents();
      this.wired = true;
    }

    // 配置语义对齐 roadmap §7.2
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    // logger 暂用 console；electron-log 可在 V1.2 polish 时接入
    autoUpdater.logger = console;

    // 首次检查 30s 后；避免冷启动期与 supervisor / 网络拥塞抢跑
    if (this.firstCheckTimer) clearTimeout(this.firstCheckTimer);
    this.firstCheckTimer = setTimeout(() => {
      void this.runCheck("auto");
    }, FIRST_CHECK_DELAY_MS);

    // 每 4h 复查
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = setInterval(() => {
      void this.runCheck("auto");
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.firstCheckTimer) {
      clearTimeout(this.firstCheckTimer);
      this.firstCheckTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /** 手动触发（设置「关于」页"检查更新"按钮） */
  async check(): Promise<UpdaterStatus> {
    if (this.status.state === "disabled") return this.getStatus();
    await this.runCheck("manual");
    return this.getStatus();
  }

  /**
   * 立即重启并安装已下载的更新；仅在 state === 'downloaded' 有意义。
   * 注意 quitAndInstall 会触发 before-quit → supervisor.stop()，所以
   * Companion 子进程会被正常清理。
   */
  installNow(): void {
    if (this.status.state !== "downloaded") return;
    autoUpdater.quitAndInstall();
  }

  getStatus(): UpdaterStatus {
    return { ...this.status };
  }

  subscribe(listener: (s: UpdaterStatus) => void): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getStatus());
    } catch (err) {
      console.warn("[updater] subscribe initial push failed:", err);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---------------------------------------------------------------------------
  // 内部
  // ---------------------------------------------------------------------------

  /**
   * 实际触发 checkForUpdates；区分 auto/manual 仅影响 hint 文案。
   * electron-updater 出错时会走 'error' 事件回调，这里只 catch 同步阶段抛错。
   */
  private async runCheck(_source: "auto" | "manual"): Promise<void> {
    this.setStatus({
      state: "checking",
      lastCheckedAt: Date.now(),
      hint: "正在检查更新…",
      // 清掉旧 error 以免误导
      error: undefined,
    });
    try {
      const result: UpdateCheckResult | null =
        await autoUpdater.checkForUpdates();
      // result.updateInfo 即将由 'update-available' / 'update-not-available' 事件
      // 接管渲染；这里不重复 setStatus
      if (!result) {
        // 同步返回 null（极少见）→ 当作 not-available
        this.setStatus({
          state: "not-available",
          hint: "已是最新版本",
        });
      }
    } catch (err) {
      // checkForUpdates 同步阶段就抛（如 publish 配置非法 / DNS）
      const message = err instanceof Error ? err.message : String(err);
      this.setStatus({
        state: "error",
        error: message,
        hint: `检查更新失败：${truncate(message, 120)}`,
      });
    }
  }

  /** 把 electron-updater 的事件桥接到自家 status */
  private wireEvents(): void {
    autoUpdater.on("checking-for-update", () => {
      this.setStatus({ state: "checking", hint: "正在检查更新…" });
    });

    autoUpdater.on("update-available", (info: UpdateInfo) => {
      this.setStatus({
        state: "available",
        nextVersion: info.version,
        hint: `检测到新版本 v${info.version}，正在后台下载…`,
      });
    });

    autoUpdater.on("update-not-available", (info: UpdateInfo) => {
      this.setStatus({
        state: "not-available",
        nextVersion: info.version,
        hint: "已是最新版本",
      });
    });

    autoUpdater.on("download-progress", (p: ProgressInfo) => {
      const pct = Math.max(0, Math.min(100, Math.round(p.percent)));
      this.setStatus({
        state: "downloading",
        progressPercent: pct,
        hint: `更新下载中 ${pct}%`,
      });
    });

    autoUpdater.on("update-downloaded", (event: UpdateDownloadedEvent) => {
      this.setStatus({
        state: "downloaded",
        nextVersion: event.version,
        progressPercent: 100,
        hint: `新版本 v${event.version} 已就绪，重启即生效`,
      });
    });

    autoUpdater.on("error", (err: Error) => {
      const message = err.message ?? String(err);
      this.setStatus({
        state: "error",
        error: message,
        // 用户看到 publish 占位 url 404 之类，给个温和文案
        hint: `自动更新暂不可用：${truncate(message, 120)}`,
      });
    });
  }

  private setStatus(patch: Partial<UpdaterStatus>): void {
    const next: UpdaterStatus = {
      ...this.status,
      ...patch,
      // currentVersion 永远以 app.getVersion() 为准
      currentVersion: app.getVersion(),
    };
    this.status = next;
    this.broadcast();
  }

  private broadcast(): void {
    const json = JSON.stringify(this.status);
    if (json === this.lastBroadcastJson) return;
    this.lastBroadcastJson = json;

    for (const win of BrowserWindow.getAllWindows()) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send("updater:status", this.status);
      } catch (err) {
        console.warn("[updater] broadcast failed:", err);
      }
    }
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch (err) {
        console.warn("[updater] listener failed:", err);
      }
    }
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// -----------------------------------------------------------------------------
// 模块级单例
// -----------------------------------------------------------------------------

let _instance: AutoUpdaterController | null = null;

export function getAutoUpdater(): AutoUpdaterController {
  if (!_instance) _instance = new AutoUpdaterController();
  return _instance;
}

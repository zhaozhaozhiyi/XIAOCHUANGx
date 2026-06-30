/**
 * CompanionSupervisor — V1.1 D1.1（desktop-v1.1-roadmap.md §3）
 *
 * 职责：
 *  1. 启动时检测本机 Companion（GET /v1/health on :9477）。
 *     - 已健康 → external=true，记 "running"（用户 dev 命令手动启动）
 *     - 不健康 + 打包态 + 找到 sidecar binary → spawn 子进程
 *     - 不健康 + 开发态 / 找不到 binary → "needs-manual-start"
 *  2. 健康轮询：5s 间隔；连续 3 次失败 → "crashed"
 *  3. 重启策略：
 *     - 仅 supervisor 自己 spawn 的进程才 auto-restart（external 崩了不试图重启）
 *     - 5min 滑动窗口内重启 ≥3 次 → "needs-manual-start"
 *  4. 退出清理：杀仅自己 spawn 的子进程
 *  5. 状态变化广播：'companion:status' IPC 事件 → 所有 BrowserWindow
 *
 * 不做（D1.2/D1.3/D1.4 范畴）：
 *  - 托盘 / HMAC 注册 / 实际 sidecar binary 打包
 *    （spawn 代码留 stub，找不到 binary 即降级为 needs-manual-start）
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { getCompanionHealth } from "./companion-health.js";
import { writeToStdio } from "./stdio.js";

// -----------------------------------------------------------------------------
// 类型
// -----------------------------------------------------------------------------

export type CompanionState =
  | "starting"
  | "running"
  | "crashed"
  | "restarting"
  | "needs-manual-start";

export type CompanionStatus = {
  state: CompanionState;
  /** 仅 supervisor 自己 spawn 的进程才填 */
  pid?: number;
  /** true = 用户手动启动（dev 场景）；false = supervisor 启动的 */
  external: boolean;
  /** 滑动窗口（5min）内重启次数 */
  restartCount: number;
  /** /v1/health 返回的版本号（若解析得到） */
  version?: string;
  /** 上次健康成功的时间戳（ms） */
  lastHealthAt?: number;
  /** 给用户看的中文提示 */
  hint?: string;
};

const HEALTH_INTERVAL_MS = 5_000;
const CRASH_THRESHOLD = 3; // 连续 3 次 health 失败 → crashed
const RESTART_WINDOW_MS = 5 * 60 * 1000; // 5min 滑动窗口
const RESTART_LIMIT = 3; // 5min 内 ≥3 次 → needs-manual-start
const SPAWN_GRACE_MS = 8_000; // spawn 后给 8s 让 Companion 监听端口

// -----------------------------------------------------------------------------
// sidecar bundle 定位（D1.4 desktop-v1.1-roadmap.md §6）
// -----------------------------------------------------------------------------

/**
 * D1.4 捆绑方案：
 *  - Companion 用 esbuild 打成单个 CJS（`companion.cjs`，~数百 KB），
 *    放进 `process.resourcesPath/companion/`
 *  - Skills / Prompts 不进 bundle，作为静态目录放在 `process.resourcesPath/{skills,prompts}/`
 *  - 运行时由 supervisor 用 `spawn(process.execPath, [bundlePath], { ELECTRON_RUN_AS_NODE: "1" })`
 *    跑成纯 Node 进程（Electron binary 内嵌 Node runtime）
 *
 * 偏离 roadmap §6.3 写的 pkg/nexe 路线 —— 见 docs/plans/desktop-d1.4-bundle-status.md
 * 的"决策"小节。
 */
export type SidecarLayout = {
  /** Electron 主进程 binary（process.execPath），用作 Node runtime */
  execPath: string;
  /** companion.cjs 绝对路径 */
  bundlePath: string;
  /** skills/ 目录（注入到 JLC_SKILLS_DIR） */
  skillsDir: string;
  /** prompts/ 目录（注入到 JLC_PROMPTS_DIR） */
  promptsDir: string;
};

/**
 * 找 Companion sidecar bundle + 附属资源目录。
 *
 * 开发态（!app.isPackaged）始终返回 null —— 让用户继续走 `pnpm companion:dev`。
 * 打包态 bundle 缺失也返回 null，由调用方回退到 "needs-manual-start"。
 */
export function findCompanionBundle(): SidecarLayout | null {
  // 开发态：不 spawn；保持 D1.1 既有行为
  if (!app.isPackaged) return null;

  const resources = process.resourcesPath;
  const bundlePath = join(resources, "companion", "companion.cjs");
  if (!existsSync(bundlePath)) return null;

  // skills/ 与 prompts/ 是软依赖：缺也能跑（runtime-core/paths.ts 会回退）
  // 但既然 prepare 脚本会一起拷，缺意味着安装包损坏；这里仍 return 让用户能跑，
  // 失败由 Companion 启动期暴露
  return {
    execPath: process.execPath,
    bundlePath,
    skillsDir: join(resources, "skills"),
    promptsDir: join(resources, "prompts"),
  };
}

// -----------------------------------------------------------------------------
// CompanionSupervisor
// -----------------------------------------------------------------------------

export class CompanionSupervisor {
  private status: CompanionStatus = {
    state: "starting",
    external: false,
    restartCount: 0,
  };

  private child: ChildProcess | null = null;
  private healthTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  /** 自动重启时间戳（ms），用于 5min 滑动窗口判定 */
  private restartTimestamps: number[] = [];
  /** stop() 被调用后置位，防止 child exit 触发误重启 / 防止 poll 继续广播 */
  private stopping = false;
  /** 最近一次 broadcast 出去的 JSON，状态实质未变就不重复 send */
  private lastBroadcastJson = "";
  /** 主进程内订阅者（D1.2 托盘等），在 broadcast 时同步触发 */
  private listeners = new Set<(status: CompanionStatus) => void>();

  // ---------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this.healthTimer) return; // 已经在跑
    this.stopping = false;
    this.setStatus({ state: "starting" });

    const health = await getCompanionHealth();
    if (health.ok) {
      this.consecutiveFailures = 0;
      this.markRunning({ external: true, healthBody: health.body });
    } else {
      // 没起来 → 试着自己 spawn（仅打包态 + binary 存在）
      const spawned = this.trySpawnSidecar();
      if (!spawned) {
        this.setStatus({
          state: "needs-manual-start",
          external: false,
          pid: undefined,
          hint: app.isPackaged
            ? "未检测到 Companion 服务，且未找到内置 Companion，请联系管理员检查安装包"
            : "未检测到 Companion 服务，请运行 pnpm companion:dev 启动本机 Companion",
        });
      }
    }

    // 无论上面哪条路径，都开启轮询：
    //  - needs-manual-start 也轮询，用户手动 `pnpm companion:dev` 后下一轮自动转 running
    //  - running 状态轮询负责感知 external 进程崩溃
    this.healthTimer = setInterval(() => {
      void this.poll();
    }, HEALTH_INTERVAL_MS);
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    // 仅杀自己 spawn 的子进程；external 进程不动
    this.killChild("SIGTERM");
  }

  getStatus(): CompanionStatus {
    return { ...this.status };
  }

  /**
   * 主进程内订阅状态变化（D1.2 托盘 / 系统通知等）。
   * 仅在 broadcast 实质变化时触发；返回 unsubscribe。
   * 注：渲染层走 IPC 'companion:status'，不要走这个入口。
   */
  subscribe(listener: (status: CompanionStatus) => void): () => void {
    this.listeners.add(listener);
    // 立即推一次当前状态，订阅方不必再主动调 getStatus()
    try {
      listener(this.getStatus());
    } catch (err) {
      console.warn("[desktop] companion subscribe initial push failed:", err);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 用户主动触发（D1.2 托盘菜单 / 渲染层按钮）：
   *  - external 或当前无 child：重新探测一遍，必要时尝试 spawn
   *  - 自己 spawn 的：杀掉重 spawn（不计入 5min 滑动窗口配额）
   */
  async restart(): Promise<CompanionStatus> {
    if (this.status.external || !this.child) {
      this.consecutiveFailures = 0;
      const health = await getCompanionHealth();
      if (health.ok) {
        this.markRunning({ external: true, healthBody: health.body });
      } else {
        const spawned = this.trySpawnSidecar();
        if (!spawned) {
          this.setStatus({
            state: "needs-manual-start",
            external: false,
            pid: undefined,
            hint: app.isPackaged
              ? "未检测到 Companion 服务，且未找到内置 Companion"
              : "未检测到 Companion 服务，请运行 pnpm companion:dev",
          });
        }
      }
      return this.getStatus();
    }

    // supervisor 自己 spawn 的：杀 + 重 spawn
    this.setStatus({ state: "restarting", hint: "正在手动重启 Companion…" });
    this.killChild("SIGTERM");
    this.consecutiveFailures = 0;
    // 手动 restart 不计配额，避免用户主动操作把自己锁进 needs-manual-start
    const spawned = this.trySpawnSidecar();
    if (!spawned) {
      this.setStatus({
        state: "needs-manual-start",
        external: false,
        pid: undefined,
        hint: "Companion 重启失败：未找到内置 Companion",
      });
    }
    return this.getStatus();
  }

  // ---------------------------------------------------------------------------
  // 内部：健康轮询
  // ---------------------------------------------------------------------------

  private async poll(): Promise<void> {
    if (this.stopping) return;

    const health = await getCompanionHealth();
    if (health.ok) {
      this.consecutiveFailures = 0;
      // 当前没有自己 spawn 的 child → 视为 external
      this.markRunning({
        external: !this.child,
        healthBody: health.body,
      });
      return;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures < CRASH_THRESHOLD) return;

    // 连续 3 次失败 → crashed
    //  - external（!this.child）：标 crashed，但不自动重启
    //  - supervised：标 crashed → 走重启策略
    if (!this.child) {
      if (this.status.state !== "crashed") {
        this.setStatus({
          state: "crashed",
          external: true,
          pid: undefined,
          hint: "Companion 服务无响应，请检查 pnpm companion:dev 终端",
        });
      }
      return;
    }

    // supervised 路径：标 crashed → 自动重启
    this.setStatus({ state: "crashed", external: false });
    void this.handleSupervisedCrash();
  }

  // ---------------------------------------------------------------------------
  // 内部：spawn / 重启
  // ---------------------------------------------------------------------------

  /**
   * 尝试 spawn sidecar；返回 true 表示进程已 fork 成功
   * （不保证服务已就绪，后续轮询会 → running 或继续 crashed→restart 链路）。
   *
   * D1.4 实现：
   *  - 用 process.execPath（Electron binary 内嵌 Node）+ ELECTRON_RUN_AS_NODE=1
   *    跑 companion.cjs，不需要单独打 Node binary
   *  - JLC_SKILLS_DIR / JLC_PROMPTS_DIR 让 runtime-core/paths.ts 找到资源目录；
   *    用户已显式设的 env 优先（?? 兜底），便于企业部署覆盖
   */
  private trySpawnSidecar(): boolean {
    const layout = findCompanionBundle();
    if (!layout) return false;

    try {
      const child = spawn(layout.execPath, [layout.bundlePath], {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        // 不开 detached：主进程退出连带杀子
        env: {
          ...process.env,
          // 关键：让 Electron binary 跑成纯 Node，跳过 GUI、命令行参数、Chromium
          ELECTRON_RUN_AS_NODE: "1",
          // 让 runtime-core 找到资源目录（用户 env 优先）
          JLC_SKILLS_DIR: process.env.JLC_SKILLS_DIR ?? layout.skillsDir,
          JLC_PROMPTS_DIR: process.env.JLC_PROMPTS_DIR ?? layout.promptsDir,
        },
      });
      this.child = child;
      this.consecutiveFailures = 0;
      this.setStatus({
        state: "starting",
        external: false,
        pid: child.pid,
        hint: "正在启动内置 Companion…",
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        // 透传 Companion 日志，方便用户在 desktop 终端排错
        writeToStdio(process.stdout, `[companion] ${chunk.toString("utf8")}`);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        writeToStdio(process.stderr, `[companion] ${chunk.toString("utf8")}`);
      });
      child.on("error", (err) => {
        console.error("[desktop] companion sidecar spawn error:", err);
      });
      child.on("exit", (code, signal) => {
        const wasOurs = this.child === child;
        if (wasOurs) this.child = null;
        if (this.stopping) return; // app 关闭中不重启
        if (!wasOurs) return; // 旧 child 的退出事件（已被新 child 替换），忽略

        console.warn(
          `[desktop] companion exited code=${code} signal=${signal ?? "-"}`,
        );
        this.setStatus({ state: "crashed", external: false, pid: undefined });
        void this.handleSupervisedCrash();
      });

      // 给 Companion 一段宽限期监听端口；轮询会接力转 running
      setTimeout(() => {
        void this.poll();
      }, SPAWN_GRACE_MS);

      return true;
    } catch (err) {
      console.error("[desktop] failed to spawn companion sidecar:", err);
      this.child = null;
      return false;
    }
  }

  /**
   * supervised 进程崩溃 / 退出后的处理：
   *  - 5min 滑动窗口内 < 3 次 → 拉起新 spawn（restarting）
   *  - ≥ 3 次 → needs-manual-start，停止自动恢复（用户手动 restart 才再试）
   */
  private async handleSupervisedCrash(): Promise<void> {
    if (this.stopping) return;

    const now = Date.now();
    this.restartTimestamps = this.restartTimestamps.filter(
      (t) => now - t < RESTART_WINDOW_MS,
    );

    if (this.restartTimestamps.length >= RESTART_LIMIT) {
      this.setStatus({
        state: "needs-manual-start",
        external: false,
        pid: undefined,
        restartCount: this.restartTimestamps.length,
        hint: `Companion 在 5 分钟内崩溃了 ${this.restartTimestamps.length} 次，请检查日志后手动重启`,
      });
      return;
    }

    this.restartTimestamps.push(now);
    this.setStatus({
      state: "restarting",
      external: false,
      pid: undefined,
      restartCount: this.restartTimestamps.length,
      hint: "Companion 已崩溃，正在自动重启…",
    });

    const spawned = this.trySpawnSidecar();
    if (!spawned) {
      this.setStatus({
        state: "needs-manual-start",
        external: false,
        pid: undefined,
        restartCount: this.restartTimestamps.length,
        hint: "未找到内置 Companion，无法自动重启",
      });
    }
  }

  private killChild(signal: NodeJS.Signals): void {
    const child = this.child;
    if (!child) return;
    this.child = null;
    try {
      child.kill(signal);
    } catch (err) {
      console.warn("[desktop] kill companion child failed:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // 内部：状态机 / 广播
  // ---------------------------------------------------------------------------

  private markRunning(args: {
    external: boolean;
    healthBody: unknown;
  }): void {
    const version = extractVersion(args.healthBody);
    this.setStatus({
      state: "running",
      external: args.external,
      pid: args.external ? undefined : this.child?.pid,
      version,
      lastHealthAt: Date.now(),
      hint: args.external
        ? "Companion 已连接（外部启动）"
        : "Companion 已连接（内置）",
      restartCount: this.restartTimestamps.filter(
        (t) => Date.now() - t < RESTART_WINDOW_MS,
      ).length,
    });
  }

  /**
   * 合并补丁式更新 status，并在实质变化时 broadcast。
   *
   * 注意：传入的 patch 必须语义完备（例如转 needs-manual-start 时
   * 要主动把 pid 置 undefined），不要假设旧字段会自动清掉。
   */
  private setStatus(patch: Partial<CompanionStatus>): void {
    const next: CompanionStatus = {
      ...this.status,
      ...patch,
      // restartCount 始终用滑动窗口最新值（除非 patch 显式覆盖）
      restartCount:
        patch.restartCount ??
        this.restartTimestamps.filter(
          (t) => Date.now() - t < RESTART_WINDOW_MS,
        ).length,
    };
    this.status = next;
    this.broadcast();
  }

  private broadcast(): void {
    const json = JSON.stringify(this.status);
    if (json === this.lastBroadcastJson) return;
    this.lastBroadcastJson = json;

    const wins = BrowserWindow.getAllWindows();
    for (const win of wins) {
      if (win.isDestroyed()) continue;
      try {
        win.webContents.send("companion:status", this.status);
      } catch (err) {
        console.warn("[desktop] broadcast companion:status failed:", err);
      }
    }

    // 主进程内订阅者（D1.2 tray 等）。listener 异常被吞，避免一个坏订阅
    // 拖垮其它订阅者。
    for (const listener of this.listeners) {
      try {
        listener(this.status);
      } catch (err) {
        console.warn("[desktop] companion listener failed:", err);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// 工具
// -----------------------------------------------------------------------------

function extractVersion(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;
  const v = rec["version"];
  return typeof v === "string" ? v : undefined;
}

// -----------------------------------------------------------------------------
// 模块级单例
// -----------------------------------------------------------------------------

let _instance: CompanionSupervisor | null = null;

export function getCompanionSupervisor(): CompanionSupervisor {
  if (!_instance) _instance = new CompanionSupervisor();
  return _instance;
}

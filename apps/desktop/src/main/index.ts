import { app, BrowserWindow, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import {
  dirname,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
import {
  APP_DISPLAY_NAME,
  applyBrandIcon,
  installDesktopBranding,
  resolveBrandIcon,
} from "./brand.js";
import { getCompanionHealth } from "./companion-health.js";
import { getCompanionSupervisor } from "./companion-supervisor.js";
import { stopEmbeddedWebServer } from "./embedded-web.js";
import { pickAndImportFolder } from "./import-folder.js";
import { popupTopMenu, TOP_MENU_IDS, type TopMenuId } from "./shortcuts.js";
import { resolveWebAppUrl } from "./web-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGACY_PROJECT_ROOT = resolve(process.cwd(), "..");

function companionBaseUrl(): string {
  return (process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477").replace(
    /\/$/,
    "",
  );
}

function resolveInside(root: string, relPath: string): string | null {
  const normalized = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.startsWith("..") || isAbsolute(normalized)) {
    return null;
  }

  const full = resolve(root, normalized);
  const rel = relative(root, full);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  return full;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function workspaceRootForProject(projectId: string): Promise<string> {
  if (process.env.COMPANION_USE_MOCK === "1") {
    return LEGACY_PROJECT_ROOT;
  }

  const res = await fetch(
    `${companionBaseUrl()}/v1/projects/${encodeURIComponent(projectId)}/tree`,
    { signal: AbortSignal.timeout(5_000) },
  );
  const body = (await res.json().catch(() => ({}))) as {
    root?: string;
    error?: string;
  };
  if (!res.ok || !body.root) {
    throw new Error(body.error ?? `workspace_root_failed_${res.status}`);
  }
  return body.root;
}

if (process.platform === "darwin") {
  app.setName(APP_DISPLAY_NAME);
}

async function createWindow(): Promise<void> {
  const preloadPath = join(__dirname, "../preload/preload.cjs");
  const icon = resolveBrandIcon();
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: APP_DISPLAY_NAME,
    ...(icon ? { icon } : {}),
    // 自定义标题栏（设计文档：web/docs/desktop-titlebar-design.md）
    // - 全平台：titleBarStyle:'hidden' 隐藏窗口标题文字
    //   · macOS：自动保留左上角交通灯，体验不变
    //   · Win/Linux：完全无系统标题栏；下方 titleBarOverlay 加回三件套；
    //     渲染层 DesktopTitleBar 在 36px 条内自绘 File/Edit/View/Window/Help
    //     5 个菜单按钮，点击通过 IPC 弹出原生 Menu.popup（VSCode 同款做法）
    titleBarStyle: "hidden",
    ...(process.platform !== "darwin"
      ? {
          titleBarOverlay: {
            color: "#faf9f5", // surface · 羊皮纸
            symbolColor: "#5e5d59", // fg-secondary
            height: 36,
          },
        }
      : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle(APP_DISPLAY_NAME);
  });

  win.webContents.on("preload-error", (_event, path, error) => {
    console.error("[desktop] preload failed:", path, error);
  });

  const url = await resolveWebAppUrl();
  try {
    await win.loadURL(url);
  } catch (err) {
    console.error("[desktop] failed to load", url, err);
    throw err;
  }
  win.setTitle(APP_DISPLAY_NAME);
  applyBrandIcon();

  if (process.env.JLC_DESKTOP_DEVTOOLS === "1") {
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  installDesktopBranding();

  ipcMain.handle("desktop:pick-and-import", async () => pickAndImportFolder());
  ipcMain.handle("desktop:companion-health", async () => getCompanionHealth());

  // V1.1 D1.1：Companion 自动启动 / 健康守护（desktop-v1.1-roadmap.md §3）
  // 模块级单例；start() 异步触发，状态变化通过 IPC 'companion:status' 广播
  const supervisor = getCompanionSupervisor();
  void supervisor.start();
  ipcMain.handle("companion:get-status", () => supervisor.getStatus());
  ipcMain.handle("companion:restart", async () => supervisor.restart());

  // 自定义标题栏内嵌菜单 — 渲染端按钮点击时 popup 原生菜单（VSCode 同款）
  ipcMain.handle("desktop:popup-menu", (event, input: unknown) => {
    if (!isRecord(input)) return { ok: false };
    const id = typeof input.id === "string" ? (input.id as TopMenuId) : null;
    const x = typeof input.x === "number" ? input.x : NaN;
    const y = typeof input.y === "number" ? input.y : NaN;
    if (!id || !TOP_MENU_IDS.includes(id) || !Number.isFinite(x) || !Number.isFinite(y)) {
      return { ok: false };
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    popupTopMenu(win, id, x, y);
    return { ok: true };
  });

  ipcMain.handle("desktop:show-item-in-folder", async (_event, input: unknown) => {
    const projectId =
      isRecord(input) && typeof input.projectId === "string"
        ? input.projectId.trim()
        : "";
    const relPath =
      isRecord(input) && typeof input.path === "string"
        ? input.path.trim()
        : "";
    if (!projectId || !relPath) {
      return { ok: false, message: "invalid_path" };
    }
    try {
      const root = await workspaceRootForProject(projectId);
      const filePath = resolveInside(root, relPath);
      if (!filePath) {
        return { ok: false, message: "invalid_path" };
      }
      shell.showItemInFolder(filePath);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error ? err.message : "show_item_in_folder_failed",
      };
    }
  });

  void createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  applyBrandIcon();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  applyBrandIcon();
  stopEmbeddedWebServer();
  // V1.1 D1.1：杀 supervisor 自己 spawn 的 Companion 子进程（external 进程不动）
  void getCompanionSupervisor().stop();
});

app.on("will-quit", () => {
  applyBrandIcon();
});

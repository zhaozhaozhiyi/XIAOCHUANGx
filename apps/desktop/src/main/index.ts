import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  APP_DISPLAY_NAME,
  applyBrandIcon,
  installDesktopBranding,
  resolveBrandIcon,
} from "./brand.js";
import { getCompanionHealth } from "./companion-health.js";
import { stopEmbeddedWebServer } from "./embedded-web.js";
import { pickAndImportFolder } from "./import-folder.js";
import { resolveWebAppUrl } from "./web-url.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
});

app.on("will-quit", () => {
  applyBrandIcon();
});

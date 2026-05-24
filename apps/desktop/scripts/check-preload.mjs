import { app, BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const preloadPath = join(__dirname, "../dist/preload/preload.cjs");

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.webContents.on("preload-error", (_e, path, err) => {
    console.error("preload-error", path, err);
  });

  win.webContents.on("did-finish-load", async () => {
    const result = await win.webContents.executeJavaScript(
      `({
        hasApi: typeof window.electronAPI !== "undefined",
        isDesktop: window.electronAPI?.isDesktop === true,
        pickType: typeof window.electronAPI?.pickAndImportFolder,
        userAgent: navigator.userAgent.includes("Electron"),
      })`,
    );
    console.log(JSON.stringify(result, null, 2));
    app.exit(result.hasApi ? 0 : 1);
  });

  await win.loadURL("http://localhost:3000");
});

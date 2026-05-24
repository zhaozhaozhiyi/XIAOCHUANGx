import { app, Menu, nativeImage, type MenuItemConstructorOptions } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_DISPLAY_NAME = "小窗";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedBrandIcon: Electron.NativeImage | undefined;

export function resolveBrandIcon(): Electron.NativeImage | undefined {
  if (cachedBrandIcon && !cachedBrandIcon.isEmpty()) return cachedBrandIcon;

  const iconNames =
    process.platform === "darwin"
      ? ["icon.png", "icon.icns"]
      : ["icon.png", "icon.ico"];
  const iconDirs = [
    join(__dirname, "../../build"),
    join(app.getAppPath(), "build"),
    process.resourcesPath,
  ];

  for (const dir of iconDirs) {
    for (const name of iconNames) {
      const path = join(dir, name);
      if (!existsSync(path)) continue;
      const image = nativeImage.createFromPath(path);
      if (!image.isEmpty()) {
        cachedBrandIcon = image;
        return image;
      }
    }
  }
  return undefined;
}

export function applyBrandIcon(): void {
  if (process.platform !== "darwin") return;
  const icon = resolveBrandIcon();
  if (icon) app.dock?.setIcon(icon);
}

export function installDesktopBranding(): void {
  app.setName(APP_DISPLAY_NAME);
  if (process.platform === "darwin") {
    applyBrandIcon();
    Menu.setApplicationMenu(Menu.buildFromTemplate(buildMacMenu()));
  }
}

function buildMacMenu(): MenuItemConstructorOptions[] {
  const appMenu: MenuItemConstructorOptions = {
    label: APP_DISPLAY_NAME,
    submenu: [
      { role: "about", label: `关于${APP_DISPLAY_NAME}` },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide", label: `隐藏${APP_DISPLAY_NAME}` },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit", label: `退出${APP_DISPLAY_NAME}` },
    ],
  };

  return [
    appMenu,
    { role: "editMenu" },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
}

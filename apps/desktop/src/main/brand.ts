import { app, Menu, nativeImage, type MenuItemConstructorOptions } from "electron";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerHiddenAccelerators } from "./shortcuts.js";

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
      if (image.isEmpty()) continue;
      // build/icon.svg 里图形被 translate(80 80) scale(0.84375) 裹了一圈
      // 80px 透明边，给 macOS Big Sur+ 的 squircle 蒙版让位（HIG 要求）。
      // Windows / Linux 的任务栏 / 标题栏 / Alt+Tab 不消费这层 padding，
      // 直接用会显得图形比同类应用小一圈，所以这里裁掉再交给 BrowserWindow。
      // mac 维持原图——dock/dmg 仍按 squircle 规则渲染。
      cachedBrandIcon = process.platform === "darwin" ? image : trimSquirclePadding(image);
      return cachedBrandIcon;
    }
  }
  return undefined;
}

/**
 * 从 1024×1024 的 padded 图里裁出 864×864 的实际图形并放回 256×256。
 * 16/32 这类小尺寸的 PNG 上 padding 只有 1–2 像素，直接裁会糊；
 * 从最大那张裁完再缩，质量稳定。失败兜底返回原图。
 */
function trimSquirclePadding(image: Electron.NativeImage): Electron.NativeImage {
  try {
    const { width, height } = image.getSize();
    if (width < 1024 || height < 1024) return image;
    const cropped = image.crop({ x: 80, y: 80, width: 864, height: 864 });
    if (cropped.isEmpty()) return image;
    const resized = cropped.resize({ width: 256, height: 256, quality: "best" });
    return resized.isEmpty() ? cropped : resized;
  } catch {
    return image;
  }
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
  } else {
    // Windows / Linux：用 visible:false 菜单保留快捷键，菜单栏不可见
    // 见 docs/design/desktop-titlebar-design.md §6.1 改动 2
    registerHiddenAccelerators();
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

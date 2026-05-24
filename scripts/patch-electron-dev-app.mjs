#!/usr/bin/env node
/**
 * macOS 开发态：复制 Electron.app 为「小窗.app」并替换图标与显示名，
 * 避免 desktop:dev 时 Dock/退出动画仍闪现默认 Electron 图标。
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const desktopDir = join(root, "apps/desktop");
const buildDir = join(desktopDir, "build");
const devAppDir = join(desktopDir, ".dev-electron");
const devAppPath = join(devAppDir, "小窗.app");
const stampPath = join(devAppDir, ".brand-stamp");

if (process.platform !== "darwin") {
  process.exit(0);
}

const require = createRequire(join(desktopDir, "package.json"));
/** require('electron') → …/Electron.app/Contents/MacOS/Electron */
const electronBin = require("electron");
const sourceApp = join(electronBin, "..", "..", "..");
const sourceIcon = join(buildDir, "icon.icns");
const plistPath = join(devAppPath, "Contents/Info.plist");
const targetIcon = join(devAppPath, "Contents/Resources/electron.icns");

function stamp() {
  const parts = [
    statSync(sourceApp).mtimeMs,
    existsSync(sourceIcon) ? statSync(sourceIcon).mtimeMs : 0,
  ];
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

function patchPlist() {
  for (const [key, value] of [
    ["CFBundleName", "小窗"],
    ["CFBundleDisplayName", "小窗"],
  ]) {
    execFileSync("plutil", ["-replace", key, "-string", value, plistPath]);
  }
}

function main() {
  if (!existsSync(sourceApp)) {
    console.warn("[patch-electron-dev-app] Electron.app not found, skip");
    process.exit(0);
  }
  if (!existsSync(sourceIcon)) {
    console.warn("[patch-electron-dev-app] build/icon.icns missing, run pnpm desktop:icons");
    process.exit(0);
  }

  const nextStamp = stamp();
  if (existsSync(stampPath) && readFileSync(stampPath, "utf8").trim() === nextStamp) {
    return;
  }

  mkdirSync(devAppDir, { recursive: true });
  rmSync(devAppPath, { recursive: true, force: true });
  execFileSync("ditto", [sourceApp, devAppPath]);
  copyFileSync(sourceIcon, targetIcon);
  patchPlist();

  writeFileSync(stampPath, nextStamp);
  console.log("[patch-electron-dev-app] ready:", devAppPath);
}

main();

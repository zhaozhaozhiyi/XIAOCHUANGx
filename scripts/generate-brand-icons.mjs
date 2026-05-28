#!/usr/bin/env node
/**
 * 从 apps/desktop/build/icon.svg 生成桌面壳与 Web 用图标。
 * 依赖：rsvg-convert（macOS 可用 brew install librsvg）；mac 上额外生成 .icns。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "apps/desktop/build/icon.svg");
const buildDir = join(root, "apps/desktop/build");
const webAppDir = join(root, "web/src/app");
const webPublicDir = join(root, "web/public");

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: "inherit" });
}

function hasCommand(cmd) {
  const check =
    process.platform === "win32"
      ? spawnSync("where.exe", [cmd], { stdio: "ignore" })
      : spawnSync("command", ["-v", cmd], { stdio: "ignore", shell: true });
  return check.status === 0;
}

function rsvg(size, out) {
  run("rsvg-convert", ["-w", String(size), "-h", String(size), svgPath, "-o", out]);
}

function normalizePng(path) {
  if (process.platform !== "darwin") return;
  run("sips", ["-s", "format", "png", path, "--out", path]);
}

if (!existsSync(svgPath)) {
  console.error("Missing source SVG:", svgPath);
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });
mkdirSync(webAppDir, { recursive: true });
mkdirSync(webPublicDir, { recursive: true });

const generatedAssets = [
  join(buildDir, "icon.png"),
  join(buildDir, "icon@512.png"),
  join(buildDir, "icon@256.png"),
  join(webAppDir, "apple-icon.png"),
  join(buildDir, "icon@32.png"),
  join(buildDir, "icon@16.png"),
  join(webAppDir, "icon.svg"),
  join(webPublicDir, "icon.svg"),
];

if (!hasCommand("rsvg-convert")) {
  if (generatedAssets.every((asset) => existsSync(asset))) {
    console.warn(
      "[generate-brand-icons] rsvg-convert not found; reusing existing generated icon assets.",
    );
    console.warn(
      "[generate-brand-icons] Install librsvg/rsvg-convert to refresh icons from apps/desktop/build/icon.svg.",
    );
    process.exit(0);
  }

  console.error(
    "Missing rsvg-convert and generated icon assets. Install librsvg/rsvg-convert, then rerun pnpm desktop:icons.",
  );
  process.exit(1);
}

rsvg(1024, join(buildDir, "icon.png"));
rsvg(512, join(buildDir, "icon@512.png"));
rsvg(256, join(buildDir, "icon@256.png"));
rsvg(180, join(webAppDir, "apple-icon.png"));
rsvg(32, join(buildDir, "icon@32.png"));
rsvg(16, join(buildDir, "icon@16.png"));

normalizePng(join(buildDir, "icon.png"));
normalizePng(join(buildDir, "icon@512.png"));
normalizePng(join(buildDir, "icon@256.png"));
normalizePng(join(webAppDir, "apple-icon.png"));
normalizePng(join(buildDir, "icon@32.png"));
normalizePng(join(buildDir, "icon@16.png"));

copyFileSync(svgPath, join(webAppDir, "icon.svg"));
copyFileSync(svgPath, join(webPublicDir, "icon.svg"));

if (process.platform === "darwin") {
  const iconset = join(buildDir, "icon.iconset");
  rmSync(iconset, { recursive: true, force: true });
  mkdirSync(iconset);

  const sizes = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];

  for (const [size, name] of sizes) {
    const out = join(iconset, name);
    rsvg(size, out);
    normalizePng(out);
  }

  try {
    run("iconutil", ["-c", "icns", iconset, "-o", join(buildDir, "icon.icns")]);
    rmSync(iconset, { recursive: true, force: true });
  } catch (error) {
    console.warn(
      "[generate-brand-icons] iconutil failed; keeping existing build/icon.icns and using refreshed PNG assets.",
    );
    console.warn(error instanceof Error ? error.message : String(error));
  }
}

console.log("Brand icons generated (Web uses src/app/icon.svg; Windows pack uses build/icon.png).");

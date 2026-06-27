#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const desktopDir = join(__dirname, "../apps/desktop");
const useBrandedApp = process.argv.includes("--branded-app");
const devAppBinary = join(
  desktopDir,
  ".dev-electron/小窗.app/Contents/MacOS/Electron",
);
const require = createRequire(join(desktopDir, "package.json"));
const defaultElectron = require("electron");

const electronBin =
  useBrandedApp && existsSync(devAppBinary) ? devAppBinary : defaultElectron;

const child = spawn(electronBin, ["."], {
  cwd: desktopDir,
  stdio: "inherit",
  env: {
    ...process.env,
    JLC_DESKTOP_DEV: "1",
    JLC_WEB_URL: process.env.JLC_WEB_URL ?? "http://localhost:3000",
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

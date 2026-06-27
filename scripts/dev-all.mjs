#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const isWin = process.platform === "win32";
const rootDir = process.cwd();
const webLockPath = join(rootDir, "web/.next/dev/lock");
const npmExecPath =
  process.env.npm_execpath && process.env.npm_execpath.trim()
    ? process.env.npm_execpath
    : null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function color(label) {
  const palette = [
    "\x1b[36m",
    "\x1b[35m",
    "\x1b[32m",
    "\x1b[33m",
    "\x1b[34m",
  ];
  let hash = 0;
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}

function prefixLines(label, stream) {
  const hue = color(label);
  const reset = "\x1b[0m";
  const prefix = `${hue}[${label}]${reset} `;
  let buffered = "";

  stream.on("data", (chunk) => {
    buffered += String(chunk);
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? "";
    for (const line of lines) {
      process.stdout.write(`${prefix}${line}\n`);
    }
  });

  stream.on("end", () => {
    if (!buffered) return;
    process.stdout.write(`${prefix}${buffered}\n`);
    buffered = "";
  });
}

function spawnPnpm(label, script, extraEnv = {}) {
  const cmd = npmExecPath ? process.execPath : "pnpm";
  const args = npmExecPath ? [npmExecPath, "run", script] : ["run", script];
  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: "1",
      ...extraEnv,
    },
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWin && !npmExecPath,
  });

  prefixLines(label, child.stdout);
  prefixLines(label, child.stderr);
  return child;
}

async function waitForUrl(url, input = {}) {
  const timeoutMs = input.timeoutMs ?? 180_000;
  const intervalMs = input.intervalMs ?? 1_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(3_000, intervalMs)),
      });
      if (res.ok) return true;
    } catch {
      // keep waiting
    }
    await sleep(intervalMs);
  }
  return false;
}

function processExists(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function loadWebLock() {
  try {
    const raw = await readFile(webLockPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      pid: Number.isInteger(parsed?.pid) ? parsed.pid : null,
      appUrl:
        typeof parsed?.appUrl === "string" && parsed.appUrl.trim()
          ? parsed.appUrl.trim()
          : null,
      port: Number.isInteger(parsed?.port) ? parsed.port : null,
    };
  } catch {
    return null;
  }
}

async function cleanupStaleWebLock(lock) {
  if (lock?.pid && processExists(lock.pid)) {
    try {
      process.kill(lock.pid, "SIGTERM");
    } catch {
      // ignore
    }
    const started = Date.now();
    while (processExists(lock.pid) && Date.now() - started < 5_000) {
      await sleep(200);
    }
  }
  await rm(webLockPath, { force: true }).catch(() => {});
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0, signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode != null || child.killed) continue;
    try {
      child.kill(signal ?? "SIGTERM");
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 300).unref();
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => shutdown(0, sig));
}

async function main() {
  console.log("Starting API, Companion, Web, then Desktop...");

  const companionHealthUrl = "http://127.0.0.1:9477/v1/health";
  const apiHealthUrl = "http://localhost:3001/health";
  let webUrl = "http://localhost:3000";

  if (!(await waitForUrl(apiHealthUrl, { timeoutMs: 1_000, intervalMs: 250 }))) {
    const api = spawnPnpm("api", "dev:api");
    children.push(api);
    api.on("exit", (code, signal) => {
      if (shuttingDown) return;
      const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(`[dev] api exited unexpectedly (${detail})\n`);
      shutdown(code ?? 1, signal);
    });
  } else {
    console.log("[dev] Reusing existing API on http://localhost:3001");
  }

  if (
    !(await waitForUrl(companionHealthUrl, {
      timeoutMs: 1_000,
      intervalMs: 250,
    }))
  ) {
    const companion = spawnPnpm("companion", "companion:dev");
    children.push(companion);
    companion.on("exit", (code, signal) => {
      if (shuttingDown) return;
      const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(
        `[dev] companion exited unexpectedly (${detail})\n`,
      );
      shutdown(code ?? 1, signal);
    });
  } else {
    console.log("[dev] Reusing existing Companion on http://127.0.0.1:9477");
  }

  const defaultWebOk = await waitForUrl(webUrl, {
    timeoutMs: 1_000,
    intervalMs: 250,
  });
  if (!defaultWebOk) {
    const lock = await loadWebLock();
    if (lock?.appUrl) {
      const lockedWebOk = await waitForUrl(lock.appUrl, {
        timeoutMs: 1_500,
        intervalMs: 250,
      });
      if (lockedWebOk) {
        webUrl = lock.appUrl;
        console.log(`[dev] Reusing existing Web on ${webUrl}`);
      } else {
        console.log("[dev] Cleaning up stale Next dev lock before restart...");
        await cleanupStaleWebLock(lock);
      }
    }
  } else {
    console.log(`[dev] Reusing existing Web on ${webUrl}`);
  }

  if (!defaultWebOk && webUrl === "http://localhost:3000") {
    const web = spawnPnpm("web", "dev:web");
    children.push(web);
    web.on("exit", (code, signal) => {
      if (shuttingDown) return;
      const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(`[dev] web exited unexpectedly (${detail})\n`);
      shutdown(code ?? 1, signal);
    });
  }

  const [companionOk, webOk] = await Promise.all([
    waitForUrl(companionHealthUrl),
    waitForUrl(webUrl),
  ]);

  if (!companionOk || !webOk) {
    const missing = [
      !companionOk ? "Companion" : null,
      !webOk ? "Web" : null,
    ]
      .filter(Boolean)
      .join(" / ");
    throw new Error(`${missing} 未在预期时间内就绪`);
  }

  const desktop = spawnPnpm("desktop", "desktop:dev", { JLC_WEB_URL: webUrl });
  children.push(desktop);
  desktop.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal || (code ?? 0) !== 0) {
      const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      process.stderr.write(`[dev] desktop exited unexpectedly (${detail})\n`);
      shutdown(code ?? 1, signal);
      return;
    }
    shutdown(0);
  });
}

main().catch((err) => {
  process.stderr.write(
    `[dev] startup failed: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  shutdown(1);
});

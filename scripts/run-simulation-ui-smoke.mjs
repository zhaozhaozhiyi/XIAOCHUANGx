#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const tempRoot = await mkdtemp(join(tmpdir(), "xiaochuang-simulation-ui-"));
const companionDataDir = join(tempRoot, "companion-data");
const nextDistDir = ".next-simulation-smoke";
const nextDistPath = join(repoRoot, "web", nextDistDir);
const children = [];
let cleaningUp = false;

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((error) => {
        if (error) reject(error);
        else if (port) resolvePort(port);
        else reject(new Error("failed to allocate a local smoke-test port"));
      });
    });
  });
}

function childEnv(overrides = {}) {
  const env = {
    ...process.env,
    FORCE_COLOR: "0",
    ...overrides,
  };
  delete env.NO_COLOR;
  return env;
}

function start(label, args, env) {
  const child = spawn(pnpm, args, {
    cwd: repoRoot,
    env: childEnv(env),
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        if (line) process.stdout.write(`[simulation-ui:${label}] ${line}\n`);
      }
    });
  }
  return child;
}

function run(args, env) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(pnpm, args, {
      cwd: repoRoot,
      env: childEnv(env),
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`simulation UI smoke exited with ${signal ?? `code ${code}`}`));
    });
  });
}

async function waitForUrl(url, child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited before becoming ready: ${url} (code ${child.exitCode})`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw new Error(`timed out waiting for ${url}: ${lastError?.message ?? "unknown error"}`);
}

async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  try {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    child.kill("SIGTERM");
  }
  await Promise.race([
    exited,
    new Promise((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);
  if (child.exitCode === null) {
    try {
      if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      child.kill("SIGKILL");
    }
    await Promise.race([
      exited,
      new Promise((resolveWait) => setTimeout(resolveWait, 2_000)),
    ]);
  }
}

async function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  await Promise.all(children.reverse().map((child) => stop(child)));
  await Promise.all([
    rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
    rm(nextDistPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
  ]);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, async () => {
    await cleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

try {
  const [companionPort, webPort] = await Promise.all([
    availablePort(),
    availablePort(),
  ]);
  const companionUrl = `http://127.0.0.1:${companionPort}`;
  const webUrl = `http://127.0.0.1:${webPort}`;

  const companion = start(
    "companion",
    ["-C", "companion", "exec", "tsx", "src/index.ts"],
    {
      COMPANION_PORT: String(companionPort),
      COMPANION_DATA_DIR: companionDataDir,
      COMPANION_RUN_MODE: "simulate",
      SKILL_ORCHESTRATION_V2_ENABLED: "true",
    },
  );
  await waitForUrl(`${companionUrl}/v1/health`, companion);

  const web = start(
    "web",
    ["--filter", "web", "exec", "next", "dev", "--hostname", "127.0.0.1", "--port", String(webPort)],
    {
      PORT: String(webPort),
      CHAT_EXECUTION: "companion",
      COMPANION_BASE_URL: companionUrl,
      COMPANION_USE_MOCK: "false",
      HERMES_USE_MOCK: "true",
      NEXT_DIST_DIR: nextDistDir,
    },
  );
  await waitForUrl(`${webUrl}/api/app/identity`, web);

  await run(["--filter", "web", "exec", "node", "../scripts/smoke-simulation-ui.mjs"], {
    XIAOCHUANG_WEB_URL: webUrl,
    COMPANION_BASE_URL: companionUrl,
    COMPANION_DATA_DIR: companionDataDir,
  });
} finally {
  await cleanup();
}

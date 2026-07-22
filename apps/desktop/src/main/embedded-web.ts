import { type ChildProcess, spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { app } from "electron";
import { resolveElectronNodeRuntime } from "./electron-node-runtime.js";

let child: ChildProcess | null = null;
let startedUrl: string | null = null;

export const DEFAULT_EMBEDDED_WEB_PORT = 51247;

function standaloneResourceRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, "web-standalone");
  }
  return join(app.getAppPath(), "..", "..", "web", ".next", "standalone");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveStandaloneServerJs(): Promise<string | null> {
  const root = standaloneResourceRoot();
  const candidates = [
    join(root, "web", "server.js"),
    join(root, "server.js"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

export function resolveEmbeddedWebPort(
  value = process.env.JLC_DESKTOP_WEB_PORT,
): number {
  const parsed = Number.parseInt(value?.trim() ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65535
    ? parsed
    : DEFAULT_EMBEDDED_WEB_PORT;
}

async function isEmbeddedWebReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/app/identity`, {
      signal: AbortSignal.timeout(750),
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { appId?: unknown };
    return body.appId === "xiaochuang";
  } catch {
    return false;
  }
}

async function waitForEmbeddedWebReady(
  url: string,
  attempts = 120,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    if (await isEmbeddedWebReady(url)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function probeTcpReady(hostname: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ready: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };
    const socket = connect({ host: hostname, port });
    socket.setTimeout(500);
    socket.on("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      done(false);
    });
    socket.on("error", () => {
      /* retry */
      done(false);
    });
  });
}

/**
 * 打包态启动内嵌 Next standalone（与浏览器同一 web/ 构建产物）。
 * 使用 ELECTRON_RUN_AS_NODE 以 Electron Helper 充当 Node 运行时。
 */
export async function startEmbeddedWebServer(): Promise<string | null> {
  if (startedUrl) return startedUrl;

  const serverJs = await resolveStandaloneServerJs();
  if (!serverJs) {
    console.error("[desktop] embedded web server.js not found", {
      packaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      root: standaloneResourceRoot(),
    });
    return null;
  }

  const port = resolveEmbeddedWebPort();
  const cwd = dirname(serverJs);
  const hostname = "127.0.0.1";
  const url = `http://${hostname}:${port}`;
  const nodeRuntime = resolveElectronNodeRuntime();

  if (await probeTcpReady(hostname, port)) {
    if (await isEmbeddedWebReady(url)) {
      console.info("[desktop] reusing embedded web", { url });
      startedUrl = url;
      return url;
    }
    console.error("[desktop] embedded web port is occupied", { url });
    return null;
  }

  console.info("[desktop] starting embedded web", {
    serverJs,
    cwd,
    url,
    nodeRuntime,
  });

  const spawned = spawn(nodeRuntime, [serverJs], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: hostname,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  child = spawned;

  spawned.stderr?.on("data", (chunk: Buffer) => {
    console.error("[desktop] embedded web stderr:", chunk.toString("utf8"));
  });

  spawned.on("error", (err) => {
    console.error("[desktop] embedded web spawn failed:", err);
  });

  spawned.on("exit", (code, signal) => {
    console.warn("[desktop] embedded web exited", { code, signal });
    child = null;
    startedUrl = null;
  });

  const ready = await waitForEmbeddedWebReady(url);
  if (!ready) {
    console.error("[desktop] embedded web did not become ready", { url });
    stopEmbeddedWebServer();
    return null;
  }

  console.info("[desktop] embedded web ready", { url, pid: spawned.pid });
  startedUrl = url;
  return url;
}

export function stopEmbeddedWebServer(): void {
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
  child = null;
  startedUrl = null;
}

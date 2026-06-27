import { type ChildProcess, spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { app } from "electron";

let child: ChildProcess | null = null;
let startedUrl: string | null = null;

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

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port =
        typeof addr === "object" && addr !== null ? addr.port : 0;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForHttpReady(url: string, attempts = 60): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(`${url}/api/runtime/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok || res.status < 500) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

/**
 * 打包态启动内嵌 Next standalone（与浏览器同一 web/ 构建产物）。
 * 使用 ELECTRON_RUN_AS_NODE 以 Electron 二进制充当 Node 运行时。
 */
export async function startEmbeddedWebServer(): Promise<string | null> {
  if (startedUrl) return startedUrl;

  const serverJs = await resolveStandaloneServerJs();
  if (!serverJs) return null;

  const port = await findFreePort();
  const cwd = dirname(serverJs);
  const hostname = "127.0.0.1";
  const url = `http://${hostname}:${port}`;

  const spawned = spawn(process.execPath, [serverJs], {
    cwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: hostname,
      NODE_ENV: "production",
    },
    stdio: "ignore",
  });

  child = spawned;

  spawned.on("exit", () => {
    child = null;
    startedUrl = null;
  });

  const ready = await waitForHttpReady(url);
  if (!ready) {
    stopEmbeddedWebServer();
    return null;
  }

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

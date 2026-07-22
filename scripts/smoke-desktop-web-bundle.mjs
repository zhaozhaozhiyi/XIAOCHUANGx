#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = join(
  repoRoot,
  "apps",
  "desktop",
  "resources",
  "web-standalone",
);

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveServerJs() {
  for (const candidate of [
    join(bundleRoot, "web", "server.js"),
    join(bundleRoot, "server.js"),
  ]) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`prepared desktop server.js not found under ${bundleRoot}`);
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.on("error", reject);
  });
}

async function waitForPage(url, child, output) {
  let lastError = "not ready";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode != null) {
      throw new Error(
        `prepared desktop web exited (${child.exitCode})\n${output.join("")}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`prepared desktop web did not become ready: ${lastError}`);
}

function pageAssets(html) {
  const assets = new Set();
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const path = match[1];
    if (path.startsWith("/_next/static/")) assets.add(path);
  }
  return [...assets];
}

async function main() {
  const serverJs = await resolveServerJs();
  const port = await findFreePort();
  const origin = `http://127.0.0.1:${port}`;
  const output = [];
  const child = spawn(process.execPath, [serverJs], {
    cwd: dirname(serverJs),
    env: {
      ...process.env,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (chunk) => output.push(chunk.toString("utf8")));
  child.stderr?.on("data", (chunk) => output.push(chunk.toString("utf8")));

  try {
    const page = await waitForPage(`${origin}/login`, child, output);
    const html = await page.text();
    const assets = pageAssets(html);
    if (!assets.some((path) => path.endsWith(".css"))) {
      throw new Error("prepared desktop login page does not reference CSS");
    }
    if (!assets.some((path) => path.endsWith(".js"))) {
      throw new Error("prepared desktop login page does not reference JavaScript");
    }

    for (const path of assets) {
      const response = await fetch(`${origin}${path}`);
      if (!response.ok) {
        throw new Error(`prepared desktop asset ${path} returned ${response.status}`);
      }
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) {
        throw new Error(`prepared desktop asset ${path} is empty`);
      }
    }

    console.log(
      `desktop web smoke: PASS /login + ${assets.length} static assets (${origin})`,
    );
  } finally {
    if (child.exitCode == null) child.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

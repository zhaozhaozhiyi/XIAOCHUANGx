#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const repoRoot = resolve(process.cwd(), "..");
const playwrightTest = await import(
  new URL("../web/node_modules/@playwright/test/index.js", import.meta.url)
);
const { chromium } = playwrightTest.default;
const skillDir = resolve(repoRoot, "skills/skill-vp-web-video-presentation");
const scaffold = join(skillDir, "scripts/scaffold.sh");
const root = mkdtempSync(join(tmpdir(), "xiaochuang-video-reel-"));
const presentationDir = join(root, "presentation");
const port = Number(process.env.VIDEO_REEL_SMOKE_PORT ?? 5184);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result;
}

function startDevServer() {
  return spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: presentationDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

async function readReelState(page) {
  return page.evaluate(() => {
    const label = document.querySelector(".reel-label")?.textContent?.trim() ?? "";
    const fills = [...document.querySelectorAll(".reel-seg-fill")].map((node) =>
      Number.parseFloat((node instanceof HTMLElement ? node.style.width : "0").replace("%", "")),
    );
    return {
      label,
      fills,
      paused: Boolean(document.querySelector(".reel-paused")),
      ended: Boolean(document.querySelector(".reel-ended")),
      overlay: Boolean(document.querySelector(".reel-overlay")),
      sceneText: document.querySelector(".scene")?.textContent ?? "",
    };
  });
}

async function main() {
  run("bash", [scaffold, presentationDir, "--theme=midnight-press"]);
  writeFileSync(
    join(presentationDir, "src/chapters/01-example/narrations.ts"),
    [
      'import type { Narration } from "../../registry/types";',
      "",
      "export const narrations: Narration[] = [",
      '  "一",',
      '  "二",',
      '  "三",',
      "];",
      "",
    ].join("\n"),
  );

  const server = startDevServer();
  let stderr = "";
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  let browser;
  try {
    await waitForHttp(`http://127.0.0.1:${port}/?reel=1`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/?reel=1`);
    await page.waitForSelector(".reel-shell .scene");

    const initial = await readReelState(page);
    if (!initial.sceneText.trim()) {
      throw new Error("reel initial scene did not render visible text");
    }

    await page.waitForFunction(() => {
      const fill = document.querySelector(".reel-seg-fill");
      if (!(fill instanceof HTMLElement)) return false;
      return Number.parseFloat(fill.style.width.replace("%", "")) > 15;
    });

    await page.locator(".reel-frame").click({ position: { x: 640, y: 360 } });
    const advanced = await readReelState(page);
    if (advanced.fills[0] !== 100 && !advanced.sceneText.includes("02")) {
      throw new Error("reel click-to-advance did not move to the next step");
    }

    await page.getByRole("button", { name: "暂停" }).click();
    const paused = await readReelState(page);
    if (!paused.paused || !paused.overlay) {
      throw new Error("reel pause control did not expose paused overlay");
    }

    await page.locator(".reel-overlay").click();
    await page.waitForSelector(".reel-overlay", { state: "detached" });

    await page.locator(".reel-seg").nth(2).click();
    await page.waitForTimeout(100);
    const jumped = await readReelState(page);
    if (!jumped.sceneText.includes("Replace this with")) {
      throw new Error("reel progress segment jump did not render step 3");
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "reel",
          url: `http://127.0.0.1:${port}/?reel=1`,
          checks: ["auto-progress", "pause", "click-advance", "progress-jump"],
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
    if (!process.env.KEEP_VIDEO_SMOKE) rmSync(root, { recursive: true, force: true });
    if (!existsSync(presentationDir) && stderr.trim() && process.env.DEBUG_VIDEO_SMOKE) {
      console.error(stderr);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

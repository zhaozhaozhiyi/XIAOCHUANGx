#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
const root = mkdtempSync(join(tmpdir(), "xiaochuang-video-auto-"));
const presentationDir = join(root, "presentation");
const port = Number(process.env.VIDEO_AUTO_SMOKE_PORT ?? 5185);

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

async function main() {
  run("bash", [scaffold, presentationDir, "--theme=midnight-press"]);
  writeFileSync(
    join(presentationDir, "src/chapters/01-example/narrations.ts"),
    [
      'import type { Narration } from "../../registry/types";',
      "",
      "export const narrations: Narration[] = [",
      '  "",',
      '  "",',
      '  "",',
      "];",
      "",
    ].join("\n"),
  );

  const server = startDevServer();
  let browser;
  try {
    await waitForHttp(`http://127.0.0.1:${port}/?auto=1`);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://127.0.0.1:${port}/?auto=1`);

    await page.waitForSelector(".auto-gate");
    await page.getByText("Press SPACE to start").waitFor();
    await page.locator(".at-btn.at-auto .at-label", { hasText: "AUTO" }).waitFor();

    const beforeStart = await page.locator(".scene").textContent();
    await page.keyboard.press("Space");
    await page.waitForSelector(".auto-gate", { state: "detached" });

    await page.waitForFunction(() => {
      const text = document.querySelector(".scene")?.textContent ?? "";
      return text.includes("02") || text.includes("Replace this with");
    });
    const afterStart = await page.locator(".scene").textContent();
    if (beforeStart === afterStart) {
      throw new Error("auto mode did not advance after SPACE start without audio");
    }

    await page.keyboard.press("KeyM");
    await page.waitForFunction(() => {
      const params = new URL(window.location.href).searchParams;
      return !params.has("audio") && !params.has("auto");
    });
    await page.locator(".at-btn.at-manual .at-label", { hasText: "MANUAL" }).waitFor();
    await page.keyboard.press("KeyM");
    await page.waitForFunction(() => new URL(window.location.href).searchParams.get("audio") === "1");
    await page.locator(".at-btn.at-audio .at-label", { hasText: "AUDIO" }).waitFor();

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "auto",
          url: `http://127.0.0.1:${port}/?auto=1`,
          checks: ["auto-gate", "space-start", "silent-audio-fallback", "mode-cycle"],
        },
        null,
        2,
      ),
    );
  } finally {
    if (browser) await browser.close();
    server.kill("SIGTERM");
    if (!process.env.KEEP_VIDEO_SMOKE) rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

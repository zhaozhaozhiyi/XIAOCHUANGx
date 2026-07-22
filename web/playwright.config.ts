import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
const configuredWorkers = Number(process.env.PLAYWRIGHT_WORKERS ?? 1);
const workers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : 1;

const chromePath =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

const hasChrome = fs.existsSync(chromePath);
const webServerEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    PORT: String(PORT),
    CHAT_EXECUTION: "companion",
    COMPANION_USE_MOCK: "true",
    HERMES_USE_MOCK: "true",
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-playwright",
    NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW: "1",
    FORCE_COLOR: "0",
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

delete webServerEnv.NO_COLOR;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  workers,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: hasChrome
      ? {
          executablePath: chromePath,
        }
      : undefined,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    cwd: ".",
    env: webServerEnv,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});

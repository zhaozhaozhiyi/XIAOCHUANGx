import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

const chromePath =
  process.env.PLAYWRIGHT_CHROME_PATH ??
  (process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");

const hasChrome = fs.existsSync(chromePath);
const webServerEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    CHAT_EXECUTION: "companion",
    COMPANION_USE_MOCK: "true",
    HERMES_USE_MOCK: "true",
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
    command: "npm run dev",
    url: baseURL,
    cwd: ".",
    env: webServerEnv,
    reuseExistingServer: !process.env.CI,
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

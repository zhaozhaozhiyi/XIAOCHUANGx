#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const skillDir = resolve(repoRoot, "skills/skill-vp-web-video-presentation");
const scaffold = join(skillDir, "scripts/scaffold.sh");
const root = mkdtempSync(join(tmpdir(), "xiaochuang-video-p0-"));
const sessionDir = join(root, "视频", "smoke-session");
const presentationDir = join(sessionDir, "presentation");

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

try {
  run("mkdir", ["-p", sessionDir]);
  writeFileSync(
    join(sessionDir, "script.md"),
    "# 小窗产品介绍视频\n\n小窗让研究、写作、演示和视频交付连在一个工作区里完成。\n",
  );
  writeFileSync(
    join(sessionDir, "outline.md"),
    "# 小窗产品介绍视频 outline\n\n1. 开场钩子\n   - 研究到交付不再割裂\n2. 能力展示\n   - 对话、写作、PPT、3D 与视频闭环\n",
  );

  run("bash", [scaffold, presentationDir, "--theme=midnight-press"]);
  run("npx", ["tsc", "--noEmit"], { cwd: presentationDir });

  const required = [
    join(sessionDir, "script.md"),
    join(sessionDir, "outline.md"),
    join(presentationDir, "package.json"),
    join(presentationDir, "src/components/ReelPlayer.tsx"),
    join(presentationDir, "src/components/ReelPlayer.css"),
  ];
  for (const file of required) {
    if (!existsSync(file)) {
      throw new Error(`missing expected file: ${file}`);
    }
  }

  const app = readFileSync(join(presentationDir, "src/App.tsx"), "utf8");
  if (!app.includes("?reel=1") && !app.includes("isReelMode")) {
    throw new Error("generated App.tsx does not expose reel mode");
  }
  const autoHook = readFileSync(join(presentationDir, "src/hooks/useAutoMode.ts"), "utf8");
  if (!autoHook.includes("auto=1")) {
    throw new Error("generated useAutoMode.ts does not expose auto mode");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        sessionDir,
        files: ["script.md", "outline.md", "presentation/package.json"],
        preview: "http://localhost:5174/?reel=1",
        recording: "http://localhost:5174/?auto=1",
      },
      null,
      2,
    ),
  );
} finally {
  if (!process.env.KEEP_VIDEO_SMOKE) {
    rmSync(root, { recursive: true, force: true });
  }
}

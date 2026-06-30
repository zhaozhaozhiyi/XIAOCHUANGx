/**
 * D1.4 Companion 捆绑（desktop-v1.1-roadmap.md §6）— prepare 阶段
 *
 * 把以下三个产物镜像到 apps/desktop/resources/，供 electron-builder
 * extraResources 打入安装包：
 *   1) companion/dist-bin/companion.cjs      → resources/companion/companion.cjs
 *   2) skills/                                → resources/skills/
 *   3) prompts/                               → resources/prompts/
 *
 * 设计取舍：
 *  - 不打 Node 单二进制：用 esbuild 把 companion ESM 跨包打包为单 CJS
 *    （≈ 数百 KB），运行时由 Electron 主进程通过 ELECTRON_RUN_AS_NODE=1
 *    + spawn(process.execPath, [bundle.cjs]) 跑成 Node。理由见
 *    docs/plans/desktop-d1.4-bundle-status.md（与 roadmap §6.3 写的
 *    pkg/nexe 路线偏离的明确决策）。
 *  - skills/ + prompts/ 不进 bundle：让用户能就地查看/修改；体积也
 *    省 ≈ 12MB；通过 supervisor 注入 JLC_SKILLS_DIR / JLC_PROMPTS_DIR
 *    env 让 runtime-core/paths.ts 找到。
 *  - 整个 dest 目录每次清空重写：避免上一次残留旧 skill。
 */
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const bundleSrc = join(repoRoot, "companion", "dist-bin", "companion.cjs");
const skillsSrc = join(repoRoot, "skills");
const promptsSrc = join(repoRoot, "prompts");

const desktopResources = join(repoRoot, "apps", "desktop", "resources");
const companionDest = join(desktopResources, "companion");
const skillsDest = join(desktopResources, "skills");
const promptsDest = join(desktopResources, "prompts");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(bundleSrc))) {
    console.error(
      `缺少 ${bundleSrc}，请先执行: pnpm --filter @jlcresearch/companion bundle`,
    );
    process.exit(1);
  }
  if (!(await exists(skillsSrc))) {
    console.error(`缺少 ${skillsSrc}`);
    process.exit(1);
  }
  if (!(await exists(promptsSrc))) {
    console.error(`缺少 ${promptsSrc}`);
    process.exit(1);
  }

  // 1) companion bundle —— 整目录干净重建（dist 里只会有 .cjs 一个文件）
  await rm(companionDest, { recursive: true, force: true });
  await mkdir(companionDest, { recursive: true });
  await cp(bundleSrc, join(companionDest, "companion.cjs"));

  // 2) skills/ —— 整树同步；保留 .json 索引（chat-catalog 等）
  await rm(skillsDest, { recursive: true, force: true });
  await mkdir(dirname(skillsDest), { recursive: true });
  await cp(skillsSrc, skillsDest, { recursive: true });

  // 3) prompts/ —— 整树同步
  await rm(promptsDest, { recursive: true, force: true });
  await mkdir(dirname(promptsDest), { recursive: true });
  await cp(promptsSrc, promptsDest, { recursive: true });

  console.log("desktop companion bundle:", companionDest);
  console.log("desktop skills mirror   :", skillsDest);
  console.log("desktop prompts mirror  :", promptsDest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

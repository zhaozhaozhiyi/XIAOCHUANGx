/**
 * 将 web/ 的 Next standalone 产物复制到 apps/desktop/resources/web-standalone
 * 供 electron-builder extraResources 与打包态内嵌 Web 服务使用。
 */
import { access, cp, lstat, mkdir, readlink, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(repoRoot, "web");
const standaloneSrc = join(webDir, ".next", "standalone");
const staticSrc = join(webDir, ".next", "static");
const publicSrc = join(webDir, "public");
const dest = join(repoRoot, "apps", "desktop", "resources", "web-standalone");

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(standaloneSrc))) {
    console.error(
      "缺少 web/.next/standalone，请先执行: pnpm --filter web build",
    );
    process.exit(1);
  }

  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(standaloneSrc, dest, { recursive: true, verbatimSymlinks: true });

  const appRoot = (await exists(join(dest, "web")))
    ? join(dest, "web")
    : dest;

  if (await exists(staticSrc)) {
    const staticDest = join(appRoot, ".next", "static");
    await mkdir(dirname(staticDest), { recursive: true });
    await cp(staticSrc, staticDest, { recursive: true, verbatimSymlinks: true });
  }

  if (await exists(publicSrc)) {
    await cp(publicSrc, join(appRoot, "public"), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  const nextLink = join(appRoot, "node_modules", "next");
  if ((await exists(nextLink)) && (await lstat(nextLink)).isSymbolicLink()) {
    const target = resolve(dirname(nextLink), await readlink(nextLink));
    await rm(nextLink, { recursive: true, force: true });
    await cp(target, nextLink, { recursive: true, verbatimSymlinks: true });
  }

  console.log("desktop web bundle:", dest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

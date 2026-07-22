/**
 * 将 web/ 的 Next standalone 产物复制到 apps/desktop/resources/web-standalone
 * 供 electron-builder extraResources 与打包态内嵌 Web 服务使用。
 */
import { access, cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = join(repoRoot, "web");
const nextDistDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const nextOutputDir = join(webDir, nextDistDir);
const standaloneSrc = join(nextOutputDir, "standalone");
const staticSrc = join(nextOutputDir, "static");
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

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function copyPackage(source, targetNodeModules, packageName, copied) {
  if (copied.has(packageName) || !(await isDirectory(source))) {
    return false;
  }

  const target = join(targetNodeModules, ...packageName.split("/"));
  await mkdir(dirname(target), { recursive: true });
  await rm(target, { recursive: true, force: true });
  await cp(source, target, { recursive: true, dereference: true });
  copied.add(packageName);
  return true;
}

async function materializePnpmStore(sourceNodeModules, targetNodeModules) {
  const store = join(sourceNodeModules, ".pnpm");
  if (!(await exists(store))) {
    return 0;
  }

  await mkdir(targetNodeModules, { recursive: true });

  const copied = new Set();
  for (const storeEntry of await readdir(store, { withFileTypes: true })) {
    if (!storeEntry.isDirectory() || storeEntry.name === "node_modules") {
      continue;
    }

    const packageNodeModules = join(store, storeEntry.name, "node_modules");
    if (!(await exists(packageNodeModules))) {
      continue;
    }

    for (const packageEntry of await readdir(packageNodeModules, {
      withFileTypes: true,
    })) {
      if (packageEntry.name.startsWith(".")) {
        continue;
      }

      const packageSource = join(packageNodeModules, packageEntry.name);
      if (packageEntry.name.startsWith("@")) {
        if (!(await isDirectory(packageSource))) {
          continue;
        }

        for (const scopedEntry of await readdir(packageSource, {
          withFileTypes: true,
        })) {
          if (scopedEntry.name.startsWith(".")) {
            continue;
          }

          await copyPackage(
            join(packageSource, scopedEntry.name),
            targetNodeModules,
            `${packageEntry.name}/${scopedEntry.name}`,
            copied,
          );
        }
        continue;
      }

      await copyPackage(
        packageSource,
        targetNodeModules,
        packageEntry.name,
        copied,
      );
    }
  }

  return copied.size;
}

async function main() {
  if (!(await exists(standaloneSrc))) {
    console.error(
      `缺少 ${standaloneSrc}，请先执行: pnpm --filter web build`,
    );
    process.exit(1);
  }

  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(standaloneSrc, dest, { recursive: true, verbatimSymlinks: true });

  const appRoot = (await exists(join(dest, "web")))
    ? join(dest, "web")
    : dest;

  const materializedPackages = await materializePnpmStore(
    join(dest, "node_modules"),
    join(appRoot, "node_modules"),
  );

  if (appRoot !== dest) {
    await rm(join(dest, "node_modules"), { recursive: true, force: true });
  }

  if (await exists(staticSrc)) {
    const staticDest = join(appRoot, nextDistDir, "static");
    await mkdir(dirname(staticDest), { recursive: true });
    await cp(staticSrc, staticDest, { recursive: true, verbatimSymlinks: true });
  }

  if (await exists(publicSrc)) {
    await cp(publicSrc, join(appRoot, "public"), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }

  console.log("desktop web bundle:", dest);
  console.log("materialized packages:", materializedPackages);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

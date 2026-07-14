#!/usr/bin/env node
/**
 * Attach the product icon to generated .dmg files so Finder shows the brand
 * icon for the installer file itself, not only for the mounted volume.
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const desktopDir = join(repoRoot, "apps", "desktop");
const releaseDir = join(desktopDir, "release");
const iconPng = join(desktopDir, "build", "icon.png");
const desktopPackageJson = JSON.parse(
  readFileSync(join(desktopDir, "package.json"), "utf8"),
);

function hasCommand(command) {
  try {
    execFileSync("command", ["-v", command], {
      shell: true,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

function resolveTargets() {
  const explicit = process.argv.slice(2);
  if (explicit.length > 0) {
    return explicit.map((path) => resolve(process.cwd(), path));
  }

  const version = desktopPackageJson.version;
  const expected = join(releaseDir, `小窗-macos-${version}.dmg`);
  if (existsSync(expected)) {
    return [expected];
  }

  if (!existsSync(releaseDir)) {
    return [];
  }

  return readdirSync(releaseDir)
    .filter((name) => name.endsWith(".dmg") && name.includes(version))
    .map((name) => join(releaseDir, name));
}

function stampIcon(target, resourceFile) {
  if (!existsSync(target)) {
    throw new Error(`DMG not found: ${target}`);
  }

  run("Rez", ["-append", resourceFile, "-o", target]);
  run("SetFile", ["-a", "C", target]);
  console.log("stamped dmg icon:", target);
}

if (process.platform !== "darwin") {
  console.log("[stamp-dmg-file-icon] skipped: macOS only");
  process.exit(0);
}

const requiredCommands = ["sips", "DeRez", "Rez", "SetFile"];
const missingCommands = requiredCommands.filter((command) => !hasCommand(command));
if (missingCommands.length > 0) {
  console.warn(
    `[stamp-dmg-file-icon] skipped: missing ${missingCommands.join(", ")}`,
  );
  process.exit(0);
}

if (!existsSync(iconPng)) {
  throw new Error(`Icon PNG not found: ${iconPng}`);
}

const targets = resolveTargets();
if (targets.length === 0) {
  throw new Error("No DMG files found to stamp");
}

const tempDir = mkdtempSync(join(tmpdir(), "xiaochuang-dmg-icon-"));
try {
  const tempIcon = join(tempDir, "icon.png");
  const resourceFile = join(tempDir, "icon.rsrc");
  copyFileSync(iconPng, tempIcon);
  run("sips", ["-i", tempIcon], { stdio: "ignore" });
  writeFileSync(
    resourceFile,
    execFileSync("DeRez", ["-only", "icns", tempIcon], {
      maxBuffer: 16 * 1024 * 1024,
    }),
  );

  for (const target of targets) {
    stampIcon(target, resourceFile);
  }
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

/**
 * Prepare product-managed OpenSCAD runtime resources for desktop packaging.
 *
 * This script copies an OpenSCAD app bundle, directory, or executable into:
 *
 *   apps/desktop/resources/engines/openscad/{platform}/
 *
 * Release builds should provide JLC_OPENSCAD_SOURCE or JLC_OPENSCAD_BIN,
 * JLC_OPENSCAD_LICENSES_DIR, and set JLC_OPENSCAD_REQUIRED=1. Development
 * builds are soft by default: when no runtime is available, the script writes a
 * missing marker so packaging can continue while the UI reports
 * `openscad_runtime_missing`.
 */
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import {
  access,
  chmod,
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.env.JLC_OPENSCAD_PLATFORM || process.platform;
const destRoot = join(
  repoRoot,
  "apps",
  "desktop",
  "resources",
  "engines",
  "openscad",
  platform,
);
const checkOnly = process.argv.includes("--check");
const required =
  process.argv.includes("--required") || process.env.JLC_OPENSCAD_REQUIRED === "1";
const licensesSource = process.env.JLC_OPENSCAD_LICENSES_DIR?.trim();
const distUrl = process.env.JLC_OPENSCAD_DIST_URL?.trim();
const distSha256 = process.env.JLC_OPENSCAD_DIST_SHA256?.trim();
const sourceCodeUrl = process.env.JLC_OPENSCAD_SOURCE_CODE_URL?.trim();

function binaryName() {
  return platform === "win32" ? "openscad.exe" : "openscad";
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function canExecute(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function whichOpenScad() {
  if (process.env.JLC_OPENSCAD_ALLOW_PATH !== "1") return null;
  const command = platform === "win32" ? "where" : "which";
  try {
    const result = await execFileAsync(command, ["openscad"], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    return result.stdout.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

async function resolveSource() {
  const explicitSource = process.env.JLC_OPENSCAD_SOURCE?.trim();
  if (explicitSource && (await exists(explicitSource))) {
    return { path: resolve(explicitSource), source: "JLC_OPENSCAD_SOURCE" };
  }

  const explicitBin = process.env.JLC_OPENSCAD_BIN?.trim();
  if (explicitBin && (await canExecute(explicitBin))) {
    return { path: resolve(explicitBin), source: "JLC_OPENSCAD_BIN" };
  }

  if (platform === "darwin") {
    const app = "/Applications/OpenSCAD.app";
    if (await exists(app)) return { path: app, source: "macOS Applications" };
  }

  const pathBin = await whichOpenScad();
  if (pathBin && (await canExecute(pathBin))) {
    return { path: pathBin, source: "PATH development fallback" };
  }

  return null;
}

function isMacApp(path) {
  return platform === "darwin" && extname(path).toLowerCase() === ".app";
}

async function macBundleExecutable(appPath) {
  const plistPath = join(appPath, "Contents", "Info.plist");
  const plist = await readFile(plistPath, "utf8").catch(() => "");
  const match = plist.match(
    /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/,
  );
  return match?.[1]?.trim() || "OpenSCAD";
}

async function runtimeCommandForCopiedPath(copiedPath) {
  if (isMacApp(copiedPath)) {
    return join(copiedPath, "Contents", "MacOS", await macBundleExecutable(copiedPath));
  }
  const info = await stat(copiedPath);
  if (info.isDirectory()) {
    const direct = join(copiedPath, binaryName());
    if (await exists(direct)) return direct;
    const appPath = join(copiedPath, "OpenSCAD.app");
    const app = join(
      appPath,
      "Contents",
      "MacOS",
      await macBundleExecutable(appPath),
    );
    if (await exists(app)) return app;
  }
  return copiedPath;
}

async function readVersion(command) {
  try {
    const result = await execFileAsync(command, ["--version"], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    return output.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function writeSourceAvailability(licensesDir) {
  if (!sourceCodeUrl) return false;
  await writeFile(
    join(licensesDir, "SOURCE_AVAILABILITY.md"),
    [
      "# OpenSCAD Source Availability",
      "",
      "OpenSCAD is bundled as an independent runtime component.",
      "",
      `- Upstream/source URL: ${sourceCodeUrl}`,
      distUrl ? `- Runtime distribution URL: ${distUrl}` : null,
      distSha256 ? `- Runtime distribution SHA256: ${distSha256}` : null,
      "",
      "Keep this notice together with the packaged runtime and upstream license",
      "materials. Do not merge OpenSCAD source code into closed-source product",
      "code.",
      "",
    ]
      .filter(Boolean)
      .join("\n"),
    "utf8",
  );
  return true;
}

async function copyLicenseNotices() {
  const licensesDir = join(destRoot, "LICENSES");
  if (licensesSource && (await exists(licensesSource))) {
    await rm(licensesDir, { recursive: true, force: true });
    await cp(resolve(licensesSource), licensesDir, { recursive: true });
    const sourceAvailabilityWritten = await writeSourceAvailability(licensesDir);
    return {
      source: resolve(licensesSource),
      placeholder: false,
      sourceAvailabilityWritten,
    };
  }

  if (required) {
    throw new Error(
      "OpenSCAD license notices are required. Set JLC_OPENSCAD_LICENSES_DIR.",
    );
  }

  await mkdir(licensesDir, { recursive: true });
  await writeFile(
    join(licensesDir, "README.md"),
    [
      "# OpenSCAD License Notices",
      "",
      "Place OpenSCAD upstream license notices, source availability notes,",
      "copyright statements, and third-party dependency attributions here.",
      "",
      "Do not ship a production desktop build without completing this folder.",
      "",
    ].join("\n"),
    "utf8",
  );
  const sourceAvailabilityWritten = await writeSourceAvailability(licensesDir);
  return { source: null, placeholder: true, sourceAvailabilityWritten };
}

async function writeMissingMarker() {
  await rm(destRoot, { recursive: true, force: true });
  await mkdir(destRoot, { recursive: true });
  await writeFile(
    join(destRoot, "MISSING_RUNTIME.md"),
    [
      "# OpenSCAD Runtime Missing",
      "",
      "No product-managed OpenSCAD runtime was provided during preparation.",
      "",
      "Set `JLC_OPENSCAD_SOURCE` to an OpenSCAD app bundle/directory, or set",
      "`JLC_OPENSCAD_BIN` to an executable. For release builds, set",
      "`JLC_OPENSCAD_REQUIRED=1` so this condition fails packaging.",
      "",
    ].join("\n"),
    "utf8",
  );
}

async function main() {
  const source = await resolveSource();
  if (checkOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          checkOnly: true,
          platform,
          destRoot,
          source,
          required,
          licensesSource: licensesSource ? resolve(licensesSource) : null,
          licensesAvailable: licensesSource ? await exists(licensesSource) : false,
          distUrl: distUrl || null,
          distSha256: distSha256 || null,
          sourceCodeUrl: sourceCodeUrl || null,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!source) {
    if (required) {
      console.error(
        "OpenSCAD runtime is required. Set JLC_OPENSCAD_SOURCE or JLC_OPENSCAD_BIN.",
      );
      process.exit(1);
    }
    await writeMissingMarker();
    console.warn("OpenSCAD runtime missing; wrote marker:", destRoot);
    return;
  }

  await rm(destRoot, { recursive: true, force: true });
  await mkdir(destRoot, { recursive: true });

  const sourceInfo = await stat(source.path);
  const targetName =
    isMacApp(source.path)
      ? basename(source.path)
      : sourceInfo.isDirectory()
        ? "OpenSCAD"
        : binaryName();
  const copiedPath = join(destRoot, targetName);

  if (isMacApp(source.path)) {
    await execFileAsync("ditto", [source.path, copiedPath], {
      timeout: 60_000,
      maxBuffer: 1024 * 1024,
    });
  } else {
    await cp(source.path, copiedPath, {
      recursive: sourceInfo.isDirectory(),
      dereference: true,
    });
  }
  if (!(await exists(copiedPath))) {
    throw new Error(`OpenSCAD runtime copy failed: ${copiedPath}`);
  }
  const runtimeCommand = await runtimeCommandForCopiedPath(copiedPath);
  if (!(await exists(runtimeCommand))) {
    throw new Error(`OpenSCAD runtime command missing after copy: ${runtimeCommand}`);
  }
  if (platform !== "win32" && (await exists(runtimeCommand))) {
    await chmod(runtimeCommand, 0o755).catch(() => {});
  }

  const version = await readVersion(runtimeCommand);
  await writeFile(
    join(destRoot, "VERSION.txt"),
    [
      `version=${version}`,
      `source=${source.source}`,
      `sourcePath=${source.path}`,
      `runtimeCommand=${runtimeCommand}`,
      distUrl ? `distUrl=${distUrl}` : null,
      distSha256 ? `distSha256=${distSha256}` : null,
      sourceCodeUrl ? `sourceCodeUrl=${sourceCodeUrl}` : null,
      "",
    ]
      .filter((line) => line !== null)
      .join("\n"),
    "utf8",
  );
  const licenses = await copyLicenseNotices();

  console.log(
    JSON.stringify(
      {
        ok: true,
        platform,
        destRoot,
        copiedPath,
        runtimeCommand,
        version,
        source: source.source,
        licenses,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

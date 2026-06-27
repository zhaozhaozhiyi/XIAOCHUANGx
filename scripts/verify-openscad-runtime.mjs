/**
 * Verify the prepared OpenSCAD runtime resource bundle.
 *
 * Development checks allow a MISSING_RUNTIME.md marker. Release checks require
 * a runnable runtime plus license, notices/attributions, and source availability
 * materials next to the packaged runtime.
 */
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const platform = process.env.JLC_OPENSCAD_PLATFORM || process.platform;
const required =
  process.argv.includes("--required") || process.env.JLC_OPENSCAD_REQUIRED === "1";
const requiredArchitectures = (
  process.env.JLC_OPENSCAD_REQUIRED_ARCHES ||
  process.env.JLC_OPENSCAD_REQUIRED_ARCH ||
  ""
)
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const root = join(
  repoRoot,
  "apps",
  "desktop",
  "resources",
  "engines",
  "openscad",
  platform,
);

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

async function macBundleExecutable(appPath) {
  const plistPath = join(appPath, "Contents", "Info.plist");
  const plist = await readFile(plistPath, "utf8").catch(() => "");
  const match = plist.match(
    /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/,
  );
  return match?.[1]?.trim() || "OpenSCAD";
}

async function findRuntimeCommand() {
  const macAppPath = join(root, "OpenSCAD.app");
  const candidates = [
    join(root, binaryName()),
    platform === "darwin"
      ? join(macAppPath, "Contents", "MacOS", await macBundleExecutable(macAppPath))
      : join(root, "OpenSCAD", binaryName()),
  ];
  for (const candidate of candidates) {
    if (await canExecute(candidate)) return candidate;
  }
  return null;
}

async function detectArchitectures(command) {
  if (!command) return [];
  if (platform === "darwin") {
    try {
      const result = await execFileAsync("lipo", ["-archs", command], {
        timeout: 5_000,
        maxBuffer: 64 * 1024,
      });
      return result.stdout.split(/\s+/).map((item) => item.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const result = await execFileAsync("file", [command], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const output = result.stdout.toLowerCase();
    const archs = [];
    if (output.includes("x86-64") || output.includes("x86_64")) archs.push("x86_64");
    if (output.includes("aarch64") || output.includes("arm64")) archs.push("arm64");
    if (output.includes("80386") || output.includes("i386")) archs.push("i386");
    return archs;
  } catch {
    return [];
  }
}

async function listLicenseFiles() {
  const dir = join(root, "LICENSES");
  try {
    const entries = await readdir(dir);
    return entries.filter((entry) => !entry.startsWith("."));
  } catch {
    return [];
  }
}

function hasAny(entries, patterns) {
  return entries.some((entry) =>
    patterns.some((pattern) => pattern.test(entry.toLowerCase())),
  );
}

async function hasPlaceholderOnly(entries) {
  if (entries.length !== 1 || entries[0]?.toLowerCase() !== "readme.md") {
    return false;
  }
  const readme = await readFile(join(root, "LICENSES", entries[0]), "utf8").catch(
    () => "",
  );
  return readme.includes("Do not ship a production desktop build");
}

async function hasUnresolvedLicenseReview(entries) {
  const reviewFiles = entries.filter((entry) =>
    /^(notice|third[_-]?party|attribution)/i.test(entry),
  );
  for (const entry of reviewFiles) {
    const content = await readFile(join(root, "LICENSES", entry), "utf8").catch(
      () => "",
    );
    if (
      content.includes("Release checklist still requires review") ||
      content.includes("Do not treat this generated file as legal approval")
    ) {
      return true;
    }
  }
  return false;
}

async function writeManifest(input) {
  const manifestPath = join(root, "RUNTIME_MANIFEST.json");
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        runtime: "openscad",
        platform,
        required,
        verifiedAt: new Date().toISOString(),
        ...input,
      },
      null,
      2,
    ),
    "utf8",
  );
  return manifestPath;
}

async function main() {
  const missingMarker = await exists(join(root, "MISSING_RUNTIME.md"));
  const runtimeCommand = await findRuntimeCommand();
  const architectures = await detectArchitectures(runtimeCommand);
  const versionPath = join(root, "VERSION.txt");
  const hasVersion = await exists(versionPath);
  const licenseEntries = await listLicenseFiles();
  const placeholderOnly = await hasPlaceholderOnly(licenseEntries);
  const unresolvedLicenseReview = await hasUnresolvedLicenseReview(licenseEntries);
  const hasLicense = hasAny(licenseEntries, [/^license(\.|$)/, /^copying(\.|$)/]);
  const hasNotices = hasAny(licenseEntries, [
    /^notice(\.|$)/,
    /^third[_-]?party/,
    /^attribution/,
  ]);
  const hasSourceNotice = hasAny(licenseEntries, [
    /^source(\.|$)/,
    /^source[_-]?offer/,
    /^source[_-]?availability/,
  ]);

  const errors = [];
  if (required) {
    if (missingMarker) errors.push("missing_runtime_marker_present");
    if (!runtimeCommand) errors.push("runtime_command_missing_or_not_executable");
    if (!hasVersion) errors.push("version_metadata_missing");
    if (placeholderOnly) errors.push("license_notices_placeholder");
    if (unresolvedLicenseReview) errors.push("license_notices_require_review");
    if (!hasLicense) errors.push("license_file_missing");
    if (!hasNotices) errors.push("notice_or_third_party_attribution_missing");
    if (!hasSourceNotice) errors.push("source_availability_notice_missing");
    for (const arch of requiredArchitectures) {
      if (!architectures.includes(arch)) {
        errors.push(`runtime_arch_missing:${arch}`);
      }
    }
  }

  let runtimeSize = null;
  if (runtimeCommand) {
    runtimeSize = (await stat(runtimeCommand)).size;
  }

  const manifestPath =
    runtimeCommand && hasVersion && licenseEntries.length > 0 && !placeholderOnly
      ? await writeManifest({
          ok: errors.length === 0,
          runtimeCommand,
          runtimeSize,
          architectures,
          requiredArchitectures,
          versionPath,
          licenseFiles: licenseEntries,
          checks: {
            hasLicense,
            hasNotices,
            hasSourceNotice,
          },
        })
      : null;

  const result = {
    ok: errors.length === 0,
    required,
    platform,
    root,
    missingMarker,
    runtimeCommand,
    runtimeSize,
    architectures,
    requiredArchitectures,
    hasVersion,
    licenseFiles: licenseEntries,
    placeholderOnly,
    unresolvedLicenseReview,
    checks: {
      hasLicense,
      hasNotices,
      hasSourceNotice,
    },
    manifestPath,
    errors,
  };

  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

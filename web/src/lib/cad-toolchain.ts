import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type OpenScadBinarySource = "env" | "bundled" | "dev_path";

export type OpenScadLicenseNoticesStatus = {
  available: boolean;
  reason?:
    | "runtime_missing"
    | "dev_path_not_packaged"
    | "license_notices_missing"
    | "license_notices_placeholder"
    | "license_notices_incomplete";
  detail?: string;
};

export type OpenScadToolchainStatus = {
  binary: "openscad";
  available: boolean;
  source?: OpenScadBinarySource;
  version?: string;
  reason?: string;
  detail?: string;
  licenseNotices: OpenScadLicenseNoticesStatus;
};

export type OpenScadExecutable = {
  command: string;
  source: OpenScadBinarySource;
};

function parseVersion(output: string): string | undefined {
  const line = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  return line || undefined;
}

function platformDir(): string {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
}

function binaryName(): string {
  return process.platform === "win32" ? "openscad.exe" : "openscad";
}

function processResourcesPath(): string | undefined {
  return (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
}

async function macBundleExecutable(appPath: string): Promise<string> {
  const plistPath = join(appPath, "Contents", "Info.plist");
  const plist = await readFile(plistPath, "utf8").catch(() => "");
  const match = plist.match(
    /<key>CFBundleExecutable<\/key>\s*<string>([^<]+)<\/string>/,
  );
  return match?.[1]?.trim() || "OpenSCAD";
}

function candidateBundledPaths(): string[] {
  const platform = platformDir();
  const name = binaryName();
  const cwd = process.cwd();
  const resourcesPath = processResourcesPath();
  const repoLikeRoots = unique([
    cwd,
    resolve(cwd, ".."),
    resolve(cwd, "../.."),
  ]);
  const roots = [
    resourcesPath && join(resourcesPath, "engines", "openscad", platform),
    resourcesPath && join(resourcesPath, "engines", "openscad"),
    ...repoLikeRoots.flatMap((root) => [
      join(root, "resources", "engines", "openscad", platform),
      join(root, "resources", "engines", "openscad"),
      join(root, "apps", "desktop", "resources", "engines", "openscad", platform),
      join(root, "apps", "desktop", "resources", "engines", "openscad"),
    ]),
  ].filter(Boolean) as string[];

  return roots.flatMap((root) => [
    join(root, name),
    process.platform === "darwin"
      ? join(root, "OpenSCAD.app", "Contents", "MacOS", "OpenSCAD")
      : join(root, "OpenSCAD", name),
  ]);
}

async function candidateBundledExecutablePaths(): Promise<string[]> {
  const candidates = candidateBundledPaths();
  if (process.platform !== "darwin") return candidates;

  const expanded = [...candidates];
  for (const candidate of candidates) {
    const marker = "/OpenSCAD.app/Contents/MacOS/OpenSCAD";
    if (!candidate.endsWith(marker)) continue;
    const appPath = candidate.slice(0, -"/Contents/MacOS/OpenSCAD".length);
    const executable = await macBundleExecutable(appPath);
    expanded.push(join(appPath, "Contents", "MacOS", executable));
  }
  return unique(expanded);
}

async function canExecute(command: string): Promise<boolean> {
  try {
    await access(command, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function canRunPathOpenScad(): Promise<boolean> {
  try {
    await execFileAsync("openscad", ["--version"], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function licenseNoticeCandidateDirs(command: string): string[] {
  const commandDir = dirname(command);
  return unique([
    join(commandDir, "LICENSES"),
    join(dirname(commandDir), "LICENSES"),
    join(dirname(dirname(commandDir)), "LICENSES"),
    join(dirname(dirname(dirname(commandDir))), "LICENSES"),
    join(dirname(dirname(dirname(dirname(commandDir)))), "LICENSES"),
  ]);
}

function hasAny(entries: string[], patterns: RegExp[]): boolean {
  return entries.some((entry) =>
    patterns.some((pattern) => pattern.test(entry.toLowerCase())),
  );
}

async function licenseDirState(dir: string): Promise<
  | { state: "available" }
  | { state: "placeholder" }
  | { state: "incomplete"; missing: string[] }
  | { state: "missing" }
> {
  try {
    const entries = (await readdir(dir)).filter((entry) => !entry.startsWith("."));
    if (entries.length === 0) return { state: "missing" };
    if (entries.length === 1 && entries[0]?.toLowerCase() === "readme.md") {
      const readme = await readFile(join(dir, entries[0]), "utf8").catch(
        () => "",
      );
      if (readme.includes("Do not ship a production desktop build")) {
        return { state: "placeholder" };
      }
    }

    const checks = {
      license: hasAny(entries, [/^license(\.|$)/, /^copying(\.|$)/]),
      notices: hasAny(entries, [
        /^notice(\.|$)/,
        /^third[_-]?party/,
        /^attribution/,
      ]),
      source: hasAny(entries, [
        /^source(\.|$)/,
        /^source[_-]?offer/,
        /^source[_-]?availability/,
      ]),
    };
    const missing = Object.entries(checks)
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    return missing.length === 0
      ? { state: "available" }
      : { state: "incomplete", missing };
  } catch {
    return { state: "missing" };
  }
}

async function probeLicenseNotices(
  executable: OpenScadExecutable | null,
): Promise<OpenScadLicenseNoticesStatus> {
  if (!executable) {
    return {
      available: false,
      reason: "runtime_missing",
      detail: "OpenSCAD runtime was not found.",
    };
  }

  if (executable.source === "dev_path") {
    return {
      available: false,
      reason: "dev_path_not_packaged",
      detail:
        "PATH-based OpenSCAD is allowed only for development diagnostics, not for product packaging.",
    };
  }

  for (const dir of licenseNoticeCandidateDirs(executable.command)) {
    const state = await licenseDirState(dir);
    if (state.state === "available") return { available: true };
    if (state.state === "placeholder") {
      return {
        available: false,
        reason: "license_notices_placeholder",
        detail:
          "OpenSCAD license notices folder contains only the development placeholder.",
      };
    }
    if (state.state === "incomplete") {
      return {
        available: false,
        reason: "license_notices_incomplete",
        detail: `OpenSCAD LICENSES folder is missing: ${state.missing.join(", ")}.`,
      };
    }
  }

  return {
    available: false,
    reason: "license_notices_missing",
    detail:
      "OpenSCAD runtime was found, but LICENSES notices were not found next to the managed runtime.",
  };
}

export async function resolveOpenScadExecutable(): Promise<OpenScadExecutable | null> {
  const envPath = process.env.JLC_OPENSCAD_BIN?.trim();
  if (envPath && (await canExecute(envPath))) {
    return { command: envPath, source: "env" };
  }

  for (const candidate of await candidateBundledExecutablePaths()) {
    if (await canExecute(candidate)) {
      return { command: candidate, source: "bundled" };
    }
  }

  if (
    process.env.JLC_OPENSCAD_ALLOW_PATH === "1" &&
    (await canRunPathOpenScad())
  ) {
    return { command: "openscad", source: "dev_path" };
  }

  return null;
}

export async function probeOpenScadToolchain(): Promise<OpenScadToolchainStatus> {
  const executable = await resolveOpenScadExecutable();
  const licenseNotices = await probeLicenseNotices(executable);
  if (!executable) {
    return {
      binary: "openscad",
      available: false,
      reason: "openscad_runtime_missing",
      detail:
        "Product-managed OpenSCAD runtime was not found in bundled resources.",
      licenseNotices,
    };
  }

  try {
    const result = await execFileAsync(executable.command, ["--version"], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    return {
      binary: "openscad",
      available: true,
      source: executable.source,
      version: parseVersion(output),
      licenseNotices,
    };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      stderr?: string;
      stdout?: string;
      killed?: boolean;
    };
    if (e.code === "ENOENT") {
      return {
        binary: "openscad",
        available: false,
        source: executable.source,
        reason: "openscad_runtime_missing",
        detail: "Product-managed OpenSCAD runtime could not be executed.",
        licenseNotices,
      };
    }
    return {
      binary: "openscad",
      available: false,
      source: executable.source,
      reason: e.killed ? "openscad_timeout" : "openscad_error",
      detail: (e.stderr || e.stdout || e.message || "").slice(0, 2000),
      licenseNotices,
    };
  }
}

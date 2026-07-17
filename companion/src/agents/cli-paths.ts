import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join } from "node:path";

const EXTRA_CLI_PATHS_ENV = "JLC_CLI_PATHS";

const POSIX_CLI_DIRS = [
  "/opt/homebrew/bin",
  "/opt/homebrew/sbin",
  "/usr/local/bin",
  "/usr/local/sbin",
  "/usr/bin",
  "/bin",
  "/usr/sbin",
  "/sbin",
];

function splitPathList(value: string | undefined): string[] {
  return (value ?? "")
    .split(delimiter)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function uniquePathList(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const path of paths) {
    if (seen.has(path)) continue;
    seen.add(path);
    result.push(path);
  }
  return result;
}

function userCliDirs(): string[] {
  const home = homedir();
  if (!home) return [];
  return [
    join(home, ".local", "bin"),
    join(home, "bin"),
    join(home, ".npm-global", "bin"),
    join(home, ".yarn", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".volta", "bin"),
    join(home, ".cargo", "bin"),
  ];
}

function fallbackCliDirs(): string[] {
  if (process.platform === "win32") return [];
  return [...POSIX_CLI_DIRS, ...userCliDirs()];
}

export function resolveCliSearchDirs(): string[] {
  return uniquePathList([
    ...splitPathList(process.env[EXTRA_CLI_PATHS_ENV]),
    ...splitPathList(process.env.PATH),
    ...fallbackCliDirs(),
  ]);
}

export function ensureCliSearchPath(): string {
  const nextPath = resolveCliSearchDirs().join(delimiter);
  if (nextPath) {
    process.env.PATH = nextPath;
  }
  return process.env.PATH ?? "";
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const err = new Error("aborted");
  err.name = "AbortError";
  throw err;
}

function hasPathSeparator(bin: string): boolean {
  return bin.includes("/") || bin.includes("\\");
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    if (!stats.isFile()) return false;
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function resolveExecutableFromCliPath(
  bin: string,
  signal?: AbortSignal,
): Promise<string | null> {
  throwIfAborted(signal);

  if (isAbsolute(bin) || hasPathSeparator(bin)) {
    return (await isExecutable(bin)) ? bin : null;
  }

  for (const dir of resolveCliSearchDirs()) {
    throwIfAborted(signal);
    const candidate = join(dir, bin);
    if (await isExecutable(candidate)) return candidate;
  }

  return null;
}

import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { shouldSkipDirEntry, shouldSkipPath } from "./ignore.js";

const execFileAsync = promisify(execFile);

const RG_MAX_BUFFER = 64 * 1024 * 1024;

async function listWithRipgrep(projectRoot: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync(
      "rg",
      ["--files", "-L", "--no-require-git"],
      {
        cwd: projectRoot,
        maxBuffer: RG_MAX_BUFFER,
        timeout: 30_000,
      },
    );
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !shouldSkipPath(line));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    const exit = (err as { code?: number | string }).code;
    if (exit === 1) return [];
    return null;
  }
}

async function walkFiles(
  projectRoot: string,
  absDir: string,
  depth: number,
  out: string[],
): Promise<void> {
  if (depth > 32) return;
  const entries = await readdir(absDir, { withFileTypes: true }).catch(
    () => [],
  );
  for (const ent of entries) {
    if (shouldSkipDirEntry(ent.name)) continue;
    const full = join(absDir, ent.name);
    const rel = relative(projectRoot, full).replace(/\\/g, "/");
    if (shouldSkipPath(rel)) continue;
    if (ent.isDirectory()) {
      await walkFiles(projectRoot, full, depth + 1, out);
    } else if (ent.isFile()) {
      out.push(rel);
    }
  }
}

async function listWithWalk(projectRoot: string): Promise<string[]> {
  const out: string[] = [];
  await walkFiles(projectRoot, projectRoot, 0, out);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/** OpenCode 策略：优先 ripgrep --files，否则递归 walk（无全局条数上限） */
export async function listProjectFilePaths(
  projectRoot: string,
  query?: string,
): Promise<string[]> {
  const fromRg = await listWithRipgrep(projectRoot);
  const paths = fromRg ?? (await listWithWalk(projectRoot));
  const q = query?.trim().toLowerCase();
  if (!q) return paths;
  return paths.filter(
    (p) =>
      p.toLowerCase().includes(q) ||
      p.split("/").pop()?.toLowerCase().includes(q),
  );
}

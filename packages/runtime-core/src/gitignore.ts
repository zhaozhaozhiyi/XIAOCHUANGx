import { readFile } from "node:fs/promises";
import { join } from "node:path";

const BUILTIN_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".jlcresearch",
  "agent-kit",
  ".turbo",
  "coverage",
  ".cache",
]);

export type IgnoreMatcher = (relPath: string, isDirectory: boolean) => boolean;

function parseGitignoreLine(line: string): string | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  if (t.startsWith("!")) return null;
  return t.replace(/\/$/, "");
}

/** 加载 cwd 下 `.gitignore` 并与内置目录合并 */
export async function loadIgnoreMatcher(cwd: string): Promise<IgnoreMatcher> {
  const dirRules = new Set<string>(BUILTIN_IGNORE_DIRS);
  const suffixRules: string[] = [];

  try {
    const raw = await readFile(join(cwd, ".gitignore"), "utf8");
    for (const line of raw.split("\n")) {
      const rule = parseGitignoreLine(line);
      if (!rule) continue;
      if (rule.includes("*")) {
        if (rule.startsWith("*.")) suffixRules.push(rule.slice(1));
        continue;
      }
      dirRules.add(rule);
    }
  } catch {
    /* no .gitignore */
  }

  return (relPath: string, isDirectory: boolean) => {
    const norm = relPath.replace(/\\/g, "/");
    const parts = norm.split("/");
    for (const part of parts) {
      if (dirRules.has(part)) return true;
    }
    if (dirRules.has(norm)) return true;
    for (const suf of suffixRules) {
      if (norm.endsWith(suf)) return true;
    }
    if (isDirectory && dirRules.has(parts[parts.length - 1] ?? "")) {
      return true;
    }
    return false;
  };
}

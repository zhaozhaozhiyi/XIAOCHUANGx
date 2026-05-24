/** OpenCode / Hermes 风格：跳过隐藏项与常见构建/VCS 目录 */

const IGNORED_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "target",
  "vendor",
  "bin",
  "obj",
  "__pycache__",
  ".idea",
  ".vscode",
  ".DS_Store",
]);

export function shouldSkipDirEntry(name: string): boolean {
  if (name === "." || name === "..") return true;
  if (name.startsWith(".")) return true;
  return IGNORED_DIR_NAMES.has(name);
}

export function shouldSkipPath(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  for (const part of normalized.split("/")) {
    if (!part || part === ".") continue;
    if (part.startsWith(".")) return true;
    if (IGNORED_DIR_NAMES.has(part)) return true;
  }
  return false;
}

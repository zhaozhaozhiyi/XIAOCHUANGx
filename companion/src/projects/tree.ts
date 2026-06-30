import type { Dirent } from "node:fs";
import { mkdir, readdir, stat, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { FileTreeNode } from "../types.js";
import { shouldSkipDirEntry } from "./ignore.js";
import { safeRelativePath } from "./store.js";

const READ_DIR_TIMEOUT_MS = 5_000;

async function readDirectoryEntries(dir: string): Promise<Dirent[]> {
  try {
    return await Promise.race([
      readdir(dir, { withFileTypes: true }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("read_dir_timeout")), READ_DIR_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return [];
  }
}

/** OpenCode filepicker：单层 ReadDir，当前目录内条目完整返回（无全局配额） */
async function listDirectoryLevel(
  root: string,
  dir: string,
): Promise<FileTreeNode[]> {
  const entries = await readDirectoryEntries(dir);

  const visible = entries
    .filter((e) => !shouldSkipDirEntry(String(e.name)))
    .sort((a, b) => {
      const aDir = a.isDirectory();
      const bDir = b.isDirectory();
      if (aDir !== bDir) return aDir ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });

  const nodes: FileTreeNode[] = [];

  for (const ent of visible) {
    const name = String(ent.name);
    const full = join(dir, name);
    const rel = relative(root, full).replace(/\\/g, "/") || name;

    if (ent.isDirectory()) {
      nodes.push({
        id: rel,
        name,
        type: "folder",
        relativePath: rel,
      });
    } else if (ent.isFile()) {
      nodes.push({
        id: rel,
        name,
        type: "file",
        relativePath: rel,
      });
    }
  }

  return nodes;
}

/** 项目根目录下一层；子目录展开时再拉取 */
export async function getProjectTree(projectRoot: string): Promise<FileTreeNode[]> {
  const nodes = await listDirectoryLevel(projectRoot, projectRoot);
  return [
    {
      id: ".",
      name: "根目录",
      type: "folder",
      relativePath: ".",
      children: nodes,
    },
  ];
}

/** 展开文件夹时加载其直接子项 */
export async function getProjectTreeChildren(
  projectRoot: string,
  relPath: string,
): Promise<FileTreeNode[]> {
  const full =
    relPath === "." ? projectRoot : safeRelativePath(projectRoot, relPath);
  const st = await stat(full);
  if (!st.isDirectory()) throw new Error("not_a_directory");
  return listDirectoryLevel(projectRoot, full);
}

const BINARY_EXT = /\.(pptx|docx|xlsx|pdf|png|jpe?g|gif|webp|svg|stl)$/i;

function mimeForPath(relPath: string): string {
  const lower = relPath.toLowerCase();
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".stl")) return "model/stl";
  if (lower.endsWith(".dxf")) return "image/vnd.dxf";
  if (lower.endsWith(".scad")) return "text/x-openscad";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  return "text/plain";
}

export async function readProjectFile(
  projectRoot: string,
  relPath: string,
): Promise<{ content: string; mime: string; encoding?: "utf8" | "base64" }> {
  const full = safeRelativePath(projectRoot, relPath);
  const st = await stat(full);
  if (!st.isFile()) throw new Error("not_a_file");
  const mime = mimeForPath(relPath);
  if (BINARY_EXT.test(relPath)) {
    const buf = await readFile(full);
    return { content: buf.toString("base64"), mime, encoding: "base64" };
  }
  const content = await readFile(full, "utf8");
  return { content, mime, encoding: "utf8" };
}

export async function writeProjectFile(input: {
  projectRoot: string;
  relPath: string;
  content: string;
  encoding?: "utf8" | "base64";
}): Promise<{ path: string; mime: string; size: number }> {
  const full = safeRelativePath(input.projectRoot, input.relPath);
  await mkdir(dirname(full), { recursive: true });
  const bytes =
    input.encoding === "base64"
      ? Buffer.from(input.content, "base64")
      : Buffer.from(input.content, "utf8");
  await writeFile(full, bytes);
  return {
    path: input.relPath.replace(/\\/g, "/").replace(/^\.\//, ""),
    mime: mimeForPath(input.relPath),
    size: bytes.length,
  };
}

function normalizeEntryPath(relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (!normalized.trim()) throw new Error("path_required");
  if (normalized.startsWith("/") || /^[A-Za-z]:\//i.test(normalized)) {
    throw new Error("absolute_path_not_allowed");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("invalid_path");
  }
  return normalized;
}

async function assertEntryDoesNotExist(path: string): Promise<void> {
  try {
    await stat(path);
    throw new Error("entry_already_exists");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
}

export async function createProjectEntry(input: {
  projectRoot: string;
  relPath: string;
  type: "file" | "folder";
  content?: string;
}): Promise<{ path: string; type: "file" | "folder"; mime?: string; size?: number }> {
  const relPath = normalizeEntryPath(input.relPath);
  const full = safeRelativePath(input.projectRoot, relPath);
  await assertEntryDoesNotExist(full);

  if (input.type === "folder") {
    await mkdir(full, { recursive: true });
    return { path: relPath, type: "folder" };
  }

  await mkdir(dirname(full), { recursive: true });
  const content = input.content ?? "";
  const bytes = Buffer.from(content, "utf8");
  await writeFile(full, bytes, { flag: "wx" });
  return {
    path: relPath,
    type: "file",
    mime: mimeForPath(relPath),
    size: bytes.length,
  };
}

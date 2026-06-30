import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { SimulatedDeliverablesPayload } from "./simulated-deliverables.js";
import { loadIgnoreMatcher, type IgnoreMatcher } from "./gitignore.js";

export type WorkspaceSnapshot = Map<string, number>;

const DELIVERABLE_EXT = new Set([
  ".md",
  ".markdown",
  ".pdf",
  ".pptx",
  ".ppt",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".csv",
  ".xlsx",
  ".html",
]);

const MAX_SCAN_FILES = 500;
const MAX_DEPTH = 6;

function isDeliverablePath(rel: string): boolean {
  const ext = extname(rel).toLowerCase();
  if (DELIVERABLE_EXT.has(ext)) return true;
  if (rel.includes("research") && ext === ".md") return true;
  return false;
}

function guessMime(rel: string): string | undefined {
  const ext = extname(rel).toLowerCase();
  if (ext === ".md") return "text/markdown";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return undefined;
}

async function walkDir(
  dir: string,
  cwd: string,
  depth: number,
  out: WorkspaceSnapshot,
  shouldIgnore: IgnoreMatcher,
): Promise<void> {
  if (depth > MAX_DEPTH || out.size >= MAX_SCAN_FILES) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (out.size >= MAX_SCAN_FILES) break;
    if (ent.name === ".git") continue;
    const abs = join(dir, ent.name);
    const relProbe = relative(cwd, abs).replace(/\\/g, "/");
    if (shouldIgnore(relProbe, ent.isDirectory())) continue;
    if (ent.isDirectory()) {
      await walkDir(abs, cwd, depth + 1, out, shouldIgnore);
      continue;
    }
    if (!ent.isFile()) continue;
    const rel = relative(cwd, abs).replace(/\\/g, "/");
    if (!rel || rel.startsWith("..")) continue;
    try {
      const st = await stat(abs);
      out.set(rel, st.mtimeMs);
    } catch {
      /* skip */
    }
  }
}

export async function snapshotWorkspace(cwd: string): Promise<WorkspaceSnapshot> {
  const snap = new Map<string, number>();
  const shouldIgnore = await loadIgnoreMatcher(cwd);
  await walkDir(cwd, cwd, 0, snap, shouldIgnore);
  return snap;
}

function pickPrimary(paths: string[]): string {
  const md = paths.find((p) => p.endsWith(".md"));
  if (md) return md;
  return paths[0]!;
}

/** 对比 Run 前后工作区，生成成品列表 */
export function buildDeliverablesFromDiff(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
  extraPaths: string[] = [],
): SimulatedDeliverablesPayload | null {
  const changed = new Set<string>();

  for (const [rel, mtime] of after) {
    if (!isDeliverablePath(rel)) continue;
    const prev = before.get(rel);
    if (prev == null || mtime > prev) changed.add(rel);
  }

  for (const p of extraPaths) {
    const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
    if (norm && isDeliverablePath(norm)) changed.add(norm);
  }

  const paths = [...changed].sort();
  if (paths.length === 0) return null;
  if (paths.length === 1) {
    const path = paths[0]!;
    return {
      headline: "本轮产出文件：",
      primaryPath: path,
      items: [
        {
          path,
          mime: guessMime(path),
          kind: "primary",
        },
      ],
    };
  }

  const primaryPath = pickPrimary(paths);
  return {
    headline: "本轮交付文件如下：",
    primaryPath,
    items: paths.map((path) => ({
      path,
      mime: guessMime(path),
      kind: path === primaryPath ? "primary" : "attachment",
    })),
  };
}

/** 从工具进度消息中提取可能写入的路径 */
export function extractPathFromToolMessage(
  tool: string,
  message?: string,
): string | null {
  if (!message?.trim()) return null;
  const t = tool.toLowerCase();
  if (
    !t.includes("write") &&
    !t.includes("edit") &&
    t !== "write_file" &&
    t !== "apply_patch"
  ) {
    return null;
  }
  const m = message.trim().match(
    /(?:^|[\s"'`(])([\w./-]+\.(?:md|markdown|pdf|pptx|ppt|docx|png|jpe?g|webp|csv|xlsx|html))(?:[\s"'`),]|$)/i,
  );
  return m?.[1]?.replace(/^\.\//, "") ?? null;
}

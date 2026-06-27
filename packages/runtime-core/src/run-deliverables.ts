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
  ".svg",
  ".csv",
  ".xlsx",
  ".json",
  ".html",
  ".scad",
  ".stl",
  ".dxf",
  ".off",
]);

const MAX_SCAN_FILES = 500;
const MAX_DEPTH = 6;

function isDeliverablePath(rel: string): boolean {
  if (rel === "presentation/package.json" || rel.endsWith("/presentation/package.json")) {
    return true;
  }
  const ext = extname(rel).toLowerCase();
  if (DELIVERABLE_EXT.has(ext)) return true;
  if (rel.includes("research") && ext === ".md") return true;
  return false;
}

function guessMime(rel: string): string | undefined {
  if (rel.endsWith("/presentation") || rel === "presentation") return "inode/directory";
  const ext = extname(rel).toLowerCase();
  if (ext === ".md") return "text/markdown";
  if (ext === ".html") return "text/html";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".pptx")
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (ext === ".docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".csv") return "text/csv";
  if (ext === ".json") return "application/json";
  if (ext === ".xlsx")
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".scad") return "text/x-openscad";
  if (ext === ".stl") return "model/stl";
  if (ext === ".dxf") return "image/vnd.dxf";
  if (ext === ".off") return "model/vnd.off";
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
  const presentation = paths.find((p) => p === "presentation" || p.endsWith("/presentation"));
  if (presentation) return presentation;
  const stl = paths.find((p) => p.endsWith(".stl"));
  if (stl) return stl;
  const scad = paths.find((p) => p.endsWith(".scad"));
  if (scad) return scad;
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
    if (prev == null || mtime > prev) {
      if (rel === "presentation/package.json") {
        changed.add("presentation");
      } else if (rel.endsWith("/presentation/package.json")) {
        changed.add(rel.replace(/\/package\.json$/, ""));
      } else {
        changed.add(rel);
      }
    }
  }

  for (const p of extraPaths) {
    const norm = p.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!norm) continue;
    if (norm === "presentation/package.json") {
      changed.add("presentation");
    } else if (norm.endsWith("/presentation/package.json")) {
      changed.add(norm.replace(/\/package\.json$/, ""));
    } else if (
      norm === "presentation" ||
      norm.endsWith("/presentation") ||
      isDeliverablePath(norm)
    ) {
      changed.add(norm);
    }
  }

  const paths = [...changed].sort();
  if (paths.length === 0) return null;
  const itemForPath = (path: string) => {
    const isPresentationDir =
      path === "presentation" || path.endsWith("/presentation");
    return {
      path,
      label: isPresentationDir
        ? "presentation/ 网页视频项目"
        : path.endsWith("script.md")
          ? "script.md 口播稿"
          : path.endsWith("outline.md")
            ? "outline.md 章节计划"
            : undefined,
      mime: guessMime(path),
      kind: isPresentationDir
        ? ("directory" as const)
        : path === pickPrimary(paths)
          ? ("primary" as const)
          : ("attachment" as const),
      ...(isPresentationDir
        ? {
            previewUrl: "http://localhost:5173/?reel=1",
            recordingUrl: "http://localhost:5173/?auto=1",
            devCommand: "cd presentation && npm run dev",
          }
        : {}),
    };
  };
  if (paths.length === 1) {
    const path = paths[0]!;
    return {
      headline: "本轮产出文件：",
      primaryPath: path,
      items: [itemForPath(path)],
    };
  }

  const primaryPath = pickPrimary(paths);
  return {
    headline: "本轮交付文件如下：",
    primaryPath,
    items: paths.map((path) => itemForPath(path)),
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
    /(?:^|[\s"'`(])([\w./-]+(?:presentation|presentation\/package\.json|(?:\.(?:md|markdown|pdf|pptx|ppt|docx|png|jpe?g|webp|svg|csv|xlsx|json|html|scad|stl|dxf|off))))(?:[\s"'`),]|$)/i,
  );
  const path = m?.[1]?.replace(/^\.\//, "") ?? null;
  if (!path) return null;
  return path.endsWith("/presentation/package.json")
    ? path.replace(/\/package\.json$/, "")
    : path === "presentation/package.json"
      ? "presentation"
      : path;
}

import {
  flattenWorkspaceFiles,
  type WorkspaceFileNode,
} from "@/lib/workspace";

export type ParsedFileRef = {
  path: string;
  line?: number;
  endLine?: number;
};

export type ResolveFileResult =
  | { ok: true; node: WorkspaceFileNode }
  | { ok: false; reason: "forbidden" | "not_found" | "ambiguous" };

const LINE_SUFFIX_RE =
  /\s*\((?:line|lines)\s+(\d+)(?:\s*[-–]\s*(\d+))?\)\s*$/i;

/** 剥离 `path (line 18)` / `path (lines 10-20)` 后缀 */
export function parseFileRef(raw: string): ParsedFileRef {
  const trimmed = raw.trim();
  const m = trimmed.match(LINE_SUFFIX_RE);
  if (!m) {
    return { path: trimmed };
  }
  const path = trimmed.slice(0, m.index).trim();
  const start = Number.parseInt(m[1]!, 10);
  const endRaw = m[2] ? Number.parseInt(m[2], 10) : undefined;
  return {
    path,
    line: Number.isFinite(start) ? start : undefined,
    endLine: endRaw !== undefined && Number.isFinite(endRaw) ? endRaw : undefined,
  };
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function isForbiddenPath(p: string): boolean {
  const n = normalizePath(p);
  if (n.includes("..")) return true;
  if (/^file:\/\//i.test(p.trim())) return true;
  return false;
}

function listProjectFiles(root: WorkspaceFileNode): WorkspaceFileNode[] {
  return flattenWorkspaceFiles(root.children ?? []).filter(
    (f) => f.type === "file",
  );
}

/**
 * 在当前工作区树中解析 Agent 给出的路径（PRD F-QA-010）。
 */
export function resolveFileInTree(
  root: WorkspaceFileNode,
  rawPath: string,
): ResolveFileResult {
  const { path: pathOnly } = parseFileRef(rawPath);
  if (!pathOnly || isForbiddenPath(pathOnly)) {
    return { ok: false, reason: "forbidden" };
  }

  const files = listProjectFiles(root);
  const norm = normalizePath(pathOnly);

  if (norm.startsWith("/") || /^[A-Za-z]:\//i.test(norm)) {
    const abs = norm.toLowerCase();
    const suffixMatches = files.filter((f) => {
      const rp = f.relativePath?.replace(/\\/g, "/").toLowerCase();
      if (!rp) return false;
      return abs === rp || abs.endsWith(`/${rp}`);
    });
    if (suffixMatches.length === 1) {
      return { ok: true, node: suffixMatches[0]! };
    }
    if (suffixMatches.length > 1) {
      return { ok: false, reason: "ambiguous" };
    }
    return { ok: false, reason: "not_found" };
  }

  const exact = files.find((f) => {
    const rp = f.relativePath?.replace(/\\/g, "/");
    return rp === norm || rp === pathOnly;
  });
  if (exact) return { ok: true, node: exact };

  const base = norm.split("/").pop()?.toLowerCase();
  if (!base) return { ok: false, reason: "not_found" };

  const byName = files.filter((f) => f.name.toLowerCase() === base);
  if (byName.length === 1) return { ok: true, node: byName[0]! };
  if (byName.length > 1) return { ok: false, reason: "ambiguous" };

  return { ok: false, reason: "not_found" };
}

export function resolveFileMessage(
  reason: Extract<ResolveFileResult, { ok: false }>["reason"],
): string {
  switch (reason) {
    case "forbidden":
      return "无法打开该路径（不允许访问项目外或上级目录）";
    case "ambiguous":
      return "存在多个同名文件，请使用更完整的路径";
    case "not_found":
      return "在当前项目中未找到该文件";
    default:
      return "无法打开文件";
  }
}

/**
 * 对话正文中可点击打开的工作区文件扩展名（F-QA-010）。
 * 覆盖源码、文档、图像、Office、压缩包与常见媒体等 Agent 本地输出。
 */
const INLINE_FILE_EXTENSIONS = [
  "md",
  "mdx",
  "txt",
  "log",
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "jsonc",
  "json5",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "sass",
  "less",
  "sql",
  "csv",
  "py",
  "sh",
  "bash",
  "zsh",
  "vue",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "rb",
  "php",
  "lock",
  "env",
  "ini",
  "conf",
  "cfg",
  "wasm",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "ico",
  "bmp",
  "avif",
  "heic",
  "tif",
  "tiff",
  "pdf",
  "docx",
  "doc",
  "rtf",
  "odt",
  "epub",
  "pptx",
  "ppt",
  "xlsx",
  "xls",
  "ods",
  "zip",
  "tar",
  "gz",
  "tgz",
  "bz2",
  "7z",
  "rar",
  "mp4",
  "webm",
  "mov",
  "avi",
  "mkv",
  "mp3",
  "wav",
  "m4a",
  "flac",
  "aac",
] as const;

const INLINE_FILE_EXT_PATTERN = INLINE_FILE_EXTENSIONS.join("|");

/** Summary 内联路径：匹配带扩展名的项目相对/绝对路径 */
export const INLINE_FILE_REF_RE = new RegExp(
  "(\\`?)([\\w./@-]+\\.(?:" +
    INLINE_FILE_EXT_PATTERN +
    "))(?:\\s*\\((?:line|lines)\\s+(\\d+)(?:\\s*[-–]\\s*(\\d+))?\\))?\\1",
  "gi",
);

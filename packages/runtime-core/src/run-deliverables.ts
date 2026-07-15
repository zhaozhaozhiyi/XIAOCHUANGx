import { readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { SimulatedDeliverablesPayload } from "./simulated-deliverables.js";
import { loadIgnoreMatcher, type IgnoreMatcher } from "./gitignore.js";
import type {
  ArtifactAction,
  ArtifactConversion,
  ArtifactGeneratedFormat,
  ArtifactItem,
  ArtifactManifest,
  ArtifactPreview,
  ModuleStage,
  ProductModuleId,
} from "@jlc/contracts";

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
const VIDEO_PRESENTATION_DEV_URL =
  process.env.XIAOCHUANG_VIDEO_PRESENTATION_URL?.replace(/\/$/, "") ??
  "http://localhost:5174";

function safeArtifactId(prefix: string, path: string, index: number): string {
  const slug = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return `${prefix}_${index}_${slug || "artifact"}`;
}

function deliverableType(path: string): string {
  const ext = extname(path).toLowerCase().replace(/^\./, "");
  if (ext) return ext;
  if (path === "presentation" || path.endsWith("/presentation")) return "directory";
  return "file";
}

function isPreviewType(type: string): boolean {
  return [
    "html",
    "htm",
    "md",
    "markdown",
    "pdf",
    "docx",
    "scad",
    "dxf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "svg",
    "stl",
    "mp4",
    "webm",
    "mov",
    "m4v",
    "ogg",
    "ogv",
  ].includes(type);
}

function isGeneratedFormatType(type: string): boolean {
  return [
    "md",
    "markdown",
    "pptx",
    "ppt",
    "pdf",
    "docx",
    "mp4",
    "webm",
    "mov",
    "m4v",
    "ogg",
    "ogv",
    "stl",
    "dxf",
    "svg",
  ].includes(type);
}

function previewTypeForArtifact(type: string): ArtifactPreview["type"] {
  if (type === "html" || type === "htm") return "html";
  if (["png", "jpg", "jpeg", "webp", "svg"].includes(type)) return "image";
  if (["stl", "scad", "dxf", "off"].includes(type)) return "model";
  if (["mp4", "webm", "mov", "m4v", "ogg", "ogv"].includes(type)) {
    return "video";
  }
  if (type === "directory") return "directory";
  return "document";
}

function isSourceType(type: string): boolean {
  return ["scad"].includes(type);
}

const THREE_D_PRIMARY_PRIORITY = [
  /(^|\/)drawing\.scad$/i,
  /\.scad$/i,
  /(^|\/)exports\/drawing\.stl$/i,
  /(^|\/)exports\/preview\.stl$/i,
  /\.stl$/i,
  /(^|\/)exports\/drawing\.dxf$/i,
  /\.dxf$/i,
  /(^|\/)readme\.md$/i,
] as const;

function threeDPrimaryRank(path: string): number {
  const rank = THREE_D_PRIMARY_PRIORITY.findIndex((pattern) =>
    pattern.test(path.replace(/\\/g, "/")),
  );
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}

function pickThreeDPrimary<T extends { path: string }>(
  items: T[],
): T | undefined {
  let best: T | undefined;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const rank = threeDPrimaryRank(item.path);
    if (!Number.isFinite(rank)) continue;
    if (
      !best ||
      rank < bestRank ||
      (rank === bestRank && item.path.length < best.path.length)
    ) {
      best = item;
      bestRank = rank;
    }
  }
  return best;
}

function findArtifactByType(
  artifacts: ArtifactItem[],
  types: string[],
): ArtifactItem | undefined {
  return artifacts.find((artifact) => types.includes(artifact.type));
}

function findGeneratedFormatByType(
  generatedFormats: ArtifactGeneratedFormat[],
  types: string[],
): ArtifactGeneratedFormat | undefined {
  return generatedFormats.find((format) => types.includes(format.type));
}

function buildAvailableConversions(
  moduleId: ProductModuleId,
  artifacts: ArtifactItem[],
  generatedFormats: ArtifactGeneratedFormat[],
): ArtifactConversion[] {
  if (moduleId !== "ppt") return [];
  const hasPdf = Boolean(findGeneratedFormatByType(generatedFormats, ["pdf"]));
  if (hasPdf) return [];
  const sourceArtifact =
    findArtifactByType(artifacts, ["pptx", "ppt"]) ??
    findArtifactByType(artifacts, ["html", "htm"]);
  if (!sourceArtifact) return [];
  return [
    {
      id: "generate_pdf",
      type: "pdf",
      label: "PDF",
      sourceArtifactId: sourceArtifact.id,
      status: "planned",
    },
  ];
}

function buildManifestActions(input: {
  moduleId: ProductModuleId;
  primaryArtifact?: ArtifactItem;
  artifacts: ArtifactItem[];
  previews: ArtifactPreview[];
  generatedFormats: ArtifactGeneratedFormat[];
  availableConversions: ArtifactConversion[];
}): ArtifactAction[] {
  const { moduleId, primaryArtifact, artifacts, previews, generatedFormats } = input;
  if (moduleId === "3d") {
    const workbenchArtifact = pickThreeDPrimary(artifacts) ?? primaryArtifact;
    const stlArtifact = pickThreeDPrimary(
      artifacts.filter((artifact) => artifact.type === "stl"),
    );
    const dxfArtifact = pickThreeDPrimary(
      artifacts.filter((artifact) => artifact.type === "dxf"),
    );
    const actions: ArtifactAction[] = [
      {
        id: "open_model_preview",
        label: "打开模型预览",
        kind: "preview",
        targetArtifactId: workbenchArtifact?.id,
        enabled: Boolean(workbenchArtifact),
      },
    ];
    if (stlArtifact && stlArtifact.id !== workbenchArtifact?.id) {
      actions.push({
        id: "open_stl",
        label: "打开 STL",
        kind: "open",
        targetArtifactId: stlArtifact.id,
        enabled: true,
      });
    }
    if (dxfArtifact && dxfArtifact.id !== workbenchArtifact?.id) {
      actions.push({
        id: "open_dxf",
        label: "打开 DXF",
        kind: "open",
        targetArtifactId: dxfArtifact.id,
        enabled: true,
      });
    }
    actions.push({
      id: "continue_iteration",
      label: "继续修改",
      kind: "continue",
      targetArtifactId: workbenchArtifact?.id ?? primaryArtifact?.id,
      enabled: Boolean(workbenchArtifact ?? primaryArtifact),
    });
    return actions;
  }

  if (moduleId === "ppt") {
    const htmlArtifact = findArtifactByType(artifacts, ["html", "htm"]);
    const pptxArtifact = findArtifactByType(artifacts, ["pptx", "ppt"]);
    const actions: ArtifactAction[] = [];
    if (htmlArtifact || previews[0]) {
      actions.push({
        id: "open_preview",
        label: "打开预览",
        kind: "preview",
        targetArtifactId: htmlArtifact?.id,
        enabled: true,
      });
    }
    if (pptxArtifact) {
      actions.push({
        id: "open_pptx",
        label: "打开 PPTX",
        kind: "open",
        targetArtifactId: pptxArtifact.id,
        enabled: true,
      });
    }
    if (input.availableConversions.some((conversion) => conversion.type === "pdf")) {
      actions.push({
        id: "generate_pdf",
        label: "生成 PDF（待接入）",
        kind: "generate_format",
        targetArtifactId: pptxArtifact?.id ?? htmlArtifact?.id,
        enabled: false,
      });
    }
    actions.push({
      id: "continue_iteration",
      label: "继续修改",
      kind: "continue",
      targetArtifactId: primaryArtifact?.id,
      enabled: Boolean(primaryArtifact),
    });
    return actions;
  }

  const previewTargetArtifactId = previews[0]?.path
    ? artifacts.find((artifact) => artifact.path === previews[0]?.path)?.id
    : undefined;
  return [
    ...previews.slice(0, 1).map((preview) => ({
      id: "open_preview",
      label: preview.label,
      kind: "preview" as const,
      targetArtifactId: previewTargetArtifactId,
      enabled: true,
    })),
    ...generatedFormats.slice(0, 2).map((format) => ({
      id: `open_${format.id}`,
      label: `打开 ${format.type.toUpperCase()}`,
      kind: "open" as const,
      targetArtifactId: format.id.replace(/^format_/, ""),
      enabled: true,
    })),
    {
      id: "continue_iteration",
      label: "继续修改",
      kind: "continue" as const,
      targetArtifactId: primaryArtifact?.id,
      enabled: Boolean(primaryArtifact),
    },
  ];
}

export type BuildArtifactManifestInput = {
  moduleId: ProductModuleId;
  runId: string;
  sessionId: string;
  title: string;
  projectId?: string;
  stage?: ModuleStage;
  now?: string;
};

type BuildDeliverablesFromDiffOptions = {
  moduleId?: ProductModuleId;
};

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
  if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".ogg" || ext === ".ogv") return "video/ogg";
  return undefined;
}

export function buildArtifactManifestFromDeliverables(
  payload: SimulatedDeliverablesPayload,
  input: BuildArtifactManifestInput,
): ArtifactManifest {
  const now = input.now ?? new Date().toISOString();
  const primaryPath = payload.primaryPath || payload.items[0]?.path;
  const artifacts: ArtifactItem[] = payload.items.map((item, index) => {
    const type = deliverableType(item.path);
    const isPrimary = item.path === primaryPath || item.kind === "primary";
    const role: ArtifactItem["role"] = isPrimary
      ? "primary"
      : isSourceType(type)
        ? "source"
        : isPreviewType(type)
          ? "preview"
          : isGeneratedFormatType(type)
            ? "generated_format"
            : "attachment";
    return {
      id: safeArtifactId("artifact", item.path, index),
      type,
      label: item.label ?? item.path.split(/[\\/]/).pop() ?? item.path,
      path: item.path,
      role,
      mimeType: item.mime ?? guessMime(item.path),
    };
  });

  const primaryArtifact =
    artifacts.find((artifact) => artifact.path === primaryPath) ??
    artifacts.find((artifact) => artifact.role === "primary") ??
    artifacts[0];
  const previews = payload.items.flatMap<ArtifactPreview>((item, index) => {
    const type = deliverableType(item.path);
    if (!item.previewUrl && !isPreviewType(type)) return [];
    return [
      {
        id: safeArtifactId("preview", item.path, index),
        type: previewTypeForArtifact(type),
        label:
          item.previewUrl || type === "html" || type === "htm"
            ? "打开预览"
            : item.label ?? "预览",
        path: item.path,
        ...(item.previewUrl ? { url: item.previewUrl } : {}),
        status: "available" as const,
      },
    ];
  });
  const generatedFormats: ArtifactGeneratedFormat[] = artifacts
    .filter((artifact) => isGeneratedFormatType(artifact.type))
    .map((artifact) => ({
      id: `format_${artifact.id}`,
      type: artifact.type,
      label: `已生成 ${artifact.type.toUpperCase()}`,
      path: artifact.path,
      status: "available" as const,
    }));
  const availableConversions = buildAvailableConversions(
    input.moduleId,
    artifacts,
    generatedFormats,
  );
  const actions = buildManifestActions({
    moduleId: input.moduleId,
    primaryArtifact,
    artifacts,
    previews,
    generatedFormats,
    availableConversions,
  });

  return {
    version: 1,
    moduleId: input.moduleId,
    runId: input.runId,
    sessionId: input.sessionId,
    projectId: input.projectId,
    title: input.title,
    status: artifacts.length > 0 ? "ready" : "partial",
    stage: input.stage,
    primaryArtifact,
    artifacts,
    previews,
    generatedFormats,
    availableConversions,
    actions,
    metadata: {
      primaryPath,
      artifactCount: artifacts.length,
    },
    createdAt: now,
    updatedAt: now,
  };
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

function pickPrimary(
  paths: string[],
  options: BuildDeliverablesFromDiffOptions = {},
): string {
  if (options.moduleId === "3d") {
    const threeDPrimary = pickThreeDPrimary(paths.map((path) => ({ path })));
    if (threeDPrimary) return threeDPrimary.path;
  }
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

function preferMoreSpecificPath(current: string, candidate: string): string {
  const currentDepth = current.split("/").length;
  const candidateDepth = candidate.split("/").length;
  if (candidateDepth !== currentDepth) {
    return candidateDepth > currentDepth ? candidate : current;
  }
  return candidate.length > current.length ? candidate : current;
}

function findEquivalentDeliverablePath(
  paths: Iterable<string>,
  candidate: string,
): string | undefined {
  for (const path of paths) {
    if (
      path === candidate ||
      path.endsWith(`/${candidate}`) ||
      candidate.endsWith(`/${path}`)
    ) {
      return path;
    }
  }
  return undefined;
}

/** 对比 Run 前后工作区，生成成品列表 */
export function buildDeliverablesFromDiff(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
  extraPaths: string[] = [],
  options: BuildDeliverablesFromDiffOptions = {},
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

  const dedupedPaths = new Set<string>();
  for (const path of changed) {
    const equivalent = findEquivalentDeliverablePath(dedupedPaths, path);
    if (!equivalent) {
      dedupedPaths.add(path);
      continue;
    }
    const preferred = preferMoreSpecificPath(equivalent, path);
    if (preferred !== equivalent) {
      dedupedPaths.delete(equivalent);
      dedupedPaths.add(preferred);
    }
  }

  const paths = [...dedupedPaths].sort();
  if (paths.length === 0) return null;
  const primaryPath = pickPrimary(paths, options);
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
        : path === primaryPath
          ? ("primary" as const)
          : ("attachment" as const),
      ...(isPresentationDir
        ? {
            previewUrl: `${VIDEO_PRESENTATION_DEV_URL}/?reel=1`,
            recordingUrl: `${VIDEO_PRESENTATION_DEV_URL}/?auto=1`,
            devCommand: "cd presentation && npm run dev",
            devServerStatus: "unknown" as const,
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
    !t.includes("bash") &&
    !t.includes("shell") &&
    !t.includes("terminal") &&
    t !== "write_file" &&
    t !== "apply_patch" &&
    t !== "run_terminal"
  ) {
    return null;
  }
  const m = message.trim().match(
    /(?:^|[\s"'`(])((?:\.{0,2}\/)?[^\s"'`),;|<>]+(?:presentation|presentation\/package\.json|(?:\.(?:md|markdown|pdf|pptx|ppt|docx|png|jpe?g|webp|svg|csv|xlsx|json|html|scad|stl|dxf|off))))(?:[\s"'`),;|<>]|$)/iu,
  );
  const path = m?.[1]?.replace(/^\.\//, "") ?? null;
  if (!path) return null;
  return path.endsWith("/presentation/package.json")
    ? path.replace(/\/package\.json$/, "")
    : path === "presentation/package.json"
      ? "presentation"
      : path;
}

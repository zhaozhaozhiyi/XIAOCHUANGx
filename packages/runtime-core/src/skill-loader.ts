import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import type {
  SkillBundleCacheStatus,
  SkillBundleItem,
  SkillFailureCode,
  SkillFailureStage,
  SkillFallbackMode,
  SkillManifestV1,
  SkillSelectionDecisionV1,
} from "@jlc/contracts";
import { resolveSkillsRoot } from "./paths.js";
import type { SkillRegistrySnapshot } from "./skill-registry.js";

export { resolveSkillsRoot } from "./paths.js";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export type LoadedSkill = {
  slug: string;
  skillPath: string;
  body: string;
  referencePaths: string[];
};

export type SkillBundle = {
  platformNorm?: LoadedSkill;
  process?: LoadedSkill;
  support: LoadedSkill[];
  missing: string[];
};

type CacheEntry = { mtimeMs: number; loaded: LoadedSkill };

const bundleCache = new Map<string, CacheEntry>();

type SelectedCacheEntry = {
  mtimeMs: number;
  item: SelectedSkillBundleItem;
};

const selectedBundleCache = new Map<string, SelectedCacheEntry>();

export type SkillLoaderMetrics = {
  skillBodyReadCount: number;
  skillBodyCacheHitCount: number;
};

const selectedLoaderMetrics: SkillLoaderMetrics = {
  skillBodyReadCount: 0,
  skillBodyCacheHitCount: 0,
};

export type SelectedSkillBundleItem = SkillBundleItem & {
  manifest: SkillManifestV1;
  skillPath: string;
  body: string;
  referencePaths: string[];
};

export type SelectedSkillBundle = {
  status: "ready";
  decisionId: string;
  primary: SelectedSkillBundleItem;
  required: SelectedSkillBundleItem[];
  items: SelectedSkillBundleItem[];
  bundleHash: string;
  bundleCacheStatus: SkillBundleCacheStatus;
};

export type SelectedSkillBundleFailure = {
  status: "failed";
  decisionId: string;
  failedSkillSlug: string;
  failureStage: SkillFailureStage;
  failureCode: SkillFailureCode;
  failureMessage: string;
  fallbackMode: SkillFallbackMode;
  loadedItems: SelectedSkillBundleItem[];
};

export type SelectedSkillBundleCancelled = {
  status: "cancelled";
  decisionId: string;
  loadedItems: SelectedSkillBundleItem[];
};

export type SelectedSkillBundleResult =
  | SelectedSkillBundle
  | SelectedSkillBundleFailure
  | SelectedSkillBundleCancelled;

function assertSkillSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`Invalid skill slug: ${slug}`);
  }
}

function stripFrontmatter(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) return raw.trim();
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return raw.trim();
  return trimmed.slice(end + 3).trim();
}

function listReferenceFiles(skillDir: string): string[] {
  const refDir = join(skillDir, "references");
  if (!existsSync(refDir)) return [];
  return readdirSync(refDir)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => join(refDir, name));
}

function readSkillFile(skillPath: string): string {
  return stripFrontmatter(readFileSync(skillPath, "utf8"));
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function loadSkillFromDisk(
  skillsRoot: string,
  slug: string,
): LoadedSkill | null {
  assertSkillSlug(slug);
  const skillDir = join(skillsRoot, slug);
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  const body = readSkillFile(skillPath);
  const referencePaths = listReferenceFiles(skillDir);
  return { slug, skillPath, body, referencePaths };
}

function cacheKey(skillsRoot: string, slug: string): string {
  return `${skillsRoot}::${slug}`;
}

function getCachedOrLoad(
  skillsRoot: string,
  slug: string,
): LoadedSkill | null {
  const skillDir = join(skillsRoot, slug);
  const skillPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillPath)) return null;

  const mtimeMs = statSync(skillPath).mtimeMs;
  const key = cacheKey(skillsRoot, slug);
  const hit = bundleCache.get(key);
  if (hit && hit.mtimeMs === mtimeMs) {
    selectedLoaderMetrics.skillBodyCacheHitCount += 1;
    return hit.loaded;
  }

  const loaded = loadSkillFromDisk(skillsRoot, slug);
  if (!loaded) return null;
  selectedLoaderMetrics.skillBodyReadCount += 1;
  bundleCache.set(key, { mtimeMs, loaded });
  return loaded;
}

/** 仅 SKILL.md 正文（references 走 Agent Kit 路径说明） */
export function formatSkillBodyForPrompt(skill: LoadedSkill): string {
  return [`<!-- skill:${skill.slug} -->`, skill.body].join("\n");
}

/** @deprecated 内联 references；量产路径请用 formatSkillBodyForPrompt + Agent Kit */
export function formatSkillForPrompt(skill: LoadedSkill): string {
  const parts: string[] = [
    `<!-- skill:${skill.slug} -->`,
    skill.body,
  ];
  for (const refPath of skill.referencePaths) {
    const name = basename(refPath);
    parts.push("", `### 参考：${name}`, readSkillFile(refPath));
  }
  return parts.join("\n");
}

export function loadSkill(
  slug: string,
  skillsRoot = resolveSkillsRoot(),
): LoadedSkill | null {
  return getCachedOrLoad(skillsRoot, slug);
}

export function loadSkillBundle(input: {
  platformNormSkill?: string | null;
  processSkill?: string | null;
  supportSkillSlugs?: string[] | null;
  skillsRoot?: string;
}): SkillBundle {
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const missing: string[] = [];
  let platformNorm: LoadedSkill | undefined;
  let process: LoadedSkill | undefined;
  const support: LoadedSkill[] = [];

  if (input.platformNormSkill) {
    const loaded = loadSkill(input.platformNormSkill, skillsRoot);
    if (loaded) platformNorm = loaded;
    else missing.push(input.platformNormSkill);
  }

  if (input.processSkill) {
    const loaded = loadSkill(input.processSkill, skillsRoot);
    if (loaded) process = loaded;
    else missing.push(input.processSkill);
  }

  const supportSlugs = Array.from(
    new Set(
      (input.supportSkillSlugs ?? []).filter(
        (slug): slug is string => typeof slug === "string" && slug.trim().length > 0,
      ),
    ),
  );
  for (const slug of supportSlugs) {
    if (slug === input.platformNormSkill || slug === input.processSkill) {
      continue;
    }
    const loaded = loadSkill(slug, skillsRoot);
    if (loaded) support.push(loaded);
    else missing.push(slug);
  }

  return { platformNorm, process, support, missing };
}

function selectedCacheKey(
  skillsRoot: string,
  manifest: SkillManifestV1,
): string {
  return `${skillsRoot}::${manifest.slug}::${manifest.version}`;
}

function loadSelectedItem(
  skillsRoot: string,
  manifest: SkillManifestV1,
): SelectedSkillBundleItem | null {
  const skillPath = join(skillsRoot, manifest.slug, "SKILL.md");
  if (!existsSync(skillPath)) return null;
  const key = selectedCacheKey(skillsRoot, manifest);
  const cached = selectedBundleCache.get(key);
  const development = process.env.NODE_ENV === "development";
  if (cached) {
    if (!development || statSync(skillPath).mtimeMs === cached.mtimeMs) {
      selectedLoaderMetrics.skillBodyCacheHitCount += 1;
      return { ...cached.item, cacheStatus: "memory-hit" };
    }
  }

  const body = readSkillFile(skillPath);
  selectedLoaderMetrics.skillBodyReadCount += 1;
  const item: SelectedSkillBundleItem = {
    slug: manifest.slug,
    version: manifest.version,
    contentHash: sha256(body),
    cacheStatus: "miss",
    manifest,
    skillPath,
    body,
    referencePaths: listReferenceFiles(join(skillsRoot, manifest.slug)),
  };
  selectedBundleCache.set(key, {
    mtimeMs: statSync(skillPath).mtimeMs,
    item,
  });
  return item;
}

function fallbackForDecision(
  decision: SkillSelectionDecisionV1,
): SkillFallbackMode {
  if (decision.selectionSource === "intent") return "basic";
  if (decision.selectionSource === "continuation") return "retry";
  return "blocked";
}

export function loadSelectedSkillBundle(input: {
  decision: SkillSelectionDecisionV1;
  registry: SkillRegistrySnapshot;
  skillsRoot?: string;
  signal?: AbortSignal;
}): SelectedSkillBundleResult {
  const { decision, registry, signal } = input;
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const loadedItems: SelectedSkillBundleItem[] = [];
  if (signal?.aborted) {
    return { status: "cancelled", decisionId: decision.decisionId, loadedItems };
  }
  if (decision.decisionOutcome !== "selected" || !decision.primarySkillSlug) {
    return {
      status: "failed",
      decisionId: decision.decisionId,
      failedSkillSlug: decision.requestedSkillSlug ?? "unknown",
      failureStage: "selection",
      failureCode: "manifest_invalid",
      failureMessage: "A selected Decision is required before loading a Skill bundle.",
      fallbackMode: fallbackForDecision(decision),
      loadedItems,
    };
  }

  const slugs = [
    decision.primarySkillSlug,
    ...decision.requiredSkillSlugs.filter(
      (slug) => slug !== decision.primarySkillSlug,
    ),
  ];
  for (const [index, slug] of slugs.entries()) {
    if (signal?.aborted) {
      return {
        status: "cancelled",
        decisionId: decision.decisionId,
        loadedItems,
      };
    }
    const manifest = registry.bySlug.get(slug);
    if (!manifest || manifest.status !== "active") {
      return {
        status: "failed",
        decisionId: decision.decisionId,
        failedSkillSlug: slug,
        failureStage: index === 0 ? "manifest" : "dependency",
        failureCode: index === 0 ? "manifest_invalid" : "dependency_missing",
        failureMessage: `Skill manifest is unavailable: ${slug}.`,
        fallbackMode: fallbackForDecision(decision),
        loadedItems,
      };
    }
    const item = loadSelectedItem(skillsRoot, manifest);
    if (!item) {
      return {
        status: "failed",
        decisionId: decision.decisionId,
        failedSkillSlug: slug,
        failureStage: index === 0 ? "body" : "dependency",
        failureCode: index === 0 ? "body_missing" : "dependency_missing",
        failureMessage: `Skill body is unavailable: ${slug}.`,
        fallbackMode: fallbackForDecision(decision),
        loadedItems,
      };
    }
    loadedItems.push(item);
  }

  const items = [...loadedItems].sort((a, b) => a.slug.localeCompare(b.slug));
  const hitCount = items.filter(
    (item) => item.cacheStatus === "memory-hit",
  ).length;
  const bundleCacheStatus: SkillBundleCacheStatus =
    hitCount === items.length
      ? "full-hit"
      : hitCount === 0
        ? "miss"
        : "partial-hit";
  const canonicalBundle = items
    .map((item) => `${item.slug}\n${item.version}\n${item.contentHash}`)
    .join("\n---\n");
  const primary = loadedItems[0];
  return {
    status: "ready",
    decisionId: decision.decisionId,
    primary,
    required: loadedItems.slice(1),
    items,
    bundleHash: sha256(canonicalBundle),
    bundleCacheStatus,
  };
}

export function getSkillLoaderMetrics(): SkillLoaderMetrics {
  return { ...selectedLoaderMetrics };
}

export function resetSkillLoaderMetrics(): void {
  selectedLoaderMetrics.skillBodyReadCount = 0;
  selectedLoaderMetrics.skillBodyCacheHitCount = 0;
}

export function clearSelectedSkillBundleCache(slug?: string): void {
  if (!slug) {
    selectedBundleCache.clear();
    return;
  }
  for (const key of selectedBundleCache.keys()) {
    if (key.includes(`::${slug}::`)) selectedBundleCache.delete(key);
  }
}

/** 清除进程内缓存（测试或热更新后调用） */
export function clearSkillCache(): void {
  bundleCache.clear();
  selectedBundleCache.clear();
}

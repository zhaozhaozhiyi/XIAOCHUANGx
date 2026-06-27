import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveSkillsRoot } from "./paths.js";

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
  missing: string[];
};

type CacheEntry = { mtimeMs: number; loaded: LoadedSkill };

const bundleCache = new Map<string, CacheEntry>();

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
  if (hit && hit.mtimeMs === mtimeMs) return hit.loaded;

  const loaded = loadSkillFromDisk(skillsRoot, slug);
  if (!loaded) return null;
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
  skillsRoot?: string;
}): SkillBundle {
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const missing: string[] = [];
  let platformNorm: LoadedSkill | undefined;
  let process: LoadedSkill | undefined;

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

  return { platformNorm, process, missing };
}

/** 清除进程内缓存（测试或热更新后调用） */
export function clearSkillCache(): void {
  bundleCache.clear();
}

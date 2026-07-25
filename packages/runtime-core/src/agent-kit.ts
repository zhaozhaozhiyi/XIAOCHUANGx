import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolveAgentKitRoot, resolveSkillsRoot } from "./paths.js";
import { loadSkill } from "./skill-loader.js";
import type { SelectedSkillBundle } from "./skill-loader.js";

/** Deck / HTML-PPT 类 Skill 除 references 外需同步到 Agent Kit 的目录 */
const SKILL_ASSET_DIRS = ["references", "templates", "assets", "scripts", "examples"] as const;
const SELECTED_BUNDLE_ASSET_DIRS = [
  "references",
  "templates",
  "assets",
  "scripts",
] as const;

export type AgentKitMetrics = {
  agentKitCreateCount: number;
  assetFileCopyCount: number;
};

const agentKitMetrics: AgentKitMetrics = {
  agentKitCreateCount: 0,
  assetFileCopyCount: 0,
};

export type StagedReference = {
  name: string;
  absolutePath: string;
};

export type AgentKitStageResult = {
  agentKitPath: string;
  referencesDir: string;
  referenceFiles: StagedReference[];
};

/** 每次 Run 刷新；不写入用户 projectId 目录 */
export async function stageAgentKitForRun(input: {
  runId: string;
  processSkill?: string | null;
  supportSkillSlugs?: string[] | null;
  skillsRoot?: string;
}): Promise<AgentKitStageResult> {
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const agentKitPath = join(resolveAgentKitRoot(), "runs", input.runId);
  const referencesDir = join(agentKitPath, "references");

  await rm(agentKitPath, { recursive: true, force: true });
  await mkdir(referencesDir, { recursive: true });
  agentKitMetrics.agentKitCreateCount += 1;

  const referenceFiles: StagedReference[] = [];

  const skillSlugs = Array.from(
    new Set([
      ...(input.processSkill ? [input.processSkill] : []),
      ...(input.supportSkillSlugs ?? []),
    ]),
  );

  for (const skillSlug of skillSlugs) {
    const skill = loadSkill(skillSlug, skillsRoot);
    if (skill) {
      const isProcessSkill = skillSlug === input.processSkill;
      const skillDir = join(skillsRoot, skillSlug);
      for (const dirName of SKILL_ASSET_DIRS) {
        const srcDir = join(skillDir, dirName);
        if (!existsSync(srcDir)) continue;
        const destDir =
          dirName === "references"
            ? isProcessSkill
              ? referencesDir
              : join(referencesDir, skillSlug)
            : isProcessSkill
              ? join(agentKitPath, dirName)
              : join(agentKitPath, "support-skills", skillSlug, dirName);
        await mkdir(destDir, { recursive: true });
        const entries = await readdir(srcDir, { withFileTypes: true });
        for (const ent of entries) {
          const src = join(srcDir, ent.name);
          const dest = join(destDir, ent.name);
          if (ent.isDirectory()) {
            await cp(src, dest, { recursive: true });
          } else if (ent.isFile()) {
            await cp(src, dest);
          }
          agentKitMetrics.assetFileCopyCount += 1;
          const rel =
            dirName === "references"
              ? isProcessSkill
                ? ent.name
                : `${skillSlug}/${ent.name}`
              : isProcessSkill
                ? `${dirName}/${ent.name}`
                : `support-skills/${skillSlug}/${dirName}/${ent.name}`;
          referenceFiles.push({ name: rel, absolutePath: dest });
        }
      }
    }
  }

  return { agentKitPath, referencesDir, referenceFiles };
}

export async function stageAgentKitForSelectedBundle(input: {
  runId: string;
  bundle: SelectedSkillBundle;
  skillsRoot?: string;
}): Promise<AgentKitStageResult | null> {
  const selectedItems = [input.bundle.primary, ...input.bundle.required];
  const hasDeclaredAssets = selectedItems.some((item) =>
    Object.values(item.manifest.assetPolicy).some(Boolean),
  );
  if (!hasDeclaredAssets) return null;

  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const agentKitPath = join(resolveAgentKitRoot(), "runs", input.runId);
  const referencesDir = join(agentKitPath, "references");
  await rm(agentKitPath, { recursive: true, force: true });
  await mkdir(referencesDir, { recursive: true });
  agentKitMetrics.agentKitCreateCount += 1;
  const referenceFiles: StagedReference[] = [];

  for (const item of selectedItems) {
    const isPrimary = item.slug === input.bundle.primary.slug;
    const skillDir = join(skillsRoot, item.slug);
    for (const dirName of SELECTED_BUNDLE_ASSET_DIRS) {
      if (!item.manifest.assetPolicy[dirName]) continue;
      const srcDir = join(skillDir, dirName);
      if (!existsSync(srcDir)) {
        throw new Error(`Declared Skill asset directory is missing: ${item.slug}/${dirName}`);
      }
      const destDir =
        dirName === "references"
          ? isPrimary
            ? referencesDir
            : join(referencesDir, item.slug)
          : isPrimary
            ? join(agentKitPath, dirName)
            : join(agentKitPath, "support-skills", item.slug, dirName);
      await mkdir(destDir, { recursive: true });
      const entries = await readdir(srcDir, { withFileTypes: true });
      for (const entry of entries) {
        const src = join(srcDir, entry.name);
        const dest = join(destDir, entry.name);
        if (entry.isDirectory()) {
          await cp(src, dest, { recursive: true });
        } else if (entry.isFile()) {
          await cp(src, dest);
        }
        agentKitMetrics.assetFileCopyCount += 1;
        const relativeName =
          dirName === "references"
            ? isPrimary
              ? entry.name
              : `${item.slug}/${entry.name}`
            : isPrimary
              ? `${dirName}/${entry.name}`
              : `support-skills/${item.slug}/${dirName}/${entry.name}`;
        referenceFiles.push({ name: relativeName, absolutePath: dest });
      }
    }
  }
  return { agentKitPath, referencesDir, referenceFiles };
}

export function getAgentKitMetrics(): AgentKitMetrics {
  return { ...agentKitMetrics };
}

export function resetAgentKitMetrics(): void {
  agentKitMetrics.agentKitCreateCount = 0;
  agentKitMetrics.assetFileCopyCount = 0;
}

export function formatAgentKitSection(
  stage: AgentKitStageResult,
): string {
  if (stage.referenceFiles.length === 0) {
    return [
      "## 平台参考资料（Agent Kit）",
      "",
      `本 Run 的 Agent Kit 目录：\`${stage.agentKitPath}\``,
      "（当前流程 Skill 无 `references/` 文件。）",
    ].join("\n");
  }

  const lines = [
    "## 平台参考资料（Agent Kit）",
    "",
    "以下文件已由平台注入，**不在**用户项目工作区内。需要时请用读文件工具打开：",
    "",
  ];
  for (const f of stage.referenceFiles) {
    lines.push(`- \`${f.name}\` → ${f.absolutePath}`);
  }
  lines.push(
    "",
    `Agent Kit 根目录：\`${stage.agentKitPath}\``,
  );
  return lines.join("\n");
}

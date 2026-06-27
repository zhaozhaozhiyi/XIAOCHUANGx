import { existsSync } from "node:fs";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolveAgentKitRoot, resolveSkillsRoot } from "./paths.js";
import { loadSkill } from "./skill-loader.js";

/** Deck / HTML-PPT 类 Skill 除 references 外需同步到 Agent Kit 的目录 */
const SKILL_ASSET_DIRS = ["references", "templates", "assets", "scripts", "examples"] as const;

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
  skillsRoot?: string;
}): Promise<AgentKitStageResult> {
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const agentKitPath = join(resolveAgentKitRoot(), "runs", input.runId);
  const referencesDir = join(agentKitPath, "references");

  await rm(agentKitPath, { recursive: true, force: true });
  await mkdir(referencesDir, { recursive: true });

  const referenceFiles: StagedReference[] = [];

  if (input.processSkill) {
    const skill = loadSkill(input.processSkill, skillsRoot);
    if (skill) {
      const skillDir = join(skillsRoot, input.processSkill);
      for (const dirName of SKILL_ASSET_DIRS) {
        const srcDir = join(skillDir, dirName);
        if (!existsSync(srcDir)) continue;
        const destDir =
          dirName === "references"
            ? referencesDir
            : join(agentKitPath, dirName);
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
          const rel =
            dirName === "references"
              ? ent.name
              : `${dirName}/${ent.name}`;
          referenceFiles.push({ name: rel, absolutePath: dest });
        }
      }
    }
  }

  return { agentKitPath, referencesDir, referenceFiles };
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

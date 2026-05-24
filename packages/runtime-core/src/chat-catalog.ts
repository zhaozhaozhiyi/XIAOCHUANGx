import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSkillsRoot } from "./paths.js";
import { loadSkill } from "./skill-loader.js";

export type ChatCatalogEntry = {
  slug: string;
  kind: "workflow" | "tool" | string;
  scope: string[];
  summary: string;
  requires?: string[];
};

export type ChatCatalog = {
  version: string;
  description?: string;
  entries: ChatCatalogEntry[];
};

export type LoadedChatCatalog = ChatCatalog & {
  /** slug 在磁盘上无对应 Skill 目录 */
  missingSlugs: string[];
};

const CATALOG_FILENAME = "chat-catalog.json";

function isChatScoped(entry: ChatCatalogEntry): boolean {
  return entry.scope?.includes("chat") ?? false;
}

/** 读取 `skills/chat-catalog.json`（仅 `scope` 含 `chat` 的条目） */
export function loadChatCatalog(skillsRoot = resolveSkillsRoot()): LoadedChatCatalog {
  const path = join(skillsRoot, CATALOG_FILENAME);
  if (!existsSync(path)) {
    return { version: "0", entries: [], missingSlugs: [] };
  }

  const raw = JSON.parse(readFileSync(path, "utf8")) as ChatCatalog;
  const entries = (raw.entries ?? []).filter(isChatScoped);
  const missingSlugs: string[] = [];

  for (const entry of entries) {
    if (!loadSkill(entry.slug, skillsRoot)) {
      missingSlugs.push(entry.slug);
    }
  }

  return {
    version: raw.version ?? "1",
    description: raw.description,
    entries,
    missingSlugs,
  };
}

/** 拼入 system 的 Catalog 摘要段（不含 Skill 正文） */
export function formatChatCatalogForPrompt(catalog: LoadedChatCatalog): string {
  if (!catalog.entries.length) {
    return [
      "## Skill Catalog（可选参考）",
      "",
      "当前无扩展流程 Skill 目录；仅使用上文基座流程 Skill 与工具能力即可。",
    ].join("\n");
  }

  const lines = catalog.entries.map((e) => {
    const req =
      e.requires?.length ? ` [需: ${e.requires.join(", ")}]` : "";
    return `- **${e.slug}** (${e.kind}): ${e.summary}${req}`;
  });

  const missing =
    catalog.missingSlugs.length > 0
      ? `\n\n（以下目录暂未就绪，请勿引用：${catalog.missingSlugs.join(", ")}）`
      : "";

  return [
    "## Skill Catalog（可选参考）",
    "",
    "以下为对话可见 Skill **摘要**；**不包含** `SKILL.md` 正文。仅在任务与条目**明显相关**时，通过 Agent Kit 或 `skills/<slug>/` 按需读取；简单问答不必加载。",
    "",
    "<available_skills>",
    ...lines,
    "</available_skills>",
    missing,
  ]
    .join("\n")
    .trim();
}

/** 校验 Catalog 条目均有对应 Skill 目录（供 `pnpm skills:verify`） */
export function verifyChatCatalog(skillsRoot = resolveSkillsRoot()): {
  ok: boolean;
  missingSlugs: string[];
} {
  const catalog = loadChatCatalog(skillsRoot);
  return {
    ok: catalog.missingSlugs.length === 0,
    missingSlugs: catalog.missingSlugs,
  };
}

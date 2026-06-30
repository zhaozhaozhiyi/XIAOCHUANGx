import { loadChatCatalog, type LoadedChatCatalog } from "./chat-catalog.js";
import { normalizeChatMode } from "./chat-mode.js";
import { resolveSkillsRoot } from "./paths.js";

export const CHAT_ORCHESTRATION_MODE = "hybrid-steer" as const;

export const CHAT_BASE_SKILLS = {
  auto: "skill-qa",
  fast: "skill-qa-fast",
  deep: "skill-qa-deep",
} as const;

export const CHAT_PLATFORM_NORM_SKILL = "skill-platform-research-norms" as const;

export type ChatOrchestration = {
  orchestrationMode: typeof CHAT_ORCHESTRATION_MODE;
  baseProcessSkill: string;
  platformNormSkill: typeof CHAT_PLATFORM_NORM_SKILL;
  catalog: LoadedChatCatalog;
  catalogSlugs: string[];
  catalogVersion: string;
};

/**
 * 对话模块编排解析（F-RT-008）：轻 Push 基座 + Catalog 可见，无 mandatory augment。
 */
export function resolveChatOrchestration(input: {
  mode: string;
  skillsRoot?: string;
}): ChatOrchestration {
  const skillsRoot = input.skillsRoot ?? resolveSkillsRoot();
  const mode = normalizeChatMode(input.mode) ?? "auto";
  const catalog = loadChatCatalog(skillsRoot);

  return {
    orchestrationMode: CHAT_ORCHESTRATION_MODE,
    baseProcessSkill: CHAT_BASE_SKILLS[mode],
    platformNormSkill: CHAT_PLATFORM_NORM_SKILL,
    catalog,
    catalogSlugs: catalog.entries.map((e) => e.slug),
    catalogVersion: catalog.version,
  };
}

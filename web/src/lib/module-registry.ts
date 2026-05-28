/**
 * 模块注册表 — 与 PRD §6.10.1a、功能清单「模块注册表」一致。
 * 一级菜单 = 产品模块 + 领域服务；流程 Skill 绑在 mode / templateId / task。
 */

import { normalizeChatMode } from "@jlc/runtime-core/chat-mode";

export const PLATFORM_NORM_SKILL = "skill-platform-research-norms";

export type ModuleId =
  | "chat"
  | "meeting"
  | "knowledge"
  | "writing"
  | "ppt"
  | "translate";

export type DomainService =
  | "choice-terminal"
  | "chart-engine"
  | "asr"
  | "rag"
  | "doc-storage"
  | "slide-engine"
  | "translate-engine";

export type ModuleRegistryEntry = {
  moduleId: ModuleId;
  label: string;
  domainServices: DomainService[];
  /** MVP 是否以 Agent + 流程 Skill 为主路径 */
  agentPrimaryPath: boolean;
  /**
   * 是否可能产生 XIAOCHUANG 工作区文件（§5.3.2.1a）。
   * 翻译：仅文档翻译或用户导出译文时建任务目录；纯文本历史可仅存 DB。
   */
  producesWorkspaceArtifacts: boolean;
  /** XIAOCHUANG 一级目录名；仅 producesWorkspaceArtifacts=true 时有效 */
  workspaceSegment?: string;
};

export const MODULE_REGISTRY: Record<ModuleId, ModuleRegistryEntry> = {
  chat: {
    moduleId: "chat",
    label: "对话",
    domainServices: ["choice-terminal", "chart-engine"],
    agentPrimaryPath: true,
    producesWorkspaceArtifacts: true,
    workspaceSegment: "会话",
  },
  meeting: {
    moduleId: "meeting",
    label: "会议",
    domainServices: ["asr"],
    agentPrimaryPath: true,
    producesWorkspaceArtifacts: true,
    workspaceSegment: "会议",
  },
  knowledge: {
    moduleId: "knowledge",
    label: "知识库",
    domainServices: ["doc-storage", "rag"],
    agentPrimaryPath: false,
    producesWorkspaceArtifacts: false,
  },
  writing: {
    moduleId: "writing",
    label: "写作",
    domainServices: ["choice-terminal", "chart-engine"],
    agentPrimaryPath: true,
    producesWorkspaceArtifacts: true,
    workspaceSegment: "写作",
  },
  ppt: {
    moduleId: "ppt",
    label: "PPT",
    domainServices: ["slide-engine"],
    agentPrimaryPath: true,
    producesWorkspaceArtifacts: true,
    workspaceSegment: "PPT",
  },
  translate: {
    moduleId: "translate",
    label: "翻译",
    domainServices: ["translate-engine"],
    agentPrimaryPath: false,
    producesWorkspaceArtifacts: true,
    workspaceSegment: "翻译",
  },
};

/** §5.3.2.1a：模块 → XIAOCHUANG 一级目录名 */
export function getModuleWorkspaceSegment(moduleId: ModuleId): string | undefined {
  return MODULE_REGISTRY[moduleId].workspaceSegment;
}

/** 对话页内模式 → 流程 Skill（`research` 为 API 别名，见 normalizeChatMode） */
export const CHAT_MODE_SKILL: Record<string, string> = {
  fast: "skill-qa-fast",
  deep: "skill-qa-deep",
  research: "skill-qa-deep",
};

/** 写作 templateId（路由段）→ 流程 Skill */
export const WRITING_TEMPLATE_SKILL: Record<string, string> = {
  policy: "skill-wr-policy",
  topic: "skill-wr-topic",
  industry: "skill-wr-industry",
  macro: "skill-wr-macro",
  "sector-data": "skill-wr-sector-data",
};

/**
 * PPT 路演 templateId → 流程 Skill（由 Open Design 批量同步，见 skills/ppt-sync-manifest.json）
 */
/** 会议 templateId（可选）→ 流程 Skill；缺省见 resolveSkills meeting 分支 */
export const MEETING_TEMPLATE_SKILL: Record<string, string> = {
  default: "skill-mm-summary",
  "daily-standup": "skill-mm-daily-standup",
  "client-review": "skill-mm-client-review",
  "internal-decision": "skill-mm-internal-decision",
};

export const MEETING_TEMPLATE_PACK: Record<string, string> = {
  default: "tpl-mm-default",
  "daily-standup": "tpl-mm-daily-standup",
  "client-review": "tpl-mm-client-review",
  "internal-decision": "tpl-mm-internal-decision",
};

/** 会议类型展示（新建纪要页；不选则走 default / skill-mm-summary） */
export const MEETING_TEMPLATE_CATALOG: Array<{
  templateId: string;
  label: string;
  description: string;
}> = [
  {
    templateId: "default",
    label: "通用会议纪要",
    description: "概要、大纲、QA、待办与全文转写（默认）",
  },
  {
    templateId: "daily-standup",
    label: "站会 / 周会速记",
    description: "昨日进展、今日计划、阻塞项",
  },
  {
    templateId: "client-review",
    label: "客户沟通纪要",
    description: "客户诉求、我方回应、跟进事项",
  },
  {
    templateId: "internal-decision",
    label: "内部研讨 / 投决",
    description: "议题、观点、结论与决策待办",
  },
];

export const PPT_TEMPLATE_SKILL: Record<string, string> = {
  default: "skill-ppt-deck",
  "pitch-deck": "skill-ppt-pitch-deck",
  "tech-sharing": "skill-ppt-tech-sharing",
  "weekly-report": "skill-ppt-weekly-report",
  "quarterly-review": "skill-ppt-quarterly-review",
  "fintech-swiss": "skill-ppt-fintech-swiss",
  "guizang-editorial": "skill-ppt-guizang-editorial",
  "swiss-international": "skill-ppt-swiss-international",
  "open-canvas": "skill-ppt-open-canvas",
  "knowledge-arch": "skill-ppt-knowledge-arch",
  "blue-professional": "skill-ppt-blue-professional",
  "editorial-burgundy": "skill-ppt-editorial-burgundy",
};

export const PPT_TEMPLATE_PACK: Record<string, string> = {
  default: "tpl-ppt-default",
  "pitch-deck": "tpl-ppt-pitch-deck",
  "tech-sharing": "tpl-ppt-tech-sharing",
  "weekly-report": "tpl-ppt-weekly-report",
  "quarterly-review": "tpl-ppt-quarterly-review",
  "fintech-swiss": "tpl-ppt-fintech-swiss",
  "guizang-editorial": "tpl-ppt-guizang-editorial",
  "swiss-international": "tpl-ppt-swiss-international",
  "open-canvas": "tpl-ppt-open-canvas",
  "knowledge-arch": "tpl-ppt-knowledge-arch",
  "blue-professional": "tpl-ppt-blue-professional",
  "editorial-burgundy": "tpl-ppt-editorial-burgundy",
};

/** 路演模板展示（PPT 模块 UI） */
export const PPT_TEMPLATE_CATALOG: Array<{
  templateId: string;
  label: string;
  description: string;
}> = [
  { templateId: "pitch-deck", label: "路演 Pitch", description: "融资 / 客户路演，10 页结构" },
  { templateId: "weekly-report", label: "周报", description: "品种周度跟踪与数据摘要" },
  { templateId: "quarterly-review", label: "季报回顾", description: "季度复盘与路线图" },
  { templateId: "fintech-swiss", label: "金融科技瑞系", description: "数据驱动、瑞士网格" },
  { templateId: "tech-sharing", label: "技术分享", description: "内部分享与方法论" },
  { templateId: "knowledge-arch", label: "知识架构", description: "框架与体系梳理" },
  { templateId: "blue-professional", label: "专业蓝", description: "机构研报风格" },
  { templateId: "guizang-editorial", label: "杂志风编辑", description: "叙事与观点表达" },
  { templateId: "swiss-international", label: "瑞士国际", description: "极简网格与强排版" },
  { templateId: "editorial-burgundy", label: "编辑工作室", description: "文化叙事与原则清单" },
  { templateId: "open-canvas", label: "自由画布", description: "自定义排版的 1920×1080 画布" },
];

export type SkillResolveInput =
  | { moduleId: "chat"; binding: { mode: string } }
  | { moduleId: "meeting"; binding: { task: "summary"; templateId?: string } }
  | { moduleId: "knowledge"; binding: { task: "kb-qa" } }
  | { moduleId: "writing"; binding: { templateId: string } }
  | { moduleId: "ppt"; binding: { task: "deck"; templateId?: string } }
  | { moduleId: "translate"; binding?: never };

export type ResolvedSkills = {
  processSkill: string | null;
  platformNormSkill: typeof PLATFORM_NORM_SKILL;
  templatePackId: string | null;
};

export function resolveSkills(input: SkillResolveInput): ResolvedSkills {
  const base: ResolvedSkills = {
    platformNormSkill: PLATFORM_NORM_SKILL,
    processSkill: null,
    templatePackId: null,
  };

  switch (input.moduleId) {
    case "chat": {
      const mode =
        normalizeChatMode(input.binding.mode) ?? input.binding.mode;
      base.processSkill = CHAT_MODE_SKILL[mode] ?? "skill-qa-fast";
      return base;
    }
    case "meeting": {
      const tid = input.binding.templateId?.trim() || "default";
      base.processSkill =
        MEETING_TEMPLATE_SKILL[tid] ?? MEETING_TEMPLATE_SKILL.default;
      base.templatePackId =
        MEETING_TEMPLATE_PACK[tid] ?? MEETING_TEMPLATE_PACK.default;
      return base;
    }
    case "knowledge":
      base.processSkill = "skill-kb-qa";
      return base;
    case "writing": {
      const tid = input.binding.templateId;
      base.processSkill =
        WRITING_TEMPLATE_SKILL[tid] ?? `skill-wr-${tid}`;
      base.templatePackId = `tpl-wr-${tid}`;
      return base;
    }
    case "ppt": {
      const tid = input.binding.templateId ?? "default";
      base.processSkill =
        PPT_TEMPLATE_SKILL[tid] ?? PPT_TEMPLATE_SKILL.default;
      base.templatePackId =
        PPT_TEMPLATE_PACK[tid] ?? PPT_TEMPLATE_PACK.default;
      return base;
    }
    case "translate":
      return base;
    default:
      return base;
  }
}

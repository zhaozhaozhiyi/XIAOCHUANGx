/**
 * 模块注册表 — 与 PRD §6.10.1a、功能清单「模块注册表」一致。
 * 一级菜单 = 产品模块 + 领域服务；流程 Skill 绑在 mode / templateId / task。
 */

import { normalizeChatMode } from "@jlc/runtime-core/chat-mode";

export const PLATFORM_NORM_SKILL = "skill-platform-research-norms";

export const WRITING_DEFAULT_SKILL = "skill-writing-general";

export const TRANSLATE_DEFAULT_SKILL = "skill-tr-text";

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
  /** 是否可能产生 XIAOCHUANG 工作区文件（§5.3.2.1a） */
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
    agentPrimaryPath: true,
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
  general: WRITING_DEFAULT_SKILL,
  "official-doc": "skill-writing-official-doc",
  "meeting-minutes": "skill-writing-meeting-minutes",
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

/** 与 skills/skill-ppt-* 及 skills/ppt-sync-manifest.json 对齐 */
export const PPT_SKILL_CATALOG = [
  {
    templateId: "pitch-deck",
    label: "路演 Pitch Deck",
    description: "融资 / 客户路演，10 页结构",
    skill: "skill-ppt-pitch-deck",
    templatePackId: "tpl-ppt-pitch-deck",
    kind: "workflow",
  },
  {
    templateId: "deck",
    label: "演示文稿（默认流程）",
    description: "HTML 幻灯片默认生成与 PPTX 导出",
    skill: "skill-ppt-deck",
    templatePackId: "tpl-ppt-default",
    kind: "workflow",
  },
  {
    templateId: "weekly-report",
    label: "周报",
    description: "品种周度跟踪与数据摘要",
    skill: "skill-ppt-weekly-report",
    templatePackId: "tpl-ppt-weekly-report",
    kind: "workflow",
  },
  {
    templateId: "quarterly-review",
    label: "复古季报回顾",
    description: "季度复盘、路线图与关键指标",
    skill: "skill-ppt-quarterly-review",
    templatePackId: "tpl-ppt-quarterly-review",
    kind: "workflow",
  },
  {
    templateId: "tech-sharing",
    label: "技术分享",
    description: "内部分享与方法论",
    skill: "skill-ppt-tech-sharing",
    templatePackId: "tpl-ppt-tech-sharing",
    kind: "workflow",
  },
  {
    templateId: "fintech-swiss",
    label: "金融科技瑞系",
    description: "数据驱动、瑞士网格",
    skill: "skill-ppt-fintech-swiss",
    templatePackId: "tpl-ppt-fintech-swiss",
    kind: "workflow",
  },
  {
    templateId: "knowledge-arch",
    label: "知识架构蓝图",
    description: "框架与体系梳理",
    skill: "skill-ppt-knowledge-arch",
    templatePackId: "tpl-ppt-knowledge-arch",
    kind: "workflow",
  },
  {
    templateId: "blue-professional",
    label: "专业蓝",
    description: "机构研报风格幻灯片",
    skill: "skill-ppt-blue-professional",
    templatePackId: "tpl-ppt-blue-professional",
    kind: "workflow",
  },
  {
    templateId: "guizang-editorial",
    label: "归藏编辑墨水",
    description: "杂志风叙事与多调色板",
    skill: "skill-ppt-guizang-editorial",
    templatePackId: "tpl-ppt-guizang-editorial",
    kind: "workflow",
  },
  {
    templateId: "swiss-international",
    label: "瑞士国际主义",
    description: "极简网格与强排版",
    skill: "skill-ppt-swiss-international",
    templatePackId: "tpl-ppt-swiss-international",
    kind: "workflow",
  },
  {
    templateId: "editorial-burgundy",
    label: "编辑工作室",
    description: "文化叙事与原则清单",
    skill: "skill-ppt-editorial-burgundy",
    templatePackId: "tpl-ppt-editorial-burgundy",
    kind: "workflow",
  },
  {
    templateId: "open-canvas",
    label: "自由画布",
    description: "1920×1080 自定义排版",
    skill: "skill-ppt-open-canvas",
    templatePackId: "tpl-ppt-open-canvas",
    kind: "workflow",
  },
  {
    templateId: "html-studio",
    label: "HTML 工作室",
    description: "多风格 HTML 幻灯片主技能",
    skill: "skill-ppt-html-studio",
    kind: "utility",
  },
  {
    templateId: "pptx",
    label: "PPTX 读写",
    description: "原生 PPTX 读写与编辑（Anthropic）",
    skill: "skill-ppt-pptx",
    kind: "utility",
  },
  {
    templateId: "pptx-generator",
    label: "PPTX 生成器",
    description: "PptxGenJS 生成演示稿",
    skill: "skill-ppt-pptx-generator",
    kind: "utility",
  },
  {
    templateId: "slides",
    label: "Markdown 幻灯片",
    description: "Markdown 转幻灯片（OpenAI Slides）",
    skill: "skill-ppt-slides",
    kind: "utility",
  },
  {
    templateId: "fidelity-audit",
    label: "保真度审计",
    description: "HTML 与 PPTX 导出对照与修复",
    skill: "skill-ppt-fidelity-audit",
    kind: "utility",
  },
] as const;

export type PptSkillCatalogEntry = (typeof PPT_SKILL_CATALOG)[number];

export const PPT_TEMPLATE_SKILL: Record<string, string> = {
  default: "skill-ppt-pitch-deck",
  ...Object.fromEntries(
    PPT_SKILL_CATALOG.map((e) => [e.templateId, e.skill]),
  ),
};

export const PPT_TEMPLATE_PACK: Record<string, string> = {
  default: "tpl-ppt-pitch-deck",
  ...Object.fromEntries(
    PPT_SKILL_CATALOG.filter(
      (e): e is PptSkillCatalogEntry & { templatePackId: string } =>
        "templatePackId" in e && Boolean(e.templatePackId),
    ).map((e) => [e.templateId, e.templatePackId]),
  ),
};

/** PPT 模块模板展示（Composer 下拉等） */
export const PPT_TEMPLATE_CATALOG = PPT_SKILL_CATALOG.map(
  ({ templateId, label, description }) => ({
    templateId,
    label,
    description,
  }),
);

/** 翻译 templateId（Composer 下拉值）→ 流程 Skill */
export const TRANSLATE_TEMPLATE_SKILL: Record<string, string> = {
  text: "skill-tr-text",
  doc: "skill-tr-doc",
  polish: "skill-tr-polish",
};

export type SkillResolveInput =
  | { moduleId: "chat"; binding: { mode: string } }
  | { moduleId: "meeting"; binding: { task: "summary"; templateId?: string } }
  | { moduleId: "knowledge"; binding: { task: "kb-qa" } }
  | { moduleId: "writing"; binding?: { templateId?: string } }
  | { moduleId: "ppt"; binding: { task: "deck"; templateId?: string } }
  | {
      moduleId: "translate";
      binding?: { task?: "translate"; templateId?: string };
    };

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
      const tid = input.binding?.templateId?.trim();
      if (tid) {
        base.processSkill =
          WRITING_TEMPLATE_SKILL[tid] ?? `skill-wr-${tid}`;
        base.templatePackId = `tpl-wr-${tid}`;
      } else {
        base.processSkill = WRITING_DEFAULT_SKILL;
      }
      return base;
    }
    case "ppt": {
      const tid = input.binding.templateId?.trim() || "pitch-deck";
      base.processSkill =
        PPT_TEMPLATE_SKILL[tid] ??
        PPT_TEMPLATE_SKILL.default ??
        `skill-ppt-${tid}`;
      base.templatePackId = PPT_TEMPLATE_PACK[tid] ?? null;
      return base;
    }
    case "translate": {
      const tid = input.binding?.templateId?.trim();
      if (tid) {
        base.processSkill =
          TRANSLATE_TEMPLATE_SKILL[tid] ?? `skill-tr-${tid}`;
      } else {
        base.processSkill = TRANSLATE_DEFAULT_SKILL;
      }
      return base;
    }
    default:
      return base;
  }
}

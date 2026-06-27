import {
  type ModuleId,
  PPT_SKILL_CATALOG,
  WRITING_BASE_SKILL,
  WRITING_DEFAULT_SKILL,
} from "@/lib/module-registry";

export { WRITING_DEFAULT_SKILL };
export const INDUSTRIAL_DRAWING_BASE_SKILL = "skill-industrial-drawing-base";
export const VIDEO_BASE_SKILL = "skill-vp-base";
export const SIMULATION_BASE_SKILL = "skill-simulation-base";

/** 复用对话 UI 的模块 */
export type ChatSurfaceModuleId = Extract<
  ModuleId,
  "chat" | "writing" | "ppt" | "3d" | "video" | "simulation"
>;

export type ModuleSkillPickerKind = Extract<
  ChatSurfaceModuleId,
  "writing" | "ppt"
>;

export const PPT_DEFAULT_SKILL = "skill-ppt-base";

export type ModuleSkillOption = {
  templateId: string;
  label: string;
  description: string;
};

/** 写作 Composer 底栏 Skill（templateId → WRITING_TEMPLATE_SKILL） */
export const WRITING_SKILL_OPTIONS = [
  {
    templateId: "general",
    label: "通用",
    description: "研报、行业分析、一般文稿",
  },
  {
    templateId: "official-doc",
    label: "公文",
    description: "通知、请示、报告、函件等",
  },
  {
    templateId: "meeting-minutes",
    label: "会议纪要",
    description: "议题、决议与待办事项",
  },
] as const satisfies readonly ModuleSkillOption[];

export type WritingSkillTemplateId =
  (typeof WRITING_SKILL_OPTIONS)[number]["templateId"];

export const DEFAULT_WRITING_SKILL_TEMPLATE_ID: WritingSkillTemplateId =
  "general";

/** PPT Composer 底栏 Skill（与 PPT_SKILL_CATALOG / skills/skill-ppt-* 对齐） */
export const PPT_SKILL_OPTIONS: readonly ModuleSkillOption[] =
  PPT_SKILL_CATALOG.map(({ templateId, label, description }) => ({
    templateId,
    label,
    description,
  }));

export type PptSkillTemplateId =
  (typeof PPT_SKILL_CATALOG)[number]["templateId"];

export const DEFAULT_PPT_SKILL_TEMPLATE_ID: PptSkillTemplateId = "pitch-deck";

const SKILL_STORAGE_PREFIX: Record<ModuleSkillPickerKind, string> = {
  writing: "jlc-writing-skill",
  ppt: "jlc-ppt-skill",
};

const SKILL_OPTIONS: Record<
  ModuleSkillPickerKind,
  readonly ModuleSkillOption[]
> = {
  writing: WRITING_SKILL_OPTIONS,
  ppt: PPT_SKILL_OPTIONS,
};

const DEFAULT_SKILL_TEMPLATE_ID: Record<ModuleSkillPickerKind, string> = {
  writing: DEFAULT_WRITING_SKILL_TEMPLATE_ID,
  ppt: DEFAULT_PPT_SKILL_TEMPLATE_ID,
};

export function moduleSkillStorageKey(
  kind: ModuleSkillPickerKind,
  sessionId?: string,
): string {
  const prefix = SKILL_STORAGE_PREFIX[kind];
  return sessionId ? `${prefix}-${sessionId}` : `${prefix}-draft`;
}

export function getModuleSkillOptions(
  kind: ModuleSkillPickerKind,
): readonly ModuleSkillOption[] {
  return SKILL_OPTIONS[kind];
}

export function readStoredModuleSkillTemplateId(
  kind: ModuleSkillPickerKind,
  sessionId?: string,
): string {
  if (typeof window === "undefined") {
    return DEFAULT_SKILL_TEMPLATE_ID[kind];
  }
  const raw = localStorage.getItem(moduleSkillStorageKey(kind, sessionId));
  if (SKILL_OPTIONS[kind].some((o) => o.templateId === raw)) {
    return raw as string;
  }
  return DEFAULT_SKILL_TEMPLATE_ID[kind];
}

export function writeStoredModuleSkillTemplateId(
  kind: ModuleSkillPickerKind,
  templateId: string,
  sessionId?: string,
): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(moduleSkillStorageKey(kind, sessionId), templateId);
}

export const MODULE_SKILL_CHANGED_EVENT = "jlc-module-skill-changed";

export function notifyModuleSkillTemplateChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MODULE_SKILL_CHANGED_EVENT));
}

/** @deprecated 使用 readStoredModuleSkillTemplateId("writing", …) */
export function readStoredWritingSkillTemplateId(
  sessionId?: string,
): WritingSkillTemplateId {
  return readStoredModuleSkillTemplateId(
    "writing",
    sessionId,
  ) as WritingSkillTemplateId;
}

/** @deprecated 使用 writeStoredModuleSkillTemplateId("writing", …) */
export function writeStoredWritingSkillTemplateId(
  templateId: WritingSkillTemplateId,
  sessionId?: string,
): void {
  writeStoredModuleSkillTemplateId("writing", templateId, sessionId);
}

export type ModuleChatSurfaceConfig = {
  moduleId: ChatSurfaceModuleId;
  basePath: string;
  newSessionHref: string;
  newSessionLabel: string;
  homeTitle: string;
  homeSubtitle: string;
  threadTitleFallback: string;
  defaultSessionTitle: string;
  showModePicker: boolean;
  /** 底栏 Skill 下拉（写作 / PPT） */
  skillPicker?: ModuleSkillPickerKind;
  defaultProcessSkill: string | null;
  ensureModuleId: ModuleId;
};

export const MODULE_CHAT_SURFACES: Record<
  ChatSurfaceModuleId,
  ModuleChatSurfaceConfig
> = {
  chat: {
    moduleId: "chat",
    basePath: "/chat",
    newSessionHref: "/chat",
    newSessionLabel: "新对话",
    homeTitle: "今天要处理什么？",
    homeSubtitle: "查资料、写文档、做演示——小窗专注本地工作区里的连续办公流程",
    threadTitleFallback: "对话",
    defaultSessionTitle: "新对话",
    showModePicker: false,
    defaultProcessSkill: null,
    ensureModuleId: "chat",
  },
  writing: {
    moduleId: "writing",
    basePath: "/writing",
    newSessionHref: "/writing/new",
    newSessionLabel: "新建写作",
    homeTitle: "今天要写什么？",
    homeSubtitle: "描述主题与要求，助手将产出 Markdown 文稿并写入工作区",
    threadTitleFallback: "写作",
    defaultSessionTitle: "新写作",
    showModePicker: false,
    skillPicker: "writing",
    defaultProcessSkill: WRITING_BASE_SKILL,
    ensureModuleId: "writing",
  },
  ppt: {
    moduleId: "ppt",
    basePath: "/ppt",
    newSessionHref: "/ppt/new",
    newSessionLabel: "新建 PPT",
    homeTitle: "今天要做什么演示？",
    homeSubtitle: "描述主题与风格，助手将生成幻灯片并写入工作区",
    threadTitleFallback: "PPT",
    defaultSessionTitle: "新 PPT",
    showModePicker: false,
    skillPicker: "ppt",
    defaultProcessSkill: PPT_DEFAULT_SKILL,
    ensureModuleId: "ppt",
  },
  "3d": {
    moduleId: "3d",
    basePath: "/3d",
    newSessionHref: "/3d/new",
    newSessionLabel: "新建 3D 图纸",
    homeTitle: "今天要画什么工业结构？",
    homeSubtitle: "描述零件、支架、容器或设备草模需求，助手将按工业制图 Skill 链路生成可继续预览与导出的图纸结果",
    threadTitleFallback: "3D",
    defaultSessionTitle: "新 3D 图纸",
    showModePicker: false,
    defaultProcessSkill: INDUSTRIAL_DRAWING_BASE_SKILL,
    ensureModuleId: "3d",
  },
  video: {
    moduleId: "video",
    basePath: "/video",
    newSessionHref: "/video/new",
    newSessionLabel: "新建视频",
    homeTitle: "今天要做什么视频？",
    homeSubtitle: "描述主题、受众、时长和画幅，助手将生成可预览、可录屏的网页视频项目",
    threadTitleFallback: "视频",
    defaultSessionTitle: "新视频",
    showModePicker: false,
    defaultProcessSkill: VIDEO_BASE_SKILL,
    ensureModuleId: "video",
  },
  simulation: {
    moduleId: "simulation",
    basePath: "/simulation",
    newSessionHref: "/simulation/new",
    newSessionLabel: "新建推演",
    homeTitle: "今天要推演什么问题？",
    homeSubtitle: "描述主体、变量和假设，助手将把复杂问题整理为可继续推进的推演过程",
    threadTitleFallback: "推演",
    defaultSessionTitle: "新推演",
    showModePicker: false,
    defaultProcessSkill: SIMULATION_BASE_SKILL,
    ensureModuleId: "simulation",
  },
};

export function getChatSurfaceFromPathname(
  pathname: string,
): ModuleChatSurfaceConfig {
  if (pathname === "/video" || pathname.startsWith("/video/")) {
    return MODULE_CHAT_SURFACES.video;
  }
  if (pathname === "/simulation" || pathname.startsWith("/simulation/")) {
    return MODULE_CHAT_SURFACES.simulation;
  }
  if (pathname === "/3d" || pathname.startsWith("/3d/")) {
    return MODULE_CHAT_SURFACES["3d"];
  }
  if (pathname === "/ppt" || pathname.startsWith("/ppt/")) {
    return MODULE_CHAT_SURFACES.ppt;
  }
  if (pathname === "/writing" || pathname.startsWith("/writing/")) {
    return MODULE_CHAT_SURFACES.writing;
  }
  return MODULE_CHAT_SURFACES.chat;
}

export function sessionPath(
  surface: ModuleChatSurfaceConfig,
  sessionId: string,
): string {
  return `${surface.basePath}/${sessionId}`;
}

export function sessionHrefFromNewEntry(
  newSessionHref: string,
  sessionId: string,
): string {
  if (newSessionHref.endsWith("/new")) {
    return `${newSessionHref.slice(0, -4)}/${sessionId}`;
  }
  if (newSessionHref === "/chat") return `/chat/${sessionId}`;
  const separator = newSessionHref.includes("?") ? "&" : "?";
  return `${newSessionHref}${separator}session=${encodeURIComponent(sessionId)}`;
}

import type { ModuleSkillPickerKind } from "@/lib/module-chat-config";

/** 模板预览载体：按模块可扩展，不限于 HTML */
export type TemplatePreviewKind =
  | "html-deck"
  | "docx"
  | "markdown"
  | "images";

export type TemplateCoverTheme = {
  /** 卡片封面渐变 */
  gradient: string;
  /** 点缀色 */
  accent: string;
};

export type TemplatePreviewConfig = {
  templateId: string;
  kind: TemplatePreviewKind;
  /** public 下路径，如 /template-previews/ppt/pitch-deck/index.html */
  assetUrl: string;
  /** html-deck / images 可翻页数 */
  pageCount?: number;
  coverLabel?: string;
  coverTheme?: TemplateCoverTheme;
};

const COVER_THEMES: Record<string, TemplateCoverTheme> = {
  "pitch-deck": {
    gradient:
      "linear-gradient(145deg, #1e3a8a 0%, #312e81 48%, #0f172a 100%)",
    accent: "#93c5fd",
  },
  "weekly-report": {
    gradient: "linear-gradient(160deg, #f8fafc 0%, #e2e8f0 55%, #cbd5e1 100%)",
    accent: "#0284c7",
  },
  "tech-sharing": {
    gradient: "linear-gradient(155deg, #18181b 0%, #27272a 50%, #09090b 100%)",
    accent: "#67e8f9",
  },
  "blue-professional": {
    gradient: "linear-gradient(165deg, #eff6ff 0%, #dbeafe 45%, #bfdbfe 100%)",
    accent: "#1d4ed8",
  },
  general: {
    gradient: "linear-gradient(160deg, #faf9f5 0%, #f0eee6 50%, #e8e6dc 100%)",
    accent: "#c96442",
  },
  "official-doc": {
    gradient: "linear-gradient(160deg, #fffbeb 0%, #fef3c7 40%, #fde68a 100%)",
    accent: "#b45309",
  },
  "meeting-minutes": {
    gradient: "linear-gradient(160deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
    accent: "#15803d",
  },
};

function withTheme(
  entry: Omit<TemplatePreviewConfig, "coverTheme">,
): TemplatePreviewConfig {
  return {
    ...entry,
    coverTheme: COVER_THEMES[entry.templateId],
  };
}

export function previewKindLabel(kind: TemplatePreviewKind): string {
  switch (kind) {
    case "html-deck":
      return "幻灯片";
    case "docx":
      return "Word";
    case "markdown":
      return "Markdown";
    case "images":
      return "图集";
  }
}

const WRITING_PREVIEWS: TemplatePreviewConfig[] = [
  withTheme({
    templateId: "general",
    kind: "markdown",
    assetUrl: "/template-previews/writing/general/sample.md",
    coverLabel: "通用研报样稿",
  }),
  withTheme({
    templateId: "official-doc",
    kind: "docx",
    assetUrl: "/template-previews/writing/official-doc/sample.docx",
    coverLabel: "公文版式样稿",
  }),
  withTheme({
    templateId: "meeting-minutes",
    kind: "markdown",
    assetUrl: "/template-previews/writing/meeting-minutes/sample.md",
    coverLabel: "会议纪要样稿",
  }),
];

/** Demo：先覆盖常用 workflow 模板；其余 Skill 仍可通过下拉使用 */
const PPT_PREVIEWS: TemplatePreviewConfig[] = [
  withTheme({
    templateId: "pitch-deck",
    kind: "html-deck",
    assetUrl: "/template-previews/ppt/pitch-deck/index.html",
    pageCount: 3,
    coverLabel: "路演 Pitch",
  }),
  withTheme({
    templateId: "weekly-report",
    kind: "html-deck",
    assetUrl: "/template-previews/ppt/weekly-report/index.html",
    pageCount: 3,
    coverLabel: "周报",
  }),
  withTheme({
    templateId: "tech-sharing",
    kind: "html-deck",
    assetUrl: "/template-previews/ppt/tech-sharing/index.html",
    pageCount: 3,
    coverLabel: "技术分享",
  }),
  withTheme({
    templateId: "blue-professional",
    kind: "html-deck",
    assetUrl: "/template-previews/ppt/blue-professional/index.html",
    pageCount: 3,
    coverLabel: "专业蓝",
  }),
];

/**
 * 翻译模块暂不展示版式预览（场景由 SKILL.md 定义而非视觉模板）。
 * 留空数组：TemplateSkillGallery 在卡片为 0 时降级为下拉式 Skill 选择。
 */
const TRANSLATE_PREVIEWS: TemplatePreviewConfig[] = [];

const BY_MODULE: Record<ModuleSkillPickerKind, TemplatePreviewConfig[]> = {
  writing: WRITING_PREVIEWS,
  ppt: PPT_PREVIEWS,
  translate: TRANSLATE_PREVIEWS,
};

export function getTemplatePreview(
  module: ModuleSkillPickerKind,
  templateId: string,
): TemplatePreviewConfig | undefined {
  return BY_MODULE[module].find((p) => p.templateId === templateId);
}

export function listTemplatePreviews(
  module: ModuleSkillPickerKind,
): TemplatePreviewConfig[] {
  return BY_MODULE[module];
}

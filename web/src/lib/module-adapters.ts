import type { ModuleAdapter, ModuleAction } from "@jlc/contracts";

import {
  INDUSTRIAL_DRAWING_BASE_SKILL,
  PPT_DEFAULT_SKILL,
  SIMULATION_BASE_SKILL,
  SIMULATION_WORLD_MODEL_SKILL,
  VIDEO_BASE_SKILL,
} from "@/lib/module-chat-config";
import {
  PPT_SKILL_CATALOG,
  WRITING_BASE_SKILL,
  type ModuleId,
} from "@/lib/module-registry";

const openWorkspaceAction: ModuleAction = {
  id: "open_workspace",
  label: "打开工作区",
  kind: "open",
  requiresArtifact: true,
};

export const MODULE_ADAPTERS = {
  chat: {
    version: 1,
    id: "chat",
    label: "对话",
    description: "研究、分析、整理和跨模块分发的通用入口。",
    lifecycle: {
      stages: ["intake", "generation", "revision", "done"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: null,
      availableSkills: ["skill-qa-fast", "skill-qa-deep"],
      allowSkillPicker: false,
    },
    requirements: {
      partKinds: [],
      summaryPartKinds: ["summary", "research_map"],
      requiresConfirmation: false,
    },
    artifacts: {
      primaryTypes: ["md", "pdf", "csv", "xlsx", "json", "html"],
      previewTypes: ["md", "html", "pdf", "image"],
      generatedFormatTypes: ["md", "pdf", "csv", "xlsx", "json"],
      intermediateTypes: ["json"],
    },
    workbench: {
      enabled: false,
      type: "chat",
      preferredLayout: "chat-first",
    },
    actions: {
      primary: [openWorkspaceAction],
      continue: [
        {
          id: "continue_research",
          label: "继续研究",
          kind: "continue",
        },
        {
          id: "turn_into_artifact",
          label: "转为文档 / PPT",
          kind: "custom",
        },
      ],
      generate: [],
    },
    acceptance: {
      smoke: ["能完成普通问答", "能完成深度研究", "能把结果写入工作区"],
      failureStates: ["生成失败", "附件上传失败", "工作区写入失败"],
    },
  },
  writing: {
    version: 1,
    id: "writing",
    label: "文档",
    description: "从需求、大纲到本地交付文档的写作生产链路。",
    lifecycle: {
      stages: ["intake", "planning", "generation", "preview", "revision", "delivery"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: WRITING_BASE_SKILL,
      availableSkills: [
        "skill-writing-general",
        "skill-writing-official-doc",
        "skill-writing-meeting-minutes",
      ],
      allowSkillPicker: true,
    },
    requirements: {
      partKinds: ["writing_requirements"],
      summaryPartKinds: ["writing_requirement_summary"],
      outlinePartKinds: ["writing_outline"],
      requiresConfirmation: true,
    },
    artifacts: {
      primaryTypes: ["md", "docx"],
      previewTypes: ["md", "docx", "pdf"],
      generatedFormatTypes: ["docx", "pdf", "md"],
      intermediateTypes: ["json"],
    },
    workbench: {
      enabled: true,
      type: "document",
      preferredLayout: "split",
    },
    actions: {
      primary: [
        {
          id: "open_document_preview",
          label: "打开文档预览",
          kind: "preview",
          requiresArtifact: true,
        },
        {
          id: "generate_docx",
          label: "生成 DOCX",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
      continue: [
        {
          id: "revise_outline",
          label: "调整大纲",
          kind: "revise",
        },
        {
          id: "rewrite_section",
          label: "重写段落",
          kind: "revise",
        },
        {
          id: "change_tone",
          label: "调整语气",
          kind: "revise",
        },
      ],
      generate: [
        {
          id: "generate_docx",
          label: "生成 DOCX",
          kind: "generate_format",
          requiresArtifact: true,
        },
        {
          id: "generate_pdf",
          label: "生成 PDF",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
    },
    acceptance: {
      smoke: ["能确认写作需求", "能生成大纲", "能生成正文", "能生成 DOCX"],
      failureStates: ["生成失败", "DOCX 生成失败", "本地打开失败"],
    },
  },
  ppt: {
    version: 1,
    id: "ppt",
    label: "PPT",
    description: "从主题、文档或研究结论生成可预览、可本地交付的演示材料。",
    lifecycle: {
      stages: ["intake", "planning", "generation", "preview", "revision", "delivery"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: PPT_DEFAULT_SKILL,
      availableSkills: PPT_SKILL_CATALOG.map((entry) => entry.skill),
      allowSkillPicker: true,
    },
    requirements: {
      partKinds: ["ppt_requirements"],
      summaryPartKinds: ["ppt_requirement_summary"],
      outlinePartKinds: ["ppt_outline"],
      requiresConfirmation: true,
    },
    artifacts: {
      primaryTypes: ["pptx", "html"],
      previewTypes: ["html", "pptx", "pdf"],
      generatedFormatTypes: ["pptx", "pdf"],
      intermediateTypes: ["md", "json"],
    },
    workbench: {
      enabled: true,
      type: "ppt",
      preferredLayout: "split",
    },
    actions: {
      primary: [
        {
          id: "open_deck_preview",
          label: "打开预览",
          kind: "preview",
          requiresArtifact: true,
        },
        {
          id: "generate_pptx",
          label: "生成 PPTX",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
      continue: [
        {
          id: "revise_outline",
          label: "调整页纲",
          kind: "revise",
        },
        {
          id: "change_theme",
          label: "更换风格",
          kind: "revise",
        },
        {
          id: "add_slide",
          label: "增加一页",
          kind: "revise",
        },
      ],
      generate: [
        {
          id: "generate_pptx",
          label: "生成 PPTX",
          kind: "generate_format",
          requiresArtifact: true,
        },
        {
          id: "generate_pdf",
          label: "生成 PDF",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
    },
    acceptance: {
      smoke: ["能确认 PPT 需求", "能生成页纲", "能生成 HTML 预览", "能生成 PPTX"],
      failureStates: ["生成失败", "预览失败", "PPTX 生成失败", "本地打开失败"],
    },
  },
  "3d": {
    version: 1,
    id: "3d",
    label: "3D",
    description: "参数化工业结构生成、预览和多格式本地派生。",
    lifecycle: {
      stages: ["intake", "planning", "generation", "preview", "revision", "delivery"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: INDUSTRIAL_DRAWING_BASE_SKILL,
      allowSkillPicker: false,
    },
    requirements: {
      partKinds: ["3d_requirements"],
      summaryPartKinds: ["3d_requirement_summary"],
      outlinePartKinds: ["3d_outline"],
      requiresConfirmation: true,
    },
    artifacts: {
      primaryTypes: ["scad", "stl"],
      previewTypes: ["stl", "svg", "scad"],
      generatedFormatTypes: ["stl", "dxf", "svg", "pdf"],
      intermediateTypes: ["json", "off"],
    },
    workbench: {
      enabled: true,
      type: "industrial_drawing",
      preferredLayout: "workbench-first",
    },
    actions: {
      primary: [
        {
          id: "open_model_preview",
          label: "打开模型预览",
          kind: "preview",
          requiresArtifact: true,
        },
        {
          id: "generate_stl",
          label: "生成 STL",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
      continue: [
        {
          id: "edit_parameters",
          label: "调整参数",
          kind: "revise",
        },
        {
          id: "generate_variant",
          label: "生成变体",
          kind: "regenerate",
        },
      ],
      generate: [
        {
          id: "generate_stl",
          label: "生成 STL",
          kind: "generate_format",
          requiresArtifact: true,
        },
        {
          id: "generate_dxf",
          label: "生成 DXF",
          kind: "generate_format",
          requiresArtifact: true,
        },
        {
          id: "generate_svg",
          label: "生成 SVG",
          kind: "generate_format",
          requiresArtifact: true,
        },
        {
          id: "generate_pdf",
          label: "生成 PDF",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
    },
    acceptance: {
      smoke: ["能确认 3D 需求", "能生成 SCAD", "能预览模型", "能生成 STL/DXF/SVG"],
      failureStates: ["生成失败", "预览失败", "参数保存失败", "格式生成失败"],
    },
  },
  video: {
    version: 1,
    id: "video",
    label: "视频",
    description: "从 brief 到脚本、分镜、网页演示预览和录制入口的视频项目链路。",
    lifecycle: {
      stages: ["intake", "planning", "generation", "preview", "revision", "delivery"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: VIDEO_BASE_SKILL,
      allowSkillPicker: false,
    },
    requirements: {
      partKinds: ["video_requirements"],
      summaryPartKinds: ["video_requirement_summary"],
      outlinePartKinds: ["video_outline"],
      requiresConfirmation: true,
    },
    artifacts: {
      primaryTypes: ["html", "directory"],
      previewTypes: ["html", "video", "directory"],
      generatedFormatTypes: [],
      intermediateTypes: ["md", "json"],
    },
    workbench: {
      enabled: true,
      type: "video",
      preferredLayout: "split",
    },
    actions: {
      primary: [
        {
          id: "open_video_preview",
          label: "打开预览",
          kind: "preview",
          requiresArtifact: true,
        },
        {
          id: "open_recording_mode",
          label: "进入录制",
          kind: "preview",
          requiresArtifact: true,
        },
      ],
      continue: [
        {
          id: "revise_script",
          label: "修改脚本",
          kind: "revise",
        },
        {
          id: "revise_scenes",
          label: "调整分镜",
          kind: "revise",
        },
      ],
      generate: [
        {
          id: "generate_video",
          label: "生成视频文件",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
    },
    acceptance: {
      smoke: ["能确认视频需求", "能生成脚本", "能生成分镜", "能打开网页预览"],
      failureStates: ["生成失败", "预览服务失败", "录制入口失败", "视频文件生成失败"],
    },
  },
  simulation: {
    version: 1,
    id: "simulation",
    label: "推演",
    description: "围绕复杂问题建立世界模型、变量关系和推演路径。",
    lifecycle: {
      stages: ["intake", "planning", "generation", "preview", "revision", "delivery"],
      defaultStage: "intake",
    },
    skills: {
      defaultSkill: SIMULATION_BASE_SKILL,
      supportSkills: [SIMULATION_WORLD_MODEL_SKILL],
      allowSkillPicker: false,
    },
    requirements: {
      partKinds: ["simulation_requirements"],
      summaryPartKinds: [
        "simulation_requirement_summary",
        "simulation_scenario",
        "simulation_summary",
      ],
      outlinePartKinds: [],
      requiresConfirmation: true,
    },
    artifacts: {
      primaryTypes: ["json", "md"],
      previewTypes: ["json", "html"],
      generatedFormatTypes: ["md", "pdf", "json"],
      intermediateTypes: ["json"],
    },
    workbench: {
      enabled: true,
      type: "simulation",
      preferredLayout: "workbench-first",
    },
    actions: {
      primary: [
        {
          id: "open_simulation_canvas",
          label: "打开推演画布",
          kind: "preview",
        },
      ],
      continue: [
        {
          id: "continue_round",
          label: "继续推演",
          kind: "continue",
        },
        {
          id: "adjust_variables",
          label: "调整变量",
          kind: "revise",
        },
      ],
      generate: [
        {
          id: "generate_report",
          label: "生成报告文件",
          kind: "generate_format",
          requiresArtifact: true,
        },
      ],
    },
    acceptance: {
      smoke: ["能确认推演问题", "能生成世界模型", "能展示画布", "能继续推演"],
      failureStates: ["生成失败", "画布加载失败", "快照失败", "报告生成失败"],
    },
  },
} as const satisfies Record<ModuleId, ModuleAdapter>;

export type RegisteredModuleAdapter = (typeof MODULE_ADAPTERS)[ModuleId];
export type ModuleActionGroup = keyof RegisteredModuleAdapter["actions"];

export function getModuleAdapter(moduleId: ModuleId): RegisteredModuleAdapter {
  return MODULE_ADAPTERS[moduleId];
}

export function getModuleAdapterActions(
  moduleId: ModuleId,
  group: ModuleActionGroup,
): readonly ModuleAction[] {
  return MODULE_ADAPTERS[moduleId].actions[group];
}

export function moduleSupportsWorkbench(moduleId: ModuleId): boolean {
  return MODULE_ADAPTERS[moduleId].workbench.enabled;
}

export function getModulePrimaryArtifactTypes(moduleId: ModuleId): readonly string[] {
  return MODULE_ADAPTERS[moduleId].artifacts.primaryTypes;
}

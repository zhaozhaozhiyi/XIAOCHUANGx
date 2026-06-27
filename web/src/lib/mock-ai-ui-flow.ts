import type {
  ChatPart,
  IndustrialDrawingOutlineData,
  OutlinePart,
  PptOutlineSlide,
  RequirementSummaryPart,
  RequirementsPart,
  StructuredQuestion,
  VideoOutlineData,
  WritingOutlineSection,
} from "@/lib/chat-parts";
import { newPartId } from "@/lib/chat-parts-utils";

export const MOCK_AI_UI_CONTINUE_PREFIX =
  "我补充的信息如下，请继续完成刚才的任务：";

type SupportedModuleId = "writing" | "ppt" | "video";
type MockModuleId = SupportedModuleId | "3d";

export type MockAiUiFlow = {
  parts: ChatPart[];
  deliverables?: ChatPart;
  finalText?: string;
  stopAfterParts?: boolean;
};

function normalizeAnswerBlock(text: string): string {
  return text
    .replace(MOCK_AI_UI_CONTINUE_PREFIX, "")
    .trim();
}

function answerBlockToMarkdown(text: string): string {
  const lines = normalizeAnswerBlock(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "- 暂未补充具体信息";
  return lines.map((line) => `- ${line}`).join("\n");
}

function titleFromUserText(text: string, fallback: string): string {
  const cleaned = normalizeAnswerBlock(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned;
}

function writingQuestions(): StructuredQuestion[] {
  return [
    {
      id: "goal",
      label: "这次写作你希望我优先完成什么？",
      type: "single_select",
      required: true,
      options: [
        { label: "直接写成完整初稿", description: "适合已经明确主题和结构" },
        { label: "先给详细大纲", description: "先对齐结构，再继续展开正文" },
        { label: "先输出摘要要点", description: "先快速确认核心观点和方向" },
      ],
    },
    {
      id: "audience",
      label: "这篇内容主要给谁看？",
      type: "single_select",
      required: true,
      options: [
        { label: "领导/管理层", description: "更重结论、风险和建议" },
        { label: "客户/外部读者", description: "更重表达清晰和专业可信" },
        { label: "内部同事", description: "更重结构、细节和可执行性" },
      ],
    },
    {
      id: "style",
      label: "希望整体文风更接近哪种感觉？",
      type: "multi_select",
      options: [
        { label: "正式", description: "适合报告、公文、对外材料" },
        { label: "简洁", description: "少铺垫，信息密度更高" },
        { label: "分析型", description: "更强调判断、依据和推演" },
        { label: "可直接汇报", description: "更适合拿去口头汇报或汇总" },
      ],
    },
    {
      id: "length",
      label: "篇幅预期",
      type: "text",
      placeholder: "例如：800 字、1500 字、3 页以内",
    },
    {
      id: "must_include",
      label: "必须覆盖的内容或资料有哪些？",
      type: "textarea",
      required: true,
      placeholder: "例如：要写到库存、价格走势、结论建议；要引用某份资料或口径",
    },
  ];
}

function pptQuestions(): StructuredQuestion[] {
  return [
    {
      id: "scenario",
      label: "这份 PPT 主要用于什么场景？",
      type: "single_select",
      required: true,
      options: [
        { label: "领导汇报", description: "更强调结论、结构和决策信息" },
        { label: "客户沟通/路演", description: "更强调说服力和表达完整度" },
        { label: "内部分享", description: "更强调知识传达和逻辑清晰" },
      ],
    },
    {
      id: "audience",
      label: "观众更接近哪类人群？",
      type: "single_select",
      required: true,
      options: [
        { label: "高层/决策者", description: "减少细枝末节，突出关键判断" },
        { label: "业务团队", description: "保留过程、拆解和行动建议" },
        { label: "外部客户/合作方", description: "更注重专业度和表达节奏" },
      ],
    },
    {
      id: "style",
      label: "你偏好的呈现风格",
      type: "multi_select",
      options: [
        { label: "专业稳重", description: "适合正式汇报" },
        { label: "数据驱动", description: "更多图表、指标和对比" },
        { label: "叙事说服", description: "更强调故事线和逻辑推进" },
        { label: "简洁极简", description: "信息收敛，视觉负担更轻" },
      ],
    },
    {
      id: "page_count",
      label: "预计页数",
      type: "text",
      required: true,
      placeholder: "例如：8 页、10-12 页、15 页以内",
    },
    {
      id: "must_include",
      label: "必须出现的章节、数据或结论",
      type: "textarea",
      required: true,
      placeholder: "例如：市场背景、核心观点、数据页、行动建议、结尾总结",
    },
  ];
}

function industrialDrawingQuestions(): StructuredQuestion[] {
  return [
    {
      id: "part_type",
      label: "要生成哪类工业结构？",
      type: "single_select",
      required: true,
      options: [
        { label: "安装支架", description: "带孔位、筋板和装配面" },
        { label: "设备外壳", description: "箱体、面板、开孔或折边结构" },
        { label: "管路/容器", description: "管段、法兰、筒体或连接件" },
      ],
    },
    {
      id: "dimensions",
      label: "关键尺寸和单位",
      type: "textarea",
      required: true,
      placeholder: "例如：底板 120x80x8 mm，立板高 90 mm，孔径 8 mm，孔距 90 mm",
    },
    {
      id: "features",
      label: "需要包含哪些结构特征？",
      type: "multi_select",
      options: [
        { label: "安装孔", description: "圆孔、沉孔或长圆孔" },
        { label: "加强筋", description: "肋板、三角筋或折边" },
        { label: "倒角/圆角", description: "预留加工和安全边界" },
        { label: "装配基准", description: "基准面、中心线或定位孔" },
      ],
    },
    {
      id: "output",
      label: "优先交付格式",
      type: "multi_select",
      required: true,
      options: [
        { label: "OpenSCAD 参数化源文件", description: "后续可编辑尺寸变量" },
        { label: "STL 预览文件", description: "工作区可直接 3D 预览" },
        { label: "DXF 展开/轮廓", description: "用于后续二维加工或校核" },
      ],
    },
    {
      id: "notes",
      label: "装配、加工或材料约束",
      type: "textarea",
      placeholder: "例如：Q235 钢板、激光切割、焊接筋板、孔位需避让 M8 螺栓头",
    },
  ];
}

function videoQuestions(): StructuredQuestion[] {
  return [
    {
      id: "scenario",
      label: "这个视频主要用于什么场景？",
      type: "single_select",
      required: true,
      options: [
        { label: "产品介绍", description: "强调价值、场景和转化" },
        { label: "研究解读", description: "强调观点、证据和节奏" },
        { label: "内部汇报", description: "强调结构、结论和可复述性" },
      ],
    },
    {
      id: "audience",
      label: "目标观众是谁？",
      type: "single_select",
      required: true,
      options: [
        { label: "客户高层", description: "减少细节，突出价值和可信度" },
        { label: "业务团队", description: "保留过程、案例和行动信息" },
        { label: "投资人/研究用户", description: "强调判断、数据和风险边界" },
      ],
    },
    {
      id: "duration",
      label: "预计时长",
      type: "text",
      required: true,
      placeholder: "例如：60s、90s、3 分钟以内",
    },
    {
      id: "aspect_ratio",
      label: "画幅",
      type: "single_select",
      required: true,
      options: [
        { label: "16:9 横屏", description: "适合 B 站、YouTube、会议播放" },
        { label: "9:16 竖屏", description: "适合短视频平台" },
        { label: "1:1 方屏", description: "适合社媒信息流" },
      ],
    },
    {
      id: "must_include",
      label: "必须出现的内容、素材或结论",
      type: "textarea",
      placeholder: "例如：小窗能力、研究交付、数据图、品牌口径、Logo 路径",
    },
  ];
}

function requirementsPart(
  moduleId: MockModuleId,
  templateId: string | undefined,
): RequirementsPart {
  const isWriting = moduleId === "writing";
  const isPpt = moduleId === "ppt";
  const isVideo = moduleId === "video";
  return {
    id: newPartId(
      isWriting
        ? "writing_requirements"
        : isPpt
          ? "ppt_requirements"
          : isVideo
            ? "video_requirements"
            : "3d_requirements",
    ),
    zone: "summary",
    kind: isWriting
      ? "writing_requirements"
      : isPpt
        ? "ppt_requirements"
        : isVideo
          ? "video_requirements"
          : "3d_requirements",
    title: isWriting
      ? "先补充一下这次写作任务的关键信息"
      : isPpt
        ? "先补充一下这份 PPT 的关键要求"
        : isVideo
          ? "先补充一下这个视频的关键要求"
          : "先补充一下这次 3D 制图的关键参数",
    description: isWriting
      ? `我会先根据你的目标、读者和必须覆盖内容生成方案，再继续进入${templateId ? `「${templateId}」` : "写作"}输出。`
      : isPpt
        ? `我会先根据场景、受众和页数要求生成页纲，再继续进入${templateId ? `「${templateId}」` : "PPT"}输出。`
        : isVideo
          ? "我会先确认场景、受众、时长和画幅，再生成口播稿、outline 和可预览的网页视频项目。"
          : "我会先确认结构、尺寸、特征和输出格式，再生成参数化 CAD 文件和可预览模型。",
    questions: isWriting
      ? writingQuestions()
      : isPpt
        ? pptQuestions()
        : isVideo
          ? videoQuestions()
          : industrialDrawingQuestions(),
    completedAt: Date.now(),
  };
}

function requirementSummaryPart(
  moduleId: MockModuleId,
  sourceText: string,
): RequirementSummaryPart {
  const isWriting = moduleId === "writing";
  const isPpt = moduleId === "ppt";
  const isVideo = moduleId === "video";
  return {
    id: newPartId(
      isWriting
        ? "writing_requirement_summary"
        : isPpt
          ? "ppt_requirement_summary"
          : isVideo
            ? "video_requirement_summary"
            : "3d_requirement_summary",
    ),
    zone: "summary",
    kind: isWriting
      ? "writing_requirement_summary"
      : isPpt
        ? "ppt_requirement_summary"
        : isVideo
          ? "video_requirement_summary"
          : "3d_requirement_summary",
    title: isWriting
      ? "写作需求摘要"
      : isPpt
        ? "PPT 需求摘要"
        : isVideo
          ? "视频需求摘要"
          : "3D 需求摘要",
    markdown: [
      "## 已确认需求",
      answerBlockToMarkdown(sourceText),
      "",
      isWriting
        ? "我将基于以上信息先组织结构，再继续输出文稿初稿。"
        : isPpt
          ? "我将基于以上信息先整理页纲，再继续推进页面内容方案。"
          : isVideo
            ? "我将基于以上信息先生成口播稿和网页视频 outline，再落盘 presentation 项目并给出 ?reel=1 预览入口。"
            : "我将基于以上信息先整理建模方案，再继续生成 SCAD 参数文件和 STL 预览。",
    ].join("\n"),
    completedAt: Date.now(),
  };
}

function outlinePart(
  moduleId: MockModuleId,
  sourceText: string,
): OutlinePart {
  const topic = titleFromUserText(
    sourceText,
    moduleId === "writing"
      ? "本次写作任务"
      : moduleId === "ppt"
        ? "本次 PPT 任务"
        : moduleId === "video"
          ? "本次视频任务"
          : "本次 3D 制图任务",
  );

  if (moduleId === "writing") {
    const sections: WritingOutlineSection[] = [
      {
        id: "mock-writing-section-1",
        title: "背景与写作目的",
        bullets: ["明确写作场景、读者对象和核心问题"],
      },
      {
        id: "mock-writing-section-2",
        title: "现状梳理与核心事实",
        bullets: ["整理关键数据、材料口径和已知结论"],
      },
      {
        id: "mock-writing-section-3",
        title: "关键判断与分析展开",
        bullets: ["围绕主要矛盾展开判断依据和影响推演"],
      },
      {
        id: "mock-writing-section-4",
        title: "建议方案 / 执行动作",
        bullets: ["沉淀可执行建议、优先级和后续动作"],
      },
      {
        id: "mock-writing-section-5",
        title: "风险提示与结论收束",
        bullets: ["补充风险边界，并用结论回扣主题"],
      },
    ];
    return {
      id: newPartId("writing_outline"),
      zone: "summary",
      kind: "writing_outline",
      title: "写作大纲",
      markdown: [
        `# ${topic}`,
        "",
        ...sections.flatMap((section, index) => [
          `${index + 1}. ${section.title}`,
          ...section.bullets.map((bullet) => `   - ${bullet}`),
        ]),
      ].join("\n"),
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        sections,
      },
      completedAt: Date.now(),
    };
  }

  if (moduleId === "3d") {
    const blocks: IndustrialDrawingOutlineData["blocks"] = [
      {
        id: "mock-3d-block-1",
        title: "结构目标",
        bullets: ["确认零件类型、用途、装配方向和主要受力边界"],
      },
      {
        id: "mock-3d-block-2",
        title: "参数体系",
        bullets: ["建立长宽高、板厚、孔径、孔距、筋板厚度等变量"],
      },
      {
        id: "mock-3d-block-3",
        title: "几何组成",
        bullets: ["生成基座、立板、安装孔、加强筋和必要倒角"],
      },
      {
        id: "mock-3d-block-4",
        title: "工作区产物",
        bullets: ["写入 drawing.scad、drawing.parameters.json、README.md 和 STL 预览"],
      },
    ];
    return {
      id: newPartId("3d_outline"),
      zone: "summary",
      kind: "3d_outline",
      title: "3D 建模方案",
      markdown: [
        `# ${topic}`,
        "",
        ...blocks.flatMap((block, index) => [
          `${index + 1}. ${block.title}`,
          ...block.bullets.map((bullet) => `   - ${bullet}`),
        ]),
      ].join("\n"),
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        title: topic,
        blocks,
      },
      completedAt: Date.now(),
    };
  }

  if (moduleId === "video") {
    const blocks: VideoOutlineData["blocks"] = [
      {
        id: "mock-video-chapter-1",
        title: "开场钩子",
        bullets: ["用一个明确痛点或价值承诺打开，形成第一屏视觉锚点"],
      },
      {
        id: "mock-video-chapter-2",
        title: "核心能力",
        bullets: ["拆成 2-3 个 step 展示研究、写作、PPT、3D 等连续工作能力"],
      },
      {
        id: "mock-video-chapter-3",
        title: "交付闭环",
        bullets: ["展示工作区文件、预览 URL 和录屏路径，强调可编辑可复用"],
      },
      {
        id: "mock-video-chapter-4",
        title: "结尾收束",
        bullets: ["用一句面向目标受众的结论收束，并给出下一步行动"],
      },
    ];
    return {
      id: newPartId("video_outline"),
      zone: "summary",
      kind: "video_outline",
      title: "视频网页 outline",
      markdown: [
        `# ${topic}`,
        "",
        ...blocks.flatMap((block, index) => [
          `${index + 1}. ${block.title}`,
          ...block.bullets.map((bullet) => `   - ${bullet}`),
        ]),
      ].join("\n"),
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        title: topic,
        blocks,
      },
      completedAt: Date.now(),
    };
  }

  const slides: PptOutlineSlide[] = [
    {
      id: "mock-ppt-slide-1",
      title: "封面",
      bullets: ["主题、场景、汇报对象"],
    },
    {
      id: "mock-ppt-slide-2",
      title: "背景页",
      bullets: ["问题背景 / 机会点"],
    },
    {
      id: "mock-ppt-slide-3",
      title: "核心判断",
      bullets: ["一句话结论与支撑逻辑"],
    },
    {
      id: "mock-ppt-slide-4",
      title: "证据页",
      bullets: ["关键数据、案例或对比"],
    },
    {
      id: "mock-ppt-slide-5",
      title: "方案页",
      bullets: ["建议动作 / 推进路径"],
    },
    {
      id: "mock-ppt-slide-6",
      title: "结尾页",
      bullets: ["总结与下一步"],
    },
  ];
  return {
    id: newPartId("ppt_outline"),
    zone: "summary",
    kind: "ppt_outline",
    title: "PPT 页纲",
    coverTitle: topic,
    markdown: [
      `# ${topic}`,
      "",
      ...slides.flatMap((slide, index) => [
        `${index + 1}. ${slide.title}`,
        ...slide.bullets.map((bullet) => `   - ${bullet}`),
      ]),
    ].join("\n"),
    outline: {
      version: 1,
      source: "ai",
      committed: false,
      slides,
    },
    completedAt: Date.now(),
  };
}

function finalText(moduleId: SupportedModuleId): string {
  if (moduleId === "video") {
    return [
      "已完成视频需求收敛和网页视频 outline。",
      "",
      "下一步会生成 script.md、outline.md 和 presentation/，并给出 ?reel=1 预览与 ?auto=1 录屏路径。",
    ].join("\n");
  }
  if (moduleId === "writing") {
    return [
      "已完成需求收敛和结构设计。",
      "",
      "下一步可以直接继续生成完整初稿，也可以先逐段展开正文内容并落到工作区文件中。",
    ].join("\n");
  }
  return [
    "已完成需求收敛和页纲设计。",
    "",
    "下一步可以继续生成逐页内容、演讲备注，以及工作区中的 HTML / PPTX 产物。",
  ].join("\n");
}

function final3dText(): string {
  return [
    "已完成 3D 制图需求收敛和建模方案设计。",
    "",
    "下一步会继续生成参数化 OpenSCAD 文件、参数表和工作区可预览的 STL 草模。",
  ].join("\n");
}

function videoDeliverablesPart(): ChatPart {
  return {
    id: newPartId("deliverables"),
    zone: "summary",
    kind: "deliverables",
    headline: "本轮交付文件如下：",
    primaryPath: "presentation",
    items: [
      {
        path: "presentation",
        label: "presentation/ 网页视频项目",
        mime: "inode/directory",
        kind: "directory",
        previewUrl: "http://localhost:5173/?reel=1",
        recordingUrl: "http://localhost:5173/?auto=1",
        devCommand: "cd presentation && npm run dev",
      },
      {
        path: "script.md",
        label: "script.md 口播稿",
        mime: "text/markdown",
        kind: "attachment",
      },
      {
        path: "outline.md",
        label: "outline.md 章节计划",
        mime: "text/markdown",
        kind: "attachment",
      },
    ],
    completedAt: Date.now(),
  };
}

export function buildMockAiUiFlow(input: {
  moduleId: string;
  templateId?: string;
  lastUserText: string;
}): MockAiUiFlow | null {
  if (
    input.moduleId !== "writing" &&
    input.moduleId !== "ppt" &&
    input.moduleId !== "3d" &&
    input.moduleId !== "video"
  ) {
    return null;
  }

  if (!input.lastUserText.trim()) {
    return null;
  }

  const moduleId = input.moduleId as MockModuleId;
  const isContinuation = input.lastUserText
    .trim()
    .startsWith(MOCK_AI_UI_CONTINUE_PREFIX);

  if (!isContinuation) {
    return {
      parts: [requirementsPart(moduleId, input.templateId)],
      stopAfterParts: true,
    };
  }

  return {
    parts: [
      requirementSummaryPart(moduleId, input.lastUserText),
      outlinePart(moduleId, input.lastUserText),
    ],
    deliverables: moduleId === "video" ? videoDeliverablesPart() : undefined,
    finalText: moduleId === "3d" ? final3dText() : finalText(moduleId),
  };
}

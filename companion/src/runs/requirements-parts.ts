import type { ChatPart } from "@jlc/contracts";

type StructuredQuestion = {
  id: string;
  question: string;
  header?: string;
  label?: string;
  type?:
    | "text"
    | "textarea"
    | "single_select"
    | "multi_select"
    | "date"
    | "time"
    | "datetime"
    | "number"
    | "file_pick"
    | "file_upload";
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
};

type RequirementsKind =
  | "writing_requirements"
  | "ppt_requirements"
  | "3d_requirements"
  | "video_requirements";
type OutlineKind =
  | "writing_outline"
  | "ppt_outline"
  | "3d_outline"
  | "video_outline";

function newPartId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeRequirementsKind(input: {
  moduleId: string;
  processSkill?: string | null;
  rawInput: unknown;
}): RequirementsKind | null {
  if (isRecord(input.rawInput)) {
    if (input.rawInput.kind === "writing_requirements") {
      return "writing_requirements";
    }
    if (input.rawInput.kind === "ppt_requirements") {
      return "ppt_requirements";
    }
    if (input.rawInput.kind === "3d_requirements") {
      return "3d_requirements";
    }
    if (input.rawInput.kind === "video_requirements") {
      return "video_requirements";
    }
  }

  if (
    input.moduleId === "writing" &&
    input.processSkill === "skill-writing-base"
  ) {
    return "writing_requirements";
  }
  if (input.moduleId === "ppt" && input.processSkill === "skill-ppt-base") {
    return "ppt_requirements";
  }
  if (
    input.moduleId === "3d" &&
    input.processSkill === "skill-industrial-drawing-base"
  ) {
    return "3d_requirements";
  }
  if (input.moduleId === "video" && input.processSkill === "skill-vp-base") {
    return "video_requirements";
  }
  return null;
}

const structuredQuestionTypes = new Set<NonNullable<StructuredQuestion["type"]>>([
  "text",
  "textarea",
  "single_select",
  "multi_select",
  "date",
  "time",
  "datetime",
  "number",
  "file_pick",
  "file_upload",
]);

function normalizeStructuredQuestionType(
  rawType: unknown,
  input: {
    options?: StructuredQuestion["options"];
    multiSelect?: boolean;
  },
): StructuredQuestion["type"] {
  if (typeof rawType === "string") {
    const type = rawType.trim();
    if (structuredQuestionTypes.has(type as NonNullable<StructuredQuestion["type"]>)) {
      return type as StructuredQuestion["type"];
    }
  }
  if (input.options?.length) {
    return input.multiSelect ? "multi_select" : "single_select";
  }
  return undefined;
}

function normalizeStructuredQuestionOptions(
  rawOptions: unknown,
): StructuredQuestion["options"] {
  if (!Array.isArray(rawOptions)) return undefined;
  const options = rawOptions
    .map((option) => {
      if (typeof option === "string") {
        const label = option.trim();
        return label ? { label } : null;
      }
      if (!isRecord(option)) return null;
      const label =
        typeof option.label === "string"
          ? option.label.trim()
          : typeof option.value === "string"
            ? option.value.trim()
            : "";
      if (!label) return null;
      const description =
        typeof option.description === "string" && option.description.trim()
          ? option.description.trim()
          : undefined;
      return { label, description };
    })
    .filter((option): option is { label: string; description?: string } =>
      Boolean(option),
    );
  return options.length > 0 ? options : undefined;
}

function normalizeStructuredQuestions(rawQuestions: unknown): StructuredQuestion[] {
  if (!Array.isArray(rawQuestions)) return [];
  const questions: StructuredQuestion[] = [];
  rawQuestions.forEach((rawQuestion, index) => {
    if (!isRecord(rawQuestion)) return;
    const label =
      typeof rawQuestion.label === "string" && rawQuestion.label.trim()
        ? rawQuestion.label.trim()
        : typeof rawQuestion.question === "string" && rawQuestion.question.trim()
          ? rawQuestion.question.trim()
          : typeof rawQuestion.header === "string" && rawQuestion.header.trim()
            ? rawQuestion.header.trim()
            : "";
    if (!label) return;

    const id =
      typeof rawQuestion.id === "string" && rawQuestion.id.trim()
        ? rawQuestion.id.trim()
        : `q${index + 1}`;
    const options = normalizeStructuredQuestionOptions(rawQuestion.options);
    const multiSelect =
      rawQuestion.multiSelect === true || rawQuestion.type === "multi_select";
    questions.push({
      id,
      question: label,
      header:
        typeof rawQuestion.header === "string" && rawQuestion.header.trim()
          ? rawQuestion.header.trim()
          : undefined,
      label,
      type: normalizeStructuredQuestionType(rawQuestion.type, {
        options,
        multiSelect,
      }),
      required:
        typeof rawQuestion.required === "boolean"
          ? rawQuestion.required
          : undefined,
      description:
        typeof rawQuestion.description === "string" &&
        rawQuestion.description.trim()
          ? rawQuestion.description.trim()
          : undefined,
      placeholder:
        typeof rawQuestion.placeholder === "string" &&
        rawQuestion.placeholder.trim()
          ? rawQuestion.placeholder.trim()
          : undefined,
      options,
      multiSelect,
    });
  });
  return questions;
}

function extractJsonCodeBlocks(markdown: string): unknown[] {
  const blocks: unknown[] = [];
  const codeFence = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of markdown.matchAll(codeFence)) {
    const raw = (match[1] ?? "").trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Non-JSON fences are common in assistant prose; ignore them.
    }
  }
  return blocks;
}

function findRequirementsJsonPayload(
  markdown: string,
  expectedKind: RequirementsKind,
): Record<string, unknown> | null {
  for (const block of extractJsonCodeBlocks(markdown)) {
    if (isRecord(block) && block.kind === expectedKind) {
      return block;
    }
    if (Array.isArray(block)) {
      const match = block.find(
        (item) => isRecord(item) && item.kind === expectedKind,
      );
      if (isRecord(match)) return match;
    }
  }
  return null;
}

function defaultTitle(kind: RequirementsKind): string {
  if (kind === "writing_requirements") {
    return "请先补充这次写作任务的关键信息";
  }
  if (kind === "ppt_requirements") {
    return "请先补充这次 PPT 任务的关键信息";
  }
  if (kind === "video_requirements") {
    return "请先补充这个视频的关键信息";
  }
  return "请先补充这次 3D 制图任务的关键信息";
}

function defaultDescription(kind: RequirementsKind): string {
  if (kind === "writing_requirements") {
    return "我会先确认写作 brief，再进入大纲与正文。";
  }
  if (kind === "ppt_requirements") {
    return "我会先确认演示 brief，再进入页纲与内容生成。";
  }
  if (kind === "video_requirements") {
    return "我会先确认视频 brief，再进入口播稿、outline 与网页视频项目生成。";
  }
  return "我会先确认零件 / 结构 brief，再进入建模方案与文件生成。";
}

export function buildRequirementsPart(input: {
  runId: string;
  toolUseId: string;
  moduleId: string;
  processSkill?: string | null;
  rawInput: unknown;
  questions: StructuredQuestion[];
}): Extract<ChatPart, { kind: RequirementsKind }> | null {
  const kind = normalizeRequirementsKind(input);
  if (!kind || input.questions.length === 0) return null;

  const raw = isRecord(input.rawInput) ? input.rawInput : {};
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim()
      : defaultTitle(kind);
  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : undefined;

  return {
    id: newPartId(kind),
    zone: "summary",
    kind,
    runId: input.runId,
    toolUseId: input.toolUseId,
    title,
    description,
    questions: input.questions.map((question) => ({
      id: question.id,
      label: question.label ?? question.question,
      type:
        question.type ??
        (question.options?.length
          ? question.multiSelect
            ? "multi_select"
            : "single_select"
          : "text"),
      required: question.required,
      description: question.description,
      placeholder: question.placeholder,
      options: question.options,
    })),
    streaming: false,
    completedAt: Date.now(),
  };
}

function summaryKindFromRequirementsKind(
  kind: RequirementsKind,
):
  | "writing_requirement_summary"
  | "ppt_requirement_summary"
  | "3d_requirement_summary"
  | "video_requirement_summary" {
  if (kind === "writing_requirements") {
    return "writing_requirement_summary";
  }
  if (kind === "ppt_requirements") {
    return "ppt_requirement_summary";
  }
  if (kind === "video_requirements") {
    return "video_requirement_summary";
  }
  return "3d_requirement_summary";
}

function summaryTitleFromRequirementsKind(
  kind: RequirementsKind,
): string {
  if (kind === "writing_requirements") return "写作需求摘要";
  if (kind === "ppt_requirements") return "PPT 需求摘要";
  if (kind === "video_requirements") return "视频需求摘要";
  return "3D 需求摘要";
}

function outlineTitleFromKind(
  kind: OutlineKind,
): string {
  if (kind === "writing_outline") return "写作大纲";
  if (kind === "ppt_outline") return "PPT 页纲";
  if (kind === "video_outline") return "视频 outline";
  return "3D 建模方案";
}

function summaryTitleFromKind(
  kind:
    | "writing_requirement_summary"
    | "ppt_requirement_summary"
    | "3d_requirement_summary"
    | "video_requirement_summary",
): string {
  if (kind === "writing_requirement_summary") return "写作需求摘要";
  if (kind === "ppt_requirement_summary") return "PPT 需求摘要";
  if (kind === "video_requirement_summary") return "视频需求摘要";
  return "3D 需求摘要";
}

function stripMarkdownDecoration(value: string): string {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function stableOutlineId(prefix: string, index: number): string {
  return `${prefix}-${index + 1}`;
}

function markdownTitle(markdown: string, fallback: string): string {
  const heading = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => stripMarkdownDecoration(line))
    .find((line) => line.length > 0);
  return heading || fallback;
}

function normalizeOutlineItemTitle(raw: string): string {
  return stripMarkdownDecoration(raw)
    .replace(/^第\s*\d+\s*[页章节]?[：:、.\s-]*/, "")
    .replace(/^(封面|背景页|结论页|目录页|结束页)[：:、.\s-]*/, "$1：")
    .trim();
}

function parseNumberedOutline(markdown: string): Array<{
  title: string;
  bullets: string[];
}> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const items: Array<{ title: string; bullets: string[] }> = [];
  let current: { title: string; bullets: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const numbered = trimmed.match(/^(?:\d+|[一二三四五六七八九十]+)[\.、)]\s*(.+)$/);
    if (numbered) {
      current = {
        title: normalizeOutlineItemTitle(numbered[1] ?? ""),
        bullets: [],
      };
      if (current.title) items.push(current);
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet && current) {
      const value = stripMarkdownDecoration(bullet[1] ?? "");
      if (value) current.bullets.push(value);
    }
  }

  return items;
}

function buildStructuredOutline(input: {
  kind: OutlineKind;
  markdown: string;
}): Extract<ChatPart, { kind: OutlineKind }>["outline"] {
  const items = parseNumberedOutline(input.markdown);
  if (input.kind === "writing_outline") {
    return {
      version: 1,
      source: "ai",
      committed: false,
      sections: items.map((item, index) => ({
        id: stableOutlineId("writing-section", index),
        title: item.title,
        bullets: item.bullets,
      })),
    };
  }

  if (input.kind === "ppt_outline") {
    return {
      version: 1,
      source: "ai",
      committed: false,
      slides: items.map((item, index) => ({
        id: stableOutlineId("ppt-slide", index),
        title: item.title,
        bullets: item.bullets,
      })),
    };
  }

  return {
    version: 1,
    source: "ai",
    committed: false,
    title: markdownTitle(
      input.markdown,
      input.kind === "video_outline" ? "视频 outline" : "3D 建模方案",
    ),
    blocks: items.map((item, index) => ({
      id: stableOutlineId(
        input.kind === "video_outline" ? "video-chapter" : "3d-block",
        index,
      ),
      title: item.title,
      bullets: item.bullets,
    })),
  };
}

function buildFallbackOutlineItems(input: {
  kind: OutlineKind;
  briefText: string;
}): Array<{ title: string; bullets: string[] }> {
  const brief = input.briefText.replace(/\r\n/g, "\n");
  if (input.kind === "writing_outline") {
    if (/研究报告|年度|深度报告|专题|分析/.test(brief)) {
      return [
        { title: "执行摘要", bullets: ["核心判断", "结论先行"] },
        { title: "数据与边界", bullets: ["研究口径", "数据来源"] },
        { title: "市场复盘", bullets: ["需求变化", "供给变化"] },
        { title: "分品种分析", bullets: ["汽油", "柴油", "航煤"] },
        { title: "风险与展望", bullets: ["成本波动", "需求节奏"] },
        { title: "经营建议", bullets: ["采购", "库存", "销售", "信用"] },
      ];
    }
    return [];
  }

  if (input.kind === "3d_outline") {
    return [
      { title: "建模目标", bullets: ["零件用途", "安装场景", "受力或装配边界"] },
      { title: "关键参数", bullets: ["外形尺寸", "板厚/壁厚", "孔位/开槽", "公差假设"] },
      { title: "主体结构", bullets: ["基座", "立板/侧壁", "加强筋/倒角"] },
      { title: "参数化策略", bullets: ["尺寸变量", "可复用参数表", "命名约定"] },
      { title: "导出计划", bullets: ["SCAD 源文件", "STL 预览", "可选 DXF"] },
    ];
  }

  if (input.kind === "video_outline") {
    return [
      { title: "开场钩子", bullets: ["核心痛点", "一句话价值承诺"] },
      { title: "内容主体", bullets: ["关键观点", "证据或案例", "视觉节拍"] },
      { title: "能力 / 方案展示", bullets: ["网页视频项目", "预览入口", "录屏路径"] },
      { title: "结尾收束", bullets: ["总结金句", "下一步行动"] },
    ];
  }

  return [
    { title: "封面", bullets: ["主题", "汇报对象", "时间"] },
    { title: "需求摘要", bullets: ["场景", "受众", "目标", "页数"] },
    { title: "核心判断", bullets: ["一句话结论", "关键数据"] },
    { title: "展开分析", bullets: ["现状", "问题", "机会"] },
    { title: "行动建议", bullets: ["策略", "优先级", "风险"] },
    { title: "结尾页", bullets: ["下一步", "Q&A"] },
  ];
}

export function buildFallbackOutlinePart(input: {
  kind: OutlineKind;
  briefText: string;
}): Extract<ChatPart, { kind: OutlineKind }> {
  const title = outlineTitleFromKind(input.kind);
  const items = buildFallbackOutlineItems(input);
  const markdown = [
    `# ${
      input.kind === "writing_outline"
        ? "标题建议"
        : input.kind === "ppt_outline"
          ? "封面标题建议"
          : input.kind === "3d_outline"
            ? "3D 建模方案"
            : "视频 outline"
    }`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title}`,
      ...item.bullets.map((bullet) => `   - ${bullet}`),
    ]),
  ].join("\n");

  if (input.kind === "writing_outline") {
    return {
      id: newPartId(input.kind),
      zone: "summary",
      kind: input.kind,
      title,
      markdown,
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        sections: items.map((item, index) => ({
          id: stableOutlineId("writing-section", index),
          title: item.title,
          bullets: item.bullets,
        })),
      },
      streaming: false,
      completedAt: Date.now(),
    };
  }

  if (input.kind === "3d_outline") {
    return {
      id: newPartId(input.kind),
      zone: "summary",
      kind: input.kind,
      title,
      markdown,
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        title: "3D 建模方案",
        blocks: items.map((item, index) => ({
          id: stableOutlineId("3d-block", index),
          title: item.title,
          bullets: item.bullets,
        })),
      },
      streaming: false,
      completedAt: Date.now(),
    };
  }

  if (input.kind === "video_outline") {
    return {
      id: newPartId(input.kind),
      zone: "summary",
      kind: input.kind,
      title,
      markdown,
      outline: {
        version: 1,
        source: "ai",
        committed: false,
        title: markdownTitle(markdown, "视频 outline"),
        blocks: items.map((item, index) => ({
          id: stableOutlineId("video-chapter", index),
          title: item.title,
          bullets: item.bullets,
        })),
      },
      streaming: false,
      completedAt: Date.now(),
    };
  }

  return {
    id: newPartId(input.kind),
    zone: "summary",
    kind: input.kind,
    title,
    coverTitle: markdownTitle(markdown, "PPT 页纲"),
    markdown,
    outline: {
      version: 1,
      source: "ai",
      committed: false,
      slides: items.map((item, index) => ({
        id: stableOutlineId("ppt-slide", index),
        title: item.title,
        bullets: item.bullets,
      })),
    },
    streaming: false,
    completedAt: Date.now(),
  };
}

export function buildRequirementSummaryPart(input: {
  requirementsKind: RequirementsKind;
  answer: string;
}): Extract<
  ChatPart,
  {
    kind:
      | "writing_requirement_summary"
      | "ppt_requirement_summary"
      | "3d_requirement_summary"
      | "video_requirement_summary";
  }
> {
  return {
    id: newPartId(summaryKindFromRequirementsKind(input.requirementsKind)),
    zone: "summary",
    kind: summaryKindFromRequirementsKind(input.requirementsKind),
    title: summaryTitleFromRequirementsKind(input.requirementsKind),
    markdown: [
      "## 已确认需求",
      "",
      input.answer.trim(),
    ].join("\n"),
    streaming: false,
    completedAt: Date.now(),
  };
}

const OUTLINE_BLOCK_MARKERS = {
  writing_outline: {
    start: "<!--JLC:WRITING_OUTLINE_START-->",
    end: "<!--JLC:WRITING_OUTLINE_END-->",
  },
  ppt_outline: {
    start: "<!--JLC:PPT_OUTLINE_START-->",
    end: "<!--JLC:PPT_OUTLINE_END-->",
  },
  "3d_outline": {
    start: "<!--JLC:3D_OUTLINE_START-->",
    end: "<!--JLC:3D_OUTLINE_END-->",
  },
  video_outline: {
    start: "<!--JLC:VIDEO_OUTLINE_START-->",
    end: "<!--JLC:VIDEO_OUTLINE_END-->",
  },
} as const;

const SUMMARY_BLOCK_MARKERS = {
  writing_requirement_summary: {
    start: "<!--JLC:WRITING_REQUIREMENT_SUMMARY_START-->",
    end: "<!--JLC:WRITING_REQUIREMENT_SUMMARY_END-->",
  },
  ppt_requirement_summary: {
    start: "<!--JLC:PPT_REQUIREMENT_SUMMARY_START-->",
    end: "<!--JLC:PPT_REQUIREMENT_SUMMARY_END-->",
  },
  "3d_requirement_summary": {
    start: "<!--JLC:3D_REQUIREMENT_SUMMARY_START-->",
    end: "<!--JLC:3D_REQUIREMENT_SUMMARY_END-->",
  },
  video_requirement_summary: {
    start: "<!--JLC:VIDEO_REQUIREMENT_SUMMARY_START-->",
    end: "<!--JLC:VIDEO_REQUIREMENT_SUMMARY_END-->",
  },
} as const;

function extractMarkedBlock(
  source: string,
  markers: { start: string; end: string },
): { markdown: string; cleaned: string } | null {
  const startIndex = source.indexOf(markers.start);
  if (startIndex < 0) return null;
  const endIndex = source.indexOf(markers.end, startIndex + markers.start.length);
  if (endIndex < 0) return null;

  const before = source.slice(0, startIndex);
  const inside = source
    .slice(startIndex + markers.start.length, endIndex)
    .trim();
  const after = source.slice(endIndex + markers.end.length);
  if (!inside) return null;

  const cleaned = `${before}${after}`
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    markdown: inside,
    cleaned,
  };
}

function summaryKindFromInput(input: {
  moduleId: string;
  processSkill?: string | null;
}):
  | "writing_requirement_summary"
  | "ppt_requirement_summary"
  | "3d_requirement_summary"
  | "video_requirement_summary"
  | null {
  if (
    input.moduleId === "writing" &&
    input.processSkill === "skill-writing-base"
  ) {
    return "writing_requirement_summary";
  }
  if (input.moduleId === "ppt" && input.processSkill === "skill-ppt-base") {
    return "ppt_requirement_summary";
  }
  if (
    input.moduleId === "3d" &&
    input.processSkill === "skill-industrial-drawing-base"
  ) {
    return "3d_requirement_summary";
  }
  if (input.moduleId === "video" && input.processSkill === "skill-vp-base") {
    return "video_requirement_summary";
  }
  return null;
}

function extractHeadingSection(input: {
  source: string;
  kind:
    | "writing_requirement_summary"
    | "ppt_requirement_summary"
    | "3d_requirement_summary"
    | "video_requirement_summary";
}): { markdown: string; cleaned: string } | null {
  const lines = input.source.replace(/\r\n/g, "\n").split("\n");
  const headingPattern =
    input.kind === "writing_requirement_summary"
      ? /^#{1,3}\s*(写作需求摘要|已确认需求)\s*$/
      : input.kind === "ppt_requirement_summary"
        ? /^#{1,3}\s*((PPT|演示)\s*)?需求摘要\s*$/i
        : input.kind === "video_requirement_summary"
          ? /^#{1,3}\s*((视频|网页视频)\s*)?需求摘要\s*$/i
          : /^#{1,3}\s*((3D|三维)\s*)?(需求摘要|制图需求摘要|建模需求摘要)\s*$/i;
  const startLine = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startLine < 0) return null;

  const startLevel = lines[startLine]?.trim().match(/^(#+)/)?.[1]?.length ?? 2;
  let endLine = lines.length;
  for (let index = startLine + 1; index < lines.length; index += 1) {
    const match = lines[index]?.trim().match(/^(#{1,6})\s+/);
    if (match && match[1].length <= startLevel) {
      endLine = index;
      break;
    }
  }

  const markdown = lines.slice(startLine, endLine).join("\n").trim();
  if (!markdown) return null;
  const cleaned = [...lines.slice(0, startLine), ...lines.slice(endLine)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { markdown, cleaned };
}

export function extractRequirementSummaryPartFromAssistantMarkdown(input: {
  moduleId: string;
  processSkill?: string | null;
  assistantMarkdown: string;
}): {
  part: Extract<
    ChatPart,
    {
      kind:
        | "writing_requirement_summary"
        | "ppt_requirement_summary"
        | "3d_requirement_summary"
        | "video_requirement_summary";
    }
  >;
  cleanedMarkdown: string;
} | null {
  const inferredKind = summaryKindFromInput(input);
  const summaryKinds = inferredKind
    ? [inferredKind]
    : ([
        "writing_requirement_summary",
        "ppt_requirement_summary",
        "3d_requirement_summary",
        "video_requirement_summary",
      ] as const);

  for (const kind of summaryKinds) {
    const marked = extractMarkedBlock(
      input.assistantMarkdown,
      SUMMARY_BLOCK_MARKERS[kind],
    );
    const extracted =
      marked ??
      extractHeadingSection({
        source: input.assistantMarkdown,
        kind,
      });
    if (!extracted) continue;
    return {
      part: {
        id: newPartId(kind),
        zone: "summary",
        kind,
        title: summaryTitleFromKind(kind),
        markdown: extracted.markdown,
        streaming: false,
        completedAt: Date.now(),
      },
      cleanedMarkdown: extracted.cleaned,
    };
  }

  return null;
}

export function extractOutlinePartFromAssistantMarkdown(input: {
  assistantMarkdown: string;
}): {
  part: Extract<ChatPart, { kind: OutlineKind }>;
  cleanedMarkdown: string;
} | null {
  for (const [kind, markers] of Object.entries(OUTLINE_BLOCK_MARKERS) as Array<
    [
      OutlineKind,
      { start: string; end: string },
    ]
  >) {
    const extracted = extractMarkedBlock(input.assistantMarkdown, markers);
    if (!extracted) continue;
    const outline = buildStructuredOutline({
      kind,
      markdown: extracted.markdown,
    });
    const title = outlineTitleFromKind(kind);
    if (kind === "writing_outline") {
      return {
        part: {
          id: newPartId(kind),
          zone: "summary",
          kind,
          title,
          markdown: extracted.markdown,
          outline: outline && "sections" in outline ? outline : undefined,
          streaming: false,
          completedAt: Date.now(),
        },
        cleanedMarkdown: extracted.cleaned,
      };
    }

    if (kind === "3d_outline" || kind === "video_outline") {
      return {
        part: {
          id: newPartId(kind),
          zone: "summary",
          kind,
          title,
          markdown: extracted.markdown,
          outline: outline && "blocks" in outline ? outline : undefined,
          streaming: false,
          completedAt: Date.now(),
        },
        cleanedMarkdown: extracted.cleaned,
      };
    }

    return {
      part: {
        id: newPartId(kind),
        zone: "summary",
        kind,
        title,
        coverTitle: markdownTitle(extracted.markdown, "PPT 页纲"),
        markdown: extracted.markdown,
        outline: outline && "slides" in outline ? outline : undefined,
        streaming: false,
        completedAt: Date.now(),
      },
      cleanedMarkdown: extracted.cleaned,
    };
  }

  return null;
}

function requirementsKindFromInput(input: {
  moduleId: string;
  processSkill?: string | null;
}): RequirementsKind | null {
  if (
    input.moduleId === "writing" &&
    input.processSkill === "skill-writing-base"
  ) {
    return "writing_requirements";
  }
  if (input.moduleId === "ppt" && input.processSkill === "skill-ppt-base") {
    return "ppt_requirements";
  }
  if (
    input.moduleId === "3d" &&
    input.processSkill === "skill-industrial-drawing-base"
  ) {
    return "3d_requirements";
  }
  if (input.moduleId === "video" && input.processSkill === "skill-vp-base") {
    return "video_requirements";
  }
  return null;
}

function normalizeOptionLabel(raw: string): string {
  return raw.replace(/`/g, "").replace(/^[-*]\s*/, "").trim();
}

function splitOptions(raw: string): Array<{ label: string; description?: string }> {
  const backtickMatches = Array.from(raw.matchAll(/`([^`]+)`/g))
    .map((match) => normalizeOptionLabel(match[1] ?? ""))
    .filter(Boolean);
  if (backtickMatches.length >= 2) {
    return backtickMatches.map((label) => ({ label }));
  }

  const source = raw.includes(" / ")
    ? raw.split(/\s+\/\s+/)
    : raw.includes("、")
      ? raw.split("、")
      : raw.includes("，")
        ? raw.split("，")
        : raw.includes("/")
          ? raw.split(/\s*\/\s*/)
          : [raw];

  return source
    .map((item) => normalizeOptionLabel(item))
    .filter(Boolean)
    .map((label) => ({ label }));
}

function splitQuestionLead(raw: string): {
  title: string;
  extraLines: string[];
} {
  const normalized = raw
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
  const colonIndex = normalized.search(/[：:]/);
  if (colonIndex > 0 && colonIndex <= 16) {
    const before = normalized.slice(0, colonIndex).trim();
    const after = normalized.slice(colonIndex + 1).trim();
    if (before && after) return { title: before, extraLines: [after] };
  }
  const markerIndex = normalized.search(/比如|例如/);
  if (markerIndex <= 0) {
    return { title: normalized, extraLines: [] };
  }
  return {
    title: normalized.slice(0, markerIndex).trim(),
    extraLines: [normalized.slice(markerIndex).trim()],
  };
}

function inferFallbackTitle(input: {
  introText: string;
  kind: RequirementsKind;
}): string {
  const intro = input.introText
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!intro) return defaultTitle(input.kind);

  const firstSentence = intro
    .split(/(?<=[。！？!?])/)
    .map((item) => item.trim())
    .find(Boolean);
  const preferred = firstSentence ?? intro;
  return preferred.length <= 44
    ? preferred
    : `${preferred.slice(0, 43).trim()}…`;
}

function inferQuestionType(input: {
  title: string;
  lines: string[];
}): NonNullable<StructuredQuestion["type"]> {
  const joined = [input.title, ...input.lines].join(" ");
  if (/日期/.test(joined) && /时间/.test(joined)) return "datetime";
  if (/具体时间|几点|时间/.test(joined)) return "time";
  if (/日期|发文日|哪天/.test(joined)) return "date";
  if (/页数|篇幅|数量|人数|时长/.test(joined)) return "number";
  if (/材料|说明|补充|内容|要求/.test(joined)) return "textarea";
  return "text";
}

function inferQuestionOptions(input: {
  title: string;
  lines: string[];
}): {
  options?: Array<{ label: string; description?: string }>;
  type?: "single_select" | "multi_select";
  descriptionLines: string[];
} {
  const descriptionLines = [...input.lines];
  const explicitLine = descriptionLines.find(
    (line) => line.startsWith("可选：") || line.startsWith("可多选："),
  );
  if (explicitLine) {
    return {
      options: splitOptions(explicitLine.replace(/^可(多)?选：/, "").trim()),
      type: explicitLine.startsWith("可多选：") ? "multi_select" : "single_select",
      descriptionLines: descriptionLines.filter((line) => line !== explicitLine),
    };
  }

  const exampleLine = descriptionLines.find(
    (line) => /^比如|^例如/.test(line),
  );
  if (!exampleLine) {
    return { descriptionLines };
  }

  const normalized = exampleLine
    .replace(/^比如：?/, "")
    .replace(/^例如：?/, "")
    .replace(/[。；]$/, "")
    .trim();
  const options = splitOptions(
    normalized
      .replace(/还是/g, " / ")
      .replace(/或者/g, " / ")
      .replace(/或/g, " / "),
  );

  if (options.length >= 2 && options.length <= 6) {
    return {
      options,
      type: /哪些|哪些内容|多选/.test(input.title) ? "multi_select" : "single_select",
      descriptionLines: descriptionLines.filter((line) => line !== exampleLine),
    };
  }

  return { descriptionLines };
}

export function extractRequirementsPartFromAssistantMarkdown(input: {
  runId?: string;
  moduleId: string;
  processSkill?: string | null;
  assistantMarkdown: string;
}): Extract<ChatPart, { kind: RequirementsKind }> | null {
  const kind = requirementsKindFromInput(input);
  if (!kind) return null;

  const jsonPayload = findRequirementsJsonPayload(input.assistantMarkdown, kind);
  if (jsonPayload) {
    const part = buildRequirementsPart({
      runId: input.runId ?? "",
      toolUseId: newPartId(`${kind}-json`),
      moduleId: input.moduleId,
      processSkill: input.processSkill,
      rawInput: jsonPayload,
      questions: normalizeStructuredQuestions(jsonPayload.questions),
    });
    if (part) return part;
  }

  const lines = input.assistantMarkdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd());
  const numberedQuestion = /^(?:\*\*)?(\d+)[.、]\s+(.+?)(?:\*\*)?$/;
  const bulletQuestion = /^[-*]\s+(.+)$/;
  const stopLine = /^(```|你也可以直接按下面格式回复我|请按下面格式回复我|你回复后|请确认以上理解|我确认后)/;

  const introLines: string[] = [];
  const questionBlocks: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;
  let seenQuestion = false;

  for (const line of lines) {
    if (!seenQuestion && !line.trim()) {
      if (introLines.length > 0) introLines.push("");
      continue;
    }
    if (stopLine.test(line.trim())) break;

    const normalizedLine = line.trim().replace(/\*\*/g, "").trim();
    const numbered = normalizedLine.match(numberedQuestion);
    if (numbered) {
      seenQuestion = true;
      if (current) questionBlocks.push(current);
      const next = splitQuestionLead(numbered[2] ?? "");
      current = { title: next.title, lines: next.extraLines };
      continue;
    }

    const bulleted = normalizedLine.match(bulletQuestion);
    if (bulleted && /[？?]/.test(bulleted[1] ?? "")) {
      seenQuestion = true;
      if (current) questionBlocks.push(current);
      const next = splitQuestionLead(bulleted[1] ?? "");
      current = { title: next.title, lines: next.extraLines };
      continue;
    }

    if (!seenQuestion) {
      if (line.trim()) introLines.push(line.trim());
      continue;
    }

    if (current) {
      current.lines.push(line.trim());
    }
  }
  if (current) questionBlocks.push(current);
  if (questionBlocks.length < 2) return null;
  const introText = introLines.join("\n").trim();
  const hasRequirementsLead =
    /补充|还需要补|先补|关键信息|需求收敛|建模前|制图前/.test(introText) ||
    /请先补充/.test(input.assistantMarkdown);
  const hasChoiceHints = questionBlocks.some((block) =>
    block.lines.some(
      (line) =>
        line.startsWith("可选：") ||
        line.startsWith("可多选：") ||
        line.startsWith("可选补充：") ||
        /^比如|^例如/.test(line),
    ),
  );
  const looksLikeRequirementsChecklist =
    questionBlocks.length >= 3 &&
    /还需要.*个信息|还需要.*个关键信息|还需要这.*个信息|需要先补.*个关键信息|需要补.*个关键信息/.test(
      input.assistantMarkdown,
    );
  if (!hasRequirementsLead || (!hasChoiceHints && !looksLikeRequirementsChecklist)) {
    return null;
  }

  const questions = questionBlocks.map((block, index) => {
    const inferredOptions = inferQuestionOptions({
      title: block.title,
      lines: block.lines,
    });
    const descriptionLines = inferredOptions.descriptionLines
      .map((line) => line.replace(/^补充说明：/, "").trim())
      .filter(Boolean);
    const questionType =
      inferredOptions.type ??
      inferQuestionType({
        title: block.title,
        lines: descriptionLines,
      });

    return {
      id: `q${index + 1}`,
      question: block.title,
      label: block.title,
      type: questionType,
      required: index < 4,
      description: descriptionLines.length > 0 ? descriptionLines.join(" ") : undefined,
      placeholder: inferredOptions.options ? undefined : "请输入",
      options: inferredOptions.options,
    };
  });

  return {
    id: newPartId(kind),
    zone: "summary",
    kind,
    title: inferFallbackTitle({
      introText,
      kind,
    }),
    description:
      introLines.join("\n").trim() || defaultDescription(kind),
    questions: questions.map((question) => ({
      id: question.id,
      label: question.label,
      type: question.type,
      required: question.required,
      description: question.description,
      placeholder: question.placeholder,
      options: question.options,
    })),
    streaming: false,
    completedAt: Date.now(),
  };
}

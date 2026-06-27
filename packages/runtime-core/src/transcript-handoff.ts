/**
 * F-RT-009-B1：LLM Handoff 摘要构建器（PRD §F-RT-009-B）。
 *
 * 与 transcript-compress.ts（确定性截断 + 标记）的区别：
 *  - 确定性版：把较早消息按字符上限截断后拼成 user 块；不调用 LLM；结果机械、保真度有限。
 *  - LLM Handoff 版：调用 BYOK 远程模型，按 PRD 固定的 5 个 Markdown 标题
 *    （## Context / ## Decisions made / ## Open questions / ## Current focus
 *      / ## Provenance）生成结构化续聊摘要；要求保留决策与开放问题。
 *
 * 设计取舍：
 *  - **不**在本包内实现 fetch / SSRF / Anthropic↔OpenAI 转换，那些都在
 *    web/src/lib/byok/ 里成熟。本包只暴露：
 *      1) 一份固定 prompt（buildLlmHandoffPrompt）让调用侧塞进 BYOK
 *      2) 一个轻封装（buildLlmHandoffSummary）让调用方传入 summarizer 函数，
 *         拿到结构化摘要 + 准备好的 Run messages（与 confederate 包一致接口）
 *      3) 验证函数（assertHandoffSummaryShape）—— 模型偶尔会漏标题或多余
 *         前后文，这里粗校验 5 个二级标题都出现，缺则在末尾追加占位段，
 *         保证下游解析不会爆。
 *  - 失败回退（B7）由调用方负责：调用 summarizer 抛错时调用方自己降级到
 *    compressConversationMessages。本包不预设回退路径，保持纯函数。
 *
 * 与 F-RT-009-A 的协同：
 *  buildLlmHandoffSummary 返回的 { messages } 与 compressConversationMessages
 *  返回的 { messages } 形状一致，都是 [<summary as user>, ...recent]，可直接
 *  喂给 prepareMessagesForRun 后续二次收紧逻辑（不需要重新设计 Run 入口）。
 */

import type { RunConversationMessage } from "./conversation-prompt.js";

// -----------------------------------------------------------------------------
// 常量
// -----------------------------------------------------------------------------

/**
 * 软阈值：合成 prompt 字节数 ≥ 该阈值时，应当**升级**到 LLM handoff
 * （而非仅做确定性截断）。PRD §F-RT-009-B B2 建议 800 KB。
 * 800 * 1024 = 819_200。
 */
export const LLM_HANDOFF_BYTES_SOFT_THRESHOLD = 819_200;

/** Handoff 摘要默认保留最近多少条原文 */
export const DEFAULT_HANDOFF_KEEP_RECENT = 6;

/** PRD 固定的 5 个二级标题，顺序不动 */
export const HANDOFF_REQUIRED_HEADERS = [
  "## Context",
  "## Decisions made",
  "## Open questions",
  "## Current focus",
  "## Provenance",
] as const;

/** 兜底占位（模型漏标题时往末尾补） */
const PLACEHOLDER_BODY = "（模型未输出此段；请结合上下文补充）";

// -----------------------------------------------------------------------------
// Provenance 元信息
// -----------------------------------------------------------------------------

export type HandoffProvenance = {
  sessionId: string;
  /** 进入 handoff 时的总消息条数（含被压缩 + 保留的） */
  messageCount: number;
  /** 被本次 handoff 压缩掉（不含保留最近 N 条）的条数 */
  droppedCount: number;
  /** UTC ISO 时间戳；调用方传入而非 new Date()，便于测试与日志一致 */
  generatedAt: string;
  /** 用于审计的 modelId（脱敏后端用） */
  modelId?: string;
};

function renderProvenanceBlock(p: HandoffProvenance): string {
  const lines = [
    `- sessionId: \`${p.sessionId}\``,
    `- messageCount: ${p.messageCount}`,
    `- droppedCount: ${p.droppedCount}`,
    `- generatedAt (UTC): ${p.generatedAt}`,
  ];
  if (p.modelId) lines.push(`- modelId: \`${p.modelId}\``);
  return lines.join("\n");
}

// -----------------------------------------------------------------------------
// Prompt
// -----------------------------------------------------------------------------

/**
 * 给 BYOK summarizer 的 system prompt（精简、固定 5 段标题、强调"决策"和"开放问题"）。
 * 用中文与英文混用，是有意为之 —— Markdown 标题保英文以稳定下游正则匹配，
 * 内文允许中文便于研究员阅读。
 */
export const HANDOFF_SYSTEM_PROMPT = [
  "你是一个会话续聊摘要器。下面给你一段较长的研究员–助手对话，请输出一份**严格结构化**的续聊（Handoff）摘要，",
  "用于在新的对话上下文中无损延续工作。",
  "",
  "**输出必须严格使用以下 5 个二级 Markdown 标题，按顺序，每段都要写：**",
  "",
  "## Context",
  "（任务背景、约束、研究员的目标 · 1~3 段）",
  "",
  "## Decisions made",
  "（已经做出的决策、已确认的事实、已采纳的方案 · 用 - 列表，每条一句）",
  "",
  "## Open questions",
  "（仍未解决的问题、需要研究员澄清的点、未尝试的分支 · 用 - 列表）",
  "",
  "## Current focus",
  "（当前最该接着做的下一步 · 1 段，最具体）",
  "",
  "## Provenance",
  "（按调用方传入的元信息原样输出，**不要**自己编造 sessionId 或时间戳）",
  "",
  "**禁止：** 输出 5 个标题之外的额外二级 / 一级标题；输出代码块包裹整篇答复；写成对话回复（如\"好的，下面是摘要...\"）。",
  "**应当：** 决策与开放问题尽量短、可执行；遇到工具输出 / 代码片段，提炼结论而非粘贴原文。",
].join("\n");

/**
 * 用户消息（包给 summarizer）：把 prior + recent 拼出来，附上 provenance
 * 元信息让模型把 Provenance 段直接渲染。
 */
export function buildHandoffUserPrompt(input: {
  prior: RunConversationMessage[];
  recent: RunConversationMessage[];
  provenance: HandoffProvenance;
}): string {
  const formatMessages = (
    msgs: RunConversationMessage[],
    label: string,
  ): string => {
    if (msgs.length === 0) return `（${label}：空）`;
    return [
      `### ${label}`,
      ...msgs.map((m, i) => {
        const role = m.role === "user" ? "用户" : "助手";
        return `**[${i + 1}] ${role}：**\n${m.content}`;
      }),
    ].join("\n\n");
  };

  return [
    "请根据以下对话内容生成 Handoff 摘要。",
    "",
    "## 待压缩的较早消息",
    "",
    formatMessages(input.prior, "较早对话"),
    "",
    "## 保留原文的最近消息（不必再摘要，仅作上下文参考）",
    "",
    formatMessages(input.recent, "最近对话"),
    "",
    "## Provenance 元信息（请原样填进 Provenance 段）",
    "",
    renderProvenanceBlock(input.provenance),
  ].join("\n");
}

// -----------------------------------------------------------------------------
// 摘要校验 / 兜底
// -----------------------------------------------------------------------------

/**
 * 检查 5 个二级标题是否都在；缺哪段就在末尾补哪段（标题 + 占位文本）。
 * 顺序由 HANDOFF_REQUIRED_HEADERS 决定。
 */
export function assertHandoffSummaryShape(
  summary: string,
  provenance: HandoffProvenance,
): { summary: string; missingHeaders: string[] } {
  const missingHeaders: string[] = [];
  for (const h of HANDOFF_REQUIRED_HEADERS) {
    if (!new RegExp(`^${escapeRegExp(h)}\\b`, "m").test(summary)) {
      missingHeaders.push(h);
    }
  }
  if (missingHeaders.length === 0) return { summary, missingHeaders };

  // 把 Provenance 段总是放最后一段补上 —— 它有标准化的元数据
  const appended = missingHeaders.map((h) => {
    if (h === "## Provenance") {
      return `${h}\n\n${renderProvenanceBlock(provenance)}`;
    }
    return `${h}\n\n${PLACEHOLDER_BODY}`;
  });
  return {
    summary: `${summary.trimEnd()}\n\n${appended.join("\n\n")}\n`,
    missingHeaders,
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -----------------------------------------------------------------------------
// 主入口：buildLlmHandoffSummary
// -----------------------------------------------------------------------------

export type HandoffSummarizer = (input: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
}) => Promise<{ text: string; modelId?: string }>;

export type LlmHandoffSummaryInput = {
  messages: RunConversationMessage[];
  sessionId: string;
  /** 调 BYOK 一次性返回完整 summary 的函数（由 web BFF 注入） */
  summarizer: HandoffSummarizer;
  /** 保留最近多少条原文不进 summary，默认 DEFAULT_HANDOFF_KEEP_RECENT */
  keepRecent?: number;
  /** UTC ISO 时间戳；调用方传 */
  generatedAt: string;
  signal?: AbortSignal;
};

export type LlmHandoffSummaryResult = {
  /** 续聊用的消息序列：[<summary as user>, ...recent N 条原文] */
  messages: RunConversationMessage[];
  /** 完整的 Markdown 摘要（可入会话元数据） */
  summary: string;
  /** 给 UI 显示的 80 字预览（首段 Context 截断） */
  summaryPreview: string;
  /** Provenance 元信息（持久化用） */
  provenance: HandoffProvenance;
  /** 摘要中漏掉、被本地补齐的标题 —— 0 长度数组表示模型输出完整 */
  missingHeaders: string[];
};

/**
 * 用 BYOK 生成 LLM Handoff 摘要。
 *
 * 失败处理：summarizer 抛错时本函数也抛错；调用方负责降级到
 * compressConversationMessages（B7）。
 */
export async function buildLlmHandoffSummary(
  input: LlmHandoffSummaryInput,
): Promise<LlmHandoffSummaryResult> {
  const keepRecent = Math.max(2, input.keepRecent ?? DEFAULT_HANDOFF_KEEP_RECENT);
  const total = input.messages.length;
  if (total <= keepRecent) {
    // 没有可压缩的较早消息，但仍调用一次 summarizer 让用户得到结构化的"现状快照"
    // 也是合理的 —— 不过 UI 通常不会触到这里（前置阈值挡掉）。这里直接返回原 messages
    // 加一个最小占位 Provenance，不真的去打 BYOK，省 token。
    const provenance: HandoffProvenance = {
      sessionId: input.sessionId,
      messageCount: total,
      droppedCount: 0,
      generatedAt: input.generatedAt,
    };
    const summary = [
      "## Context",
      "本会话当前消息数尚未触发 Handoff 阈值，跳过摘要生成。",
      "",
      "## Decisions made",
      PLACEHOLDER_BODY,
      "",
      "## Open questions",
      PLACEHOLDER_BODY,
      "",
      "## Current focus",
      PLACEHOLDER_BODY,
      "",
      "## Provenance",
      "",
      renderProvenanceBlock(provenance),
    ].join("\n");
    return {
      messages: input.messages,
      summary,
      summaryPreview: summarizeFirstSection(summary),
      provenance,
      missingHeaders: [],
    };
  }

  const prior = input.messages.slice(0, -keepRecent);
  const recent = input.messages.slice(-keepRecent);
  const provenance: HandoffProvenance = {
    sessionId: input.sessionId,
    messageCount: total,
    droppedCount: prior.length,
    generatedAt: input.generatedAt,
  };

  const userPrompt = buildHandoffUserPrompt({ prior, recent, provenance });
  const summarizerResult = await input.summarizer({
    systemPrompt: HANDOFF_SYSTEM_PROMPT,
    userPrompt,
    signal: input.signal,
  });
  provenance.modelId = summarizerResult.modelId;

  const verified = assertHandoffSummaryShape(
    summarizerResult.text.trim(),
    provenance,
  );

  return {
    messages: [
      { role: "user", content: verified.summary },
      ...recent,
    ],
    summary: verified.summary,
    summaryPreview: summarizeFirstSection(verified.summary),
    provenance,
    missingHeaders: verified.missingHeaders,
  };
}

/** 取 ## Context 段的首句作为 80 字预览（UI 用） */
function summarizeFirstSection(summary: string): string {
  const m = /## Context\s+([\s\S]*?)(?:\n## |\s*$)/.exec(summary);
  const body = m?.[1]?.trim() ?? summary.trim();
  const flat = body.replace(/\s+/g, " ");
  return flat.length <= 80 ? flat : `${flat.slice(0, 79)}…`;
}

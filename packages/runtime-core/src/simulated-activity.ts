import {
  isComplexDeepQuestion,
  type ChatModeId,
} from "./chat-mode.js";
import type { AgentId } from "./types.js";

export type SimulatedActivityEvent =
  | { type: "status"; label: string; phase?: string }
  | { type: "tool"; tool: string; status?: string; message?: string }
  | { type: "reasoning"; markdown: string }
  | {
      type: "todo";
      items: Array<{
        id: string;
        content: string;
        status: "pending" | "in_progress" | "completed" | "cancelled";
      }>;
    }
  | { type: "file_read"; path: string }
  | { type: "file_edit"; path: string; additions?: number; deletions?: number }
  | { type: "command"; command: string; status?: string }
  | { type: "interim"; text: string; alreadyStreamed?: boolean };

function hermesFastEvents(text: string): SimulatedActivityEvent[] {
  return [
    { type: "status", label: "检索", phase: "retrieve" },
    {
      type: "tool",
      tool: "web_search",
      status: "running",
      message: text.slice(0, 48) || "联网检索",
    },
    {
      type: "tool",
      tool: "terminal",
      status: "running",
      message: "分析检索结果",
    },
  ];
}

/** Companion simulate / CLI fallback 与 Web mock 共用的节奏化过程事件 */
export function getSimulatedActivityEvents(
  mode: ChatModeId,
  text: string,
  agentId?: AgentId,
): SimulatedActivityEvent[] {
  const effectiveMode =
    mode === "auto" ? (isComplexDeepQuestion(text) ? "deep" : "fast") : mode;

  if (agentId === "hermes" && effectiveMode === "fast") {
    return hermesFastEvents(text);
  }
  if (effectiveMode === "fast") {
    return [
      {
        type: "interim",
        text: "先检索本地指标与文档片段。",
      },
      {
        type: "tool",
        tool: "choice_query",
        status: "running",
        message: "检索指标",
      },
      { type: "tool", tool: "grep", status: "running", message: "社会库存" },
    ];
  }
  const hermesPrefix: SimulatedActivityEvent[] =
    agentId === "hermes"
      ? [
          {
            type: "tool",
            tool: "web_search",
            status: "running",
            message: text.slice(0, 60) || "联网检索",
          },
          { type: "tool", tool: "web_extract", status: "running", message: "抽取页面" },
        ]
      : [];

  if (effectiveMode === "deep" && !isComplexDeepQuestion(text)) {
    return [
      ...hermesPrefix,
      {
        type: "interim",
        text: "先检索本地上下文与资讯索引中的相关条目。",
      },
      { type: "status", label: "检索", phase: "retrieve" },
      { type: "file_read", path: "context.md" },
      {
        type: "interim",
        text: "接着在文档中交叉检索关键词并比对表述。",
      },
      {
        type: "tool",
        tool: "grep",
        status: "running",
        message: text.slice(0, 40) || "关键词",
      },
      {
        type: "reasoning",
        markdown: `拆解问题：${text.slice(0, 80) || "…"}`,
      },
      {
        type: "todo",
        items: [
          { id: "t1", content: "检索终端指标", status: "completed" },
          { id: "t2", content: "归纳多信源观点", status: "completed" },
          { id: "t3", content: "输出结论与引用", status: "in_progress" },
        ],
      },
      { type: "status", label: "分析", phase: "analyze" },
      {
        type: "command",
        command: "pnpm --filter web exec node -e \"console.log('metrics')\"",
        status: "running",
      },
      {
        type: "tool",
        tool: "choice_query",
        status: "running",
        message: "数据源",
      },
    ];
  }
  if (effectiveMode === "deep") {
    return [
    ...hermesPrefix,
    {
      type: "interim",
      text: "先从资讯索引与公告库分层检索，再汇总异同点。",
    },
    { type: "status", label: "检索", phase: "retrieve" },
    { type: "file_read", path: "docs/资讯索引.md" },
    { type: "tool", tool: "grep", status: "running", message: "政策 钢铁" },
    {
      type: "todo",
      items: [
        { id: "r1", content: "分层检索资讯/公告/研报", status: "completed" },
        { id: "r2", content: "异同分析与信源推荐", status: "completed" },
        { id: "r3", content: "生成研究摘要文件", status: "in_progress" },
      ],
    },
    { type: "status", label: "分析", phase: "analyze" },
    {
      type: "file_edit",
      path: "research_summary.md",
      additions: 42,
      deletions: 3,
    },
    { type: "status", label: "生成报告", phase: "generate" },
    ];
  }
  return [];
}

export {
  getSimulatedDeliverables,
  type SimulatedDeliverablesPayload,
} from "./simulated-deliverables.js";

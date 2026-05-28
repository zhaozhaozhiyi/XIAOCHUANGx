import { isComplexDeepQuestion } from "@jlc/runtime-core/chat-mode";
import type { ChatModeId } from "@/lib/navigation";
import type {
  ActivityCollapse,
  CanonicalEvent,
  CanonicalTurnOutput,
  ChatPart,
} from "@/lib/chat-parts";
import {
  defaultActivityCollapse,
  messageDisplayContent,
  partsFromPlainContent,
  withAssistantContentSnapshot,
} from "@/lib/chat-parts-utils";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import { NO_PROJECT_ID, setSessionProjectId } from "@/lib/research-projects";
import { agentLabel, type AgentId } from "@/lib/settings";
export type { AgentId };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** 用户消息正文；assistant 与 parts 同步 */
  content: string;
  /** 用户发送时携带的附件；文本类文件会带截断后的内容。 */
  attachments?: ChatAttachment[];
  status?: "complete" | "loading" | "streaming" | "error" | "cancelled";
  parts?: ChatPart[];
  activityCollapse?: ActivityCollapse;
  runId?: string;
  /** 本轮 Run 开始时间（用于步间「思考 Ns」） */
  runStartedAt?: number;
  /** 生成该条 assistant 时使用的 Agent CLI */
  agentId?: AgentId;
  /** 统一输出协议事件流（调试 / 后续替代 parts[] 的基础） */
  canonicalEvents?: CanonicalEvent[];
  /** 标准轮次结果（当前可选，后续可作为主渲染来源） */
  canonicalOutput?: CanonicalTurnOutput;
};

export type ChatAttachment = {
  id: string;
  name: string;
  path?: string;
  size: number;
  mimeType?: string;
  isImage?: boolean;
  type?: string;
  extension?: string;
  lastModified?: number;
  textContent?: string;
  truncated?: boolean;
};

export type ChatPendingAttachment = ChatAttachment & {
  file?: File;
};

const PENDING_KEY = (id: string) => `chat-pending-${id}`;
const pendingSessions = new Map<string, PendingSession>();

export type PendingSession = {
  text: string;
  attachments?: ChatPendingAttachment[];
  mode: ChatModeId;
  executionSource: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
  projectId?: string;
};

export function setPendingSession(id: string, payload: PendingSession) {
  if (typeof window === "undefined") return;
  pendingSessions.set(id, payload);
  const persisted = {
    ...payload,
    attachments: payload.attachments?.map((attachment) => {
      const persistedAttachment = { ...attachment };
      delete persistedAttachment.file;
      return persistedAttachment;
    }),
  };
  sessionStorage.setItem(PENDING_KEY(id), JSON.stringify(persisted));
  setSessionProjectId(id, payload.projectId ?? NO_PROJECT_ID);
}

export function consumePendingSession(id: string): PendingSession | null {
  if (typeof window === "undefined") return null;
  const pending = pendingSessions.get(id);
  if (pending) {
    pendingSessions.delete(id);
    sessionStorage.removeItem(PENDING_KEY(id));
    return pending;
  }
  const raw = sessionStorage.getItem(PENDING_KEY(id));
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_KEY(id));
  try {
    const parsed = JSON.parse(raw) as Partial<PendingSession>;
    if (
      typeof parsed.text !== "string" ||
      typeof parsed.mode !== "string" ||
      (parsed.executionSource !== "cli" && parsed.executionSource !== "api") ||
      typeof parsed.agentId !== "string" ||
      typeof parsed.agentModel !== "string" ||
      (parsed.attachments != null && !Array.isArray(parsed.attachments))
    ) {
      return null;
    }
    return parsed as PendingSession;
  } catch {
    return null;
  }
}

export function createMessage(
  role: ChatMessage["role"],
  content: string,
  status: ChatMessage["status"] = "complete",
  attachments?: ChatAttachment[],
): ChatMessage {
  const msg: ChatMessage = {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    status,
  };
  if (role === "user" && attachments?.length) {
    msg.attachments = attachments;
  }
  if (role === "assistant") {
    msg.parts = partsFromPlainContent(content, status);
    msg.activityCollapse = defaultActivityCollapse(status);
  }
  return withAssistantContentSnapshot(msg);
}

export function createAssistantPlaceholder(id: string): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "",
    status: "loading",
    parts: [],
    activityCollapse: "expanded",
  };
}

export { messageDisplayContent };

const SEED_SESSIONS: Record<string, ChatMessage[]> = {
  "1": [
    createMessage("user", "上周螺纹钢社会库存环比变化是多少？"),
    createMessage(
      "assistant",
      "据已接入数据源，上周螺纹钢社会库存环比下降 2.3%。当前库存处于近三年同期偏低水平，需关注下游开工恢复节奏。",
    ),
  ],
  "2": [
    createMessage("user", "碳排放政策对钢铁行业影响"),
    {
      id: "assistant-seed-2",
      role: "assistant",
      content:
        "政策收紧将抬升高炉产能约束预期，短期对钢材供给形成压制，中长期利好能效领先钢企。建议结合产量、库存与利润数据跟踪政策落地节奏。",
      status: "complete",
      activityCollapse: "collapsed",
      parts: ([
          {
            id: "seed-turn-meta",
            zone: "activity",
            kind: "turn_meta",
            label: "已处理 1m 42s",
            durationMs: 102000,
            runStatus: "complete",
            completedAt: Date.now(),
          },
          {
            id: "seed-status-1",
            zone: "activity",
            kind: "status",
            label: "检索",
            phase: "retrieve",
            completedAt: Date.now(),
          },
          {
            id: "seed-file-read",
            zone: "activity",
            kind: "file_read",
            path: "policy_brief.md",
            completedAt: Date.now(),
          },
          {
            id: "seed-tool-batch",
            zone: "activity",
            kind: "tool_batch",
            title: "检索 2 次 · 读取 1 个文件",
            items: [
              { tool: "grep", status: "success", message: "碳排放 钢铁" },
              { tool: "data_source_query", status: "success", message: "查询数据源" },
            ],
            completedAt: Date.now(),
          },
          {
            id: "seed-todo",
            zone: "activity",
            kind: "todo",
            items: [
              { id: "r1", content: "分层检索资讯/公告/研报", status: "completed" },
              { id: "r2", content: "异同分析与信源推荐", status: "completed" },
              { id: "r3", content: "生成研究摘要", status: "completed" },
            ],
            completedAt: Date.now(),
          },
          {
            id: "seed-reason-1",
            zone: "activity",
            kind: "reasoning",
            markdown:
              "1. 拆解政策维度：产能置换、环保限产、碳交易成本\n2. 映射产业链：高炉-螺纹-下游基建/地产",
            completedAt: Date.now(),
          },
          {
            id: "seed-file-edit",
            zone: "activity",
            kind: "file_edit",
            path: "research_summary.md",
            additions: 48,
            deletions: 6,
            completedAt: Date.now(),
          },
          {
            id: "seed-summary-1",
            zone: "summary",
            kind: "summary",
            markdown:
              "【深度研究摘要】政策收紧将抬升高炉产能约束预期，短期对钢材供给形成压制，中长期利好能效领先钢企。建议结合产量、库存与利润数据跟踪政策落地节奏。",
            completedAt: Date.now(),
          },
        ] satisfies ChatPart[]).map((p, i) => ({ ...p, streamSeq: i })),
    },
  ],
};

export function getSeedMessages(sessionId: string): ChatMessage[] | null {
  return SEED_SESSIONS[sessionId] ?? null;
}

export function getMockReply(
  text: string,
  mode: ChatModeId,
  agentId: AgentId,
): string {
  const q = text.toLowerCase();
  const agentTag = `【${agentLabel(agentId).replace(" CLI", "")}】`;

  if (q.includes("库存") && q.includes("螺纹")) {
    return `${agentTag} 据已接入数据源，上周螺纹钢社会库存环比下降 2.3%。库存较近三年同期偏低，下游需求恢复仍是关键变量。\n\n来源：数据源 · 螺纹钢社会库存`;
  }
  if (q.includes("原油") || q.includes("多空")) {
    return "已汇总 3 类信源观点：\n· 研报（偏多）：地缘溢价支撑油价\n· 资讯（中性）：炼厂开工平稳\n· 数据（偏空）：美国商业原油库存周增\n\n综合判断：短期震荡，建议关注 OPEC+ 产量决议。";
  }
  if (q.includes("大纲") || q.includes("周报")) {
    return "已为你生成螺纹钢周报大纲：\n1. 价格与基差回顾\n2. 供给：高炉开工与产量\n3. 需求：基建与地产用钢\n4. 库存：社会库与厂库\n5. 展望与风险提示\n\n可在「写作」模块中一键展开为完整文稿。";
  }

  if (mode === "deep") {
    if (isComplexDeepQuestion(text)) {
      return `${agentTag} 【深度分析摘要】\n· 主题：${text}\n· 信源：资讯 / 公告 / 研报 已分层归纳\n· 可导出可视化报告（功能接入后开放）`;
    }
    return `${agentTag} 核心驱动仍来自供需边际变化，建议结合库存与开工率继续跟踪。\n\n（结论见上；推理过程见 Activity 区）`;
  }

  return `${agentTag} 已收到你的问题：「${text}」。\n\n这是原型环境的模拟回复。正式环境将由 ${agentLabel(agentId)} 调用 数据源，并在答案中附带可溯源的数据与图表。`;
}

export type {
  SimulatedActivityEvent as MockActivityEvent,
} from "@jlc/runtime-core/simulated-activity";
export { getSimulatedActivityEvents as getMockActivityEvents } from "@jlc/runtime-core/simulated-activity";

export const MOCK_REPLY_DELAY_MS = 900;

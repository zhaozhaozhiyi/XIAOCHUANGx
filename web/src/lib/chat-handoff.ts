/**
 * F-RT-009-B Handoff —— 客户端集成层。
 *
 * 把 /api/sessions/{id}/compress-context 路由的返回值落到：
 *  1. ChatSessionRecord.contextCompression（顶栏 Badge / 侧栏 tooltip）
 *  2. 新的 messages 序列（前置 summary 作为 user 消息，保留最近 N 条）
 *
 * 触发口径：
 *  - autoCompressBeforeSend(): submit 之前的"自动触发"，超阈值才动手；
 *    返回 { messages: 新历史, info? } —— info 非空表示触发了压缩，
 *    调用方负责显示 toast / Badge
 *  - manualCompress(): 用户点"压缩上下文并继续"，强制执行（mode=auto，
 *    若有 BYOK 偏好 llm-handoff，否则 deterministic）
 *  - openHandoffNewChat(): 用户点"用摘要开新对话" —— 在前端用现有
 *    branchChatSession + 把 summary 塞为新会话的首条 user 消息（B4 不需要
 *    新路由，前端 helper 即可完成桌面单机场景）
 */

import { branchChatSession, setSessionContextCompression } from "@/lib/chat-history";
import { saveSessionMessagesHybrid } from "@/lib/chat-session-sync";
import { saveChatSessionMessages } from "@/lib/chat-session-messages";
import { createMessage, type ChatMessage } from "@/lib/chat";
import type { ApiProviderConfig } from "@/lib/byok/shared";

// 与 server route 对齐的软阈值；前端按 char 估，路由用 char*1.5 估字节
const HANDOFF_CHARS_SOFT_THRESHOLD = 120_000;

export type CompressContextMode = "auto" | "deterministic" | "llm-handoff";

export type CompressContextResponse = {
  source: "deterministic" | "llm-handoff";
  summary: string;
  summaryPreview: string;
  droppedCount: number;
  keepRecent: number;
  compressedAt: string;
  modelId?: string;
  missingHeaders?: string[];
  fallback?: { from: string; reason: string };
};

export type CompressContextErrorResponse = {
  error: string;
  message?: string;
};

function estimateChatMessagesChars(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    n += typeof m.content === "string" ? m.content.length : 0;
  }
  return n;
}

/** 该次发送是否应当先触发自动压缩 */
export function shouldAutoCompressBeforeSend(messages: ChatMessage[]): boolean {
  // 仅按字符量判断；条数判断由确定性路径（runtime-core 内部）兜底
  return estimateChatMessagesChars(messages) >= HANDOFF_CHARS_SOFT_THRESHOLD;
}

/**
 * 实际调 /api/sessions/{id}/compress-context；失败时抛错。
 * 返回 server 的原始 payload；调用方决定如何 merge。
 */
export async function callCompressContext(input: {
  sessionId: string;
  messages: ChatMessage[];
  mode: CompressContextMode;
  force?: boolean;
  apiProvider?: ApiProviderConfig;
  signal?: AbortSignal;
}): Promise<CompressContextResponse> {
  const res = await fetch(
    `/api/sessions/${encodeURIComponent(input.sessionId)}/compress-context`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: input.mode,
        messages: input.messages,
        force: input.force ?? false,
        apiProvider: input.apiProvider,
      }),
      signal: input.signal,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let parsed: CompressContextErrorResponse | null = null;
    try {
      parsed = text ? (JSON.parse(text) as CompressContextErrorResponse) : null;
    } catch {
      /* not json */
    }
    throw new Error(
      parsed?.message ??
        parsed?.error ??
        `compress_context_failed_${res.status}`,
    );
  }
  return (await res.json()) as CompressContextResponse;
}

/**
 * 把 server 返回的 summary 落到本地：
 *  - ChatSessionRecord.contextCompression（顶栏 Badge）
 *  - messages 序列：keepRecent 之前的全部消息替换为一条"自动压缩摘要"
 *    user 消息；保留最近 N 条原文。这里**只动 in-memory 视图**，是否
 *    持久化（saveSessionMessagesHybrid）由调用方根据流程决定。
 */
export function applyCompressionToMessages(
  messages: ChatMessage[],
  payload: CompressContextResponse,
): ChatMessage[] {
  const total = messages.length;
  const keep = Math.max(0, Math.min(payload.keepRecent, total));
  const recent = keep === 0 ? [] : messages.slice(-keep);
  const summaryMsg = createMessage("user", payload.summary, "complete");
  return [summaryMsg, ...recent];
}

/** 持久化压缩元数据到 ChatSessionRecord（同步调用，写 localStorage） */
export function persistCompressionRecord(
  sessionId: string,
  payload: CompressContextResponse,
): void {
  setSessionContextCompression(sessionId, {
    source: payload.source,
    compressedAt: payload.compressedAt,
    droppedCount: payload.droppedCount,
    summaryPreview: payload.summaryPreview,
    modelId: payload.modelId,
    fallbackReason: payload.fallback?.reason,
  });
}

/**
 * B4：把当前会话的 summary 当作"种子用户消息"开新会话。
 * 桌面单机版无需新增服务端路由，复用 branchChatSession + 写入 localStorage。
 *
 * 返回新 sessionId。
 */
export async function openHandoffNewChat(input: {
  parentSessionId: string;
  summary: string;
  /** 自动派一个，如不传则用时间戳 */
  newSessionId?: string;
  /** 用户可编辑的标题；省略则继承父会话标题 + "（续）" */
  title?: string;
  /** 把 summary 之外是否再附带原会话最近 N 条原文当作上下文（默认 0） */
  carryRecent?: ChatMessage[];
  /** 父会话的 projectId（V1.1 桌面单机：不一定能从全局拿到，由调用方传） */
  projectId?: string;
}): Promise<string> {
  const newSessionId =
    input.newSessionId ?? `session-${Date.now().toString(36)}`;
  branchChatSession(input.parentSessionId, newSessionId, input.title);

  // 把 summary 作为新会话的首条 user 消息；用户进入新会话后可直接编辑后再送
  const seedMessages: ChatMessage[] = [
    createMessage("user", input.summary, "complete"),
    ...(input.carryRecent ?? []),
  ];
  // 先写本地，避免新会话进 UI 时空白
  saveChatSessionMessages(newSessionId, seedMessages, { preserveInflight: false });
  // 持久化到 Companion（若 BFF 可达）；失败不致命
  void saveSessionMessagesHybrid(
    newSessionId,
    seedMessages,
    input.projectId,
  ).catch(console.error);

  return newSessionId;
}

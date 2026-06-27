/**
 * F-RT-009-B：压缩当前会话上下文
 *
 *   POST /api/sessions/{sessionId}/compress-context
 *
 *   Body:
 *     {
 *       mode: "deterministic" | "llm-handoff" | "auto",
 *       messages: ChatMessage[],          // 当前会话已有消息（前端持有真实历史）
 *       force?: boolean,                  // 不论 messages 长度都强行压缩
 *       apiProvider?: ApiProviderConfig,  // mode != deterministic 时必填
 *       keepRecent?: number,
 *     }
 *
 *   Response:
 *     {
 *       source: "deterministic" | "llm-handoff",
 *       summary: string,                  // 完整 Markdown 摘要正文
 *       summaryPreview: string,           // 80 字预览
 *       droppedCount: number,
 *       keepRecent: number,
 *       compressedAt: string,             // ISO UTC
 *       modelId?: string,                 // llm-handoff 时填
 *       missingHeaders?: string[],        // llm-handoff 时给前端做调试
 *       fallback?: { from: "llm-handoff", reason: string }, // B7 触发时填
 *     }
 *
 * 路由职责（保持薄）：
 *  1. 校验 body
 *  2. mode=auto → 按字符量决策：≥ 800KB 软阈值走 llm-handoff（带 BYOK 配置时），否则 deterministic
 *  3. 调 runtime-core 的 compressConversationMessages（确定性）或 buildLlmHandoffSummary（LLM）
 *  4. llm-handoff 失败 → 自动回退确定性（B7），response.fallback 透出原因
 *  5. **不**做持久化 —— 由前端拿到 response 后调 setSessionContextCompression
 *
 * 不做（V1.1 桌面单机不在 scope）：
 *  - admin gate（PRD F-RT-002 后续要求；当前任意用户可调）
 *  - 配额 / 审计（B6）—— 仅 console.log 留痕
 *  - SSE 重连（B8）
 */

import {
  buildLlmHandoffSummary,
  compressConversationMessages,
  estimateTranscriptChars,
  AUTO_COMPRESS_CHARS_THRESHOLD,
  type LlmHandoffSummaryResult,
  type RunConversationMessage,
} from "@jlc/runtime-core";
import {
  oneShotApiProviderCompletion,
} from "@/lib/byok/server";
import {
  hasUsableApiProviderConfig,
  trimApiProviderConfig,
  type ApiProviderConfig,
} from "@/lib/byok/shared";
import type { ChatMessage } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompressMode = "deterministic" | "llm-handoff" | "auto";

type Body = {
  mode?: CompressMode;
  messages?: ChatMessage[];
  force?: boolean;
  apiProvider?: ApiProviderConfig;
  keepRecent?: number;
};

const SOFT_THRESHOLD_CHARS = AUTO_COMPRESS_CHARS_THRESHOLD; // 120k chars ≈ 软阈值底线
const HANDOFF_BYTES_SOFT_THRESHOLD = 819_200; // 800 KB

function chatMessagesToRunMessages(
  messages: ChatMessage[],
): RunConversationMessage[] {
  return messages
    .filter(
      (m): m is ChatMessage =>
        m && typeof m.content === "string" && m.content.length > 0,
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.agentId ? { agentId: m.agentId } : {}),
    }));
}

function decideAutoMode(
  messages: RunConversationMessage[],
  hasBYOK: boolean,
): "deterministic" | "llm-handoff" {
  if (!hasBYOK) return "deterministic";
  // 按字节数估算（每 char ≈ 1 字节，中文按 utf8 一般 3 字节）
  const chars = estimateTranscriptChars(messages);
  // chars * 1.5（保守换算，混 ASCII 与 CJK） >= 800k bytes
  if (chars * 1.5 >= HANDOFF_BYTES_SOFT_THRESHOLD) return "llm-handoff";
  if (chars >= SOFT_THRESHOLD_CHARS) return "llm-handoff";
  return "deterministic";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id: sessionId } = await params;
  if (!sessionId?.trim()) {
    return Response.json({ error: "session_id_required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return Response.json({ error: "messages_required" }, { status: 400 });
  }
  const runMessages = chatMessagesToRunMessages(messages);
  if (runMessages.length === 0) {
    return Response.json({ error: "no_text_messages" }, { status: 400 });
  }

  const requestedMode: CompressMode = body.mode ?? "auto";
  const config = body.apiProvider
    ? trimApiProviderConfig(body.apiProvider)
    : null;
  const hasBYOK =
    !!config && hasUsableApiProviderConfig(config) && !!config.apiKey.trim();

  const effectiveMode: "deterministic" | "llm-handoff" =
    requestedMode === "auto"
      ? decideAutoMode(runMessages, hasBYOK)
      : requestedMode;

  const compressedAt = new Date().toISOString();

  // ---------------- llm-handoff ----------------
  if (effectiveMode === "llm-handoff") {
    if (!hasBYOK || !config) {
      return Response.json(
        {
          error: "byok_unavailable",
          message: "未配置可用的 BYOK Provider，无法生成 LLM Handoff 摘要",
        },
        { status: 422 },
      );
    }

    let result: LlmHandoffSummaryResult;
    try {
      result = await buildLlmHandoffSummary({
        messages: runMessages,
        sessionId,
        keepRecent: body.keepRecent,
        generatedAt: compressedAt,
        signal: request.signal,
        summarizer: async ({ systemPrompt, userPrompt, signal }) => {
          return oneShotApiProviderCompletion({
            config,
            systemPrompt,
            userPrompt,
            signal,
          });
        },
      });
    } catch (err) {
      // B7 失败回退：降到确定性
      const reason = err instanceof Error ? err.message : "unknown";
      console.warn(
        "[compress-context] llm-handoff failed, falling back to deterministic",
        { sessionId, reason },
      );
      const fb = compressConversationMessages(runMessages, {
        keepRecent: body.keepRecent,
      });
      return Response.json(
        {
          source: "deterministic" as const,
          summary: extractSummaryUserContent(fb.messages),
          summaryPreview: previewFromSummary(
            extractSummaryUserContent(fb.messages),
          ),
          droppedCount: fb.droppedCount,
          keepRecent: fb.keepRecent,
          compressedAt,
          fallback: { from: "llm-handoff", reason: truncateReason(reason) },
        },
        { status: 200 },
      );
    }

    return Response.json(
      {
        source: "llm-handoff" as const,
        summary: result.summary,
        summaryPreview: result.summaryPreview,
        droppedCount: result.provenance.droppedCount,
        keepRecent: body.keepRecent ?? 6,
        compressedAt,
        modelId: result.provenance.modelId,
        missingHeaders: result.missingHeaders,
      },
      { status: 200 },
    );
  }

  // ---------------- deterministic ----------------
  const det = compressConversationMessages(runMessages, {
    keepRecent: body.keepRecent,
  });
  if (!det.compressed && !body.force) {
    return Response.json(
      {
        error: "below_threshold",
        message: "当前历史尚未达到压缩阈值；如需强制压缩请传 force:true",
      },
      { status: 422 },
    );
  }
  const summary = extractSummaryUserContent(det.messages);
  return Response.json(
    {
      source: "deterministic" as const,
      summary,
      summaryPreview: previewFromSummary(summary),
      droppedCount: det.droppedCount,
      keepRecent: det.keepRecent,
      compressedAt,
    },
    { status: 200 },
  );
}

// 确定性压缩的产物里，第一条 user 消息就是摘要 user 块
function extractSummaryUserContent(
  messages: RunConversationMessage[],
): string {
  return messages[0]?.content ?? "";
}

function previewFromSummary(summary: string): string {
  const flat = summary.replace(/\s+/g, " ").trim();
  return flat.length <= 80 ? flat : `${flat.slice(0, 79)}…`;
}

function truncateReason(reason: string): string {
  return reason.length <= 200 ? reason : `${reason.slice(0, 199)}…`;
}

import type { RunConversationMessage } from "./conversation-prompt.js";
import {
  HARD_MAX_COMPOSED_PROMPT_BYTES,
  HIGH_TRANSCRIPT_CHARS_THRESHOLD,
} from "./daemon-transcript.js";
import { estimatePromptBytes } from "./compose-daemon-prompt.js";

/** 默认保留最近消息条数（含 user/assistant） */
export const DEFAULT_KEEP_RECENT_MESSAGES = 8;

/** 达到此字符量即 proactive 压缩（早于 context warning 的 200k） */
export const AUTO_COMPRESS_CHARS_THRESHOLD = 120_000;

/** 达到此条数即 proactive 压缩 */
export const AUTO_COMPRESS_MESSAGE_COUNT = 24;

const SUMMARY_BULLET_USER_CHARS = 280;
const SUMMARY_BULLET_ASSISTANT_CHARS = 520;
const MAX_SUMMARY_BLOCK_CHARS = 32_000;

function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1)}…`;
}

export function estimateTranscriptChars(
  messages: RunConversationMessage[] | undefined,
): number {
  if (!messages?.length) return 0;
  return messages.reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );
}

export type TranscriptCompressResult = {
  messages: RunConversationMessage[];
  compressed: boolean;
  /** 被摘要替代的较早消息条数 */
  droppedCount: number;
  keepRecent: number;
};

/**
 * 将较早消息压成一条「自动压缩摘要」user 块 + 保留最近 N 条原文（对齐 OD handoff 意图，确定性实现无需 BYOK）。
 */
export function compressConversationMessages(
  messages: RunConversationMessage[],
  options?: { keepRecent?: number },
): TranscriptCompressResult {
  const keepRecent = Math.max(
    2,
    options?.keepRecent ?? DEFAULT_KEEP_RECENT_MESSAGES,
  );
  if (messages.length <= keepRecent) {
    return {
      messages,
      compressed: false,
      droppedCount: 0,
      keepRecent,
    };
  }

  const prior = messages.slice(0, -keepRecent);
  const recent = messages.slice(-keepRecent);

  const bullets: string[] = [];
  for (const m of prior) {
    const label = m.role === "user" ? "用户" : "助手";
    const max =
      m.role === "user"
        ? SUMMARY_BULLET_USER_CHARS
        : SUMMARY_BULLET_ASSISTANT_CHARS;
    bullets.push(`- **${label}：** ${excerpt(m.content, max)}`);
  }

  let summaryBody = [
    "## 此前对话自动压缩摘要",
    "",
    `以下 ${prior.length} 条较早消息已自动压缩（界面历史中仍为完整原文）。请结合本摘要与下文「最近对话」继续当前任务，勿要求用户重复已说过的约束。`,
    "",
    ...bullets,
  ].join("\n");

  if (summaryBody.length > MAX_SUMMARY_BLOCK_CHARS) {
    summaryBody = `${summaryBody.slice(0, MAX_SUMMARY_BLOCK_CHARS)}\n\n…（摘要块已截断，请优先依据最近几轮原文）`;
  }

  return {
    messages: [{ role: "user", content: summaryBody }, ...recent],
    compressed: true,
    droppedCount: prior.length,
    keepRecent,
  };
}

export function shouldProactiveCompressTranscript(
  messages: RunConversationMessage[],
): boolean {
  return (
    messages.length >= AUTO_COMPRESS_MESSAGE_COUNT ||
    estimateTranscriptChars(messages) >= AUTO_COMPRESS_CHARS_THRESHOLD
  );
}

export type PrepareMessagesForRunOptions = {
  keepRecent?: number;
  /** 合成后仍超硬上限时再收紧 keepRecent */
  composedPromptBytes?: number;
};

export type PrepareMessagesForRunResult = TranscriptCompressResult & {
  note: string | null;
};

/**
 * 为单次 Run 准备消息：按需压缩，直到低于硬上限或无法再压。
 */
export function prepareMessagesForRun(
  messages: RunConversationMessage[],
  options?: PrepareMessagesForRunOptions,
): PrepareMessagesForRunResult {
  let current = messages;
  let keepRecent = options?.keepRecent ?? DEFAULT_KEEP_RECENT_MESSAGES;
  let compressed = false;
  let droppedCount = 0;
  let note: string | null = null;

  const tryCompress = (): void => {
    const r = compressConversationMessages(current, { keepRecent });
    current = r.messages;
    if (r.compressed) {
      compressed = true;
      droppedCount = r.droppedCount;
      note = `已自动压缩较早 ${r.droppedCount} 条消息（保留最近 ${r.keepRecent} 条），继续对话`;
    }
  };

  if (shouldProactiveCompressTranscript(current)) {
    tryCompress();
  }

  const hardLimit = HARD_MAX_COMPOSED_PROMPT_BYTES;
  const composedBytes = options?.composedPromptBytes;

  if (composedBytes != null && composedBytes > hardLimit && keepRecent > 4) {
    keepRecent = 4;
    current = messages;
    compressed = false;
    droppedCount = 0;
    tryCompress();
    note = `对话过长，已进一步压缩（仅保留最近 ${keepRecent} 轮）后继续`;
  }

  if (
    composedBytes != null &&
    composedBytes > hardLimit &&
    keepRecent > 2 &&
    compressed
  ) {
    keepRecent = 2;
    current = messages;
    tryCompress();
    note = `对话过长，已极限压缩后继续；若仍失败请新开对话`;
  }

  return {
    messages: current,
    compressed,
    droppedCount,
    keepRecent,
    note,
  };
}

export function exceedsHardPromptLimit(composedPrompt: string): boolean {
  return estimatePromptBytes(composedPrompt) > HARD_MAX_COMPOSED_PROMPT_BYTES;
}

/** @deprecated 使用 shouldProactiveCompressTranscript */
export function shouldAutoCompressTranscript(
  messages: RunConversationMessage[],
): boolean {
  return shouldProactiveCompressTranscript(messages);
}

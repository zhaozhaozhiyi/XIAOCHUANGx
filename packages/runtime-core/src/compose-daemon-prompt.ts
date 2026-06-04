import {
  buildAgentTranscript,
  buildPriorRunContextWarning,
  latestUserTurnFromMessages,
} from "./daemon-transcript.js";
import {
  composeRunPrompts,
  type ComposeRunPromptsOptions,
  type ComposedRunPromptsMeta,
} from "./prompt.js";

export type ComposedAgentRunPayload = {
  /** 写入 CLI stdin 的完整 prompt */
  composedPrompt: string;
  /** 本轮用户原文 */
  currentUserTurn: string;
  /** 指令栈（platform + skills + catalog） */
  instructionPrompt: string;
  /** OD 风格对话 transcript */
  transcript: string;
  meta: ComposedRunPromptsMeta;
};

export type ComposeAgentRunPayloadOptions = ComposeRunPromptsOptions & {
  agentId?: string;
  cwd?: string;
};

/**
 * 对齐 Open Design：每轮冷启动 spawn，Instructions + 全量 transcript 合并为单次 stdin。
 * 不按 agent 区分 resume；Codex / Claude / Hermes 共用同一信封结构。
 */
export function composeAgentRunPayload(
  options: ComposeAgentRunPayloadOptions,
): ComposedAgentRunPayload {
  const { systemPrompt, userPrompt, meta } = composeRunPrompts(options);
  const instructionPrompt = systemPrompt.trim();
  const contextWarning = buildPriorRunContextWarning(options.messages);
  const transcript = buildAgentTranscript(options.messages, {
    agentId: options.agentId,
    contextWarning,
  });
  const currentUserTurn =
    latestUserTurnFromMessages(options.messages) ||
    options.userText.trim() ||
    userPrompt.trim();

  const cwdHint =
    options.cwd?.trim() ? `\n\n工作区根目录（cwd）：\`${options.cwd.trim()}\`` : "";

  const blocks: string[] = [];
  if (instructionPrompt) {
    blocks.push(
      `# Instructions (read first)\n\n${instructionPrompt}${cwdHint}`,
    );
  }
  blocks.push("", "---", "");

  if (transcript.trim()) {
    blocks.push(
      "# User request",
      "",
      "## Full conversation transcript",
      "",
      transcript.trim(),
      "",
      "---",
      "",
      "## Current user message",
      "",
      currentUserTurn || "(empty)",
    );
  } else {
    blocks.push(
      "# User request",
      "",
      currentUserTurn || userPrompt.trim() || "(empty)",
    );
  }

  const composedPrompt = blocks.join("\n").trim();

  return {
    composedPrompt,
    currentUserTurn,
    instructionPrompt,
    transcript,
    meta,
  };
}

/** 估算 argv 占用（Windows ~32KB）；供仍使用 argv 的 CLI 适配器做预算检查 */
export function estimatePromptBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

export const DEFAULT_ARGV_PROMPT_BUDGET_BYTES = 28_000;

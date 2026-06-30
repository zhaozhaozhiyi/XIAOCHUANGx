import type { AgentKitStageResult } from "./agent-kit.js";
import { formatAgentKitSection } from "./agent-kit.js";
import {
  formatConversationUserPrompt,
  hasMultiTurnContext,
  type RunConversationMessage,
} from "./conversation-prompt.js";
import { loadPlatformPrompts } from "./prompt-loader.js";
import { resolvePromptsRoot, resolveSkillsRoot } from "./paths.js";
import {
  formatSkillBodyForPrompt,
  loadSkillBundle,
} from "./skill-loader.js";
import {
  formatChatCatalogForPrompt,
  type LoadedChatCatalog,
} from "./chat-catalog.js";
import type { ChatModeId } from "./types.js";

export type { RunConversationMessage } from "./conversation-prompt.js";

export type ComposeRunPromptsOptions = {
  mode: ChatModeId;
  /** 兼容：仅最后一条用户消息；有 messages 时以 messages 为准 */
  userText: string;
  /** 同一会话完整历史（user/assistant），供 Codex/Claude CLI 多轮理解 */
  messages?: RunConversationMessage[];
  processSkill?: string | null;
  platformNormSkill?: string;
  skillsRoot?: string;
  promptsRoot?: string;
  agentKit?: AgentKitStageResult | null;
  /** 对话混合编排：仅注入 Catalog 摘要（F-RT-008） */
  chatCatalog?: LoadedChatCatalog | null;
  /** 模块绑定、模板偏好等附加上下文 */
  contextNotes?: string[];
};

export type ComposedRunPromptsMeta = {
  skillsRoot: string;
  promptsRoot: string;
  agentKitPath: string | null;
  injectedSlugs: string[];
  missingSlugs: string[];
  platformFiles: string[];
  missingPlatformFiles: string[];
  catalogVersion?: string;
  catalogSlugs?: string[];
  orchestrationMode?: string;
};

export type ComposedRunPrompts = {
  systemPrompt: string;
  userPrompt: string;
  meta: ComposedRunPromptsMeta;
};

export function composeSystemPrompt(
  options: ComposeRunPromptsOptions,
): { systemPrompt: string; meta: ComposedRunPromptsMeta } {
  const { systemPrompt, meta } = composeRunPrompts(options);
  return { systemPrompt, meta };
}

export function userTurn(userText: string): string {
  return userText.trim();
}

export function composeRunPrompts(
  options: ComposeRunPromptsOptions,
): ComposedRunPrompts {
  const skillsRoot = options.skillsRoot ?? resolveSkillsRoot();
  const promptsRoot = options.promptsRoot ?? resolvePromptsRoot();
  const bundle = loadSkillBundle({
    skillsRoot,
    platformNormSkill: options.platformNormSkill ?? null,
    processSkill: options.processSkill ?? null,
  });

  const platform = loadPlatformPrompts(promptsRoot);
  const parts: string[] = [];
  const injectedSlugs: string[] = [];

  if (platform.body) {
    parts.push("## 平台 Prompt", platform.body);
  } else if (platform.missing.length > 0) {
    parts.push(
      `【平台 Prompt】部分文件缺失：${platform.missing.join(", ")}（目录：${promptsRoot}/platform）`,
    );
  }

  parts.push(
    "",
    `当前问答策略（binding.mode）：**${options.mode}**`,
    options.mode === "auto"
      ? "默认由基座 QA Skill 根据问题复杂度与用户表达自行选择轻量回答或深度研究路径；不要要求用户选择模式。"
      : "这是兼容旧会话或调试入口的显式策略。主产品路径默认使用 auto。",
  );

  if (options.contextNotes && options.contextNotes.length > 0) {
    parts.push(
      "",
      "## 当前模块上下文",
      ...options.contextNotes.map((note) => `- ${note}`),
    );
  }

  parts.push(
    "",
    "## 对话进度（Web UI）",
    "多步骤任务在调用工具前，先用 1–2 句中文说明即将做什么（用户可见进度），再执行工具。",
    "每一步工具完成后，可简要说明发现了什么，再进入下一步；最终给出完整结论。",
  );

  if (bundle.platformNorm) {
    parts.push("", "## 平台规范（横切 Skill）", formatSkillBodyForPrompt(bundle.platformNorm));
    injectedSlugs.push(bundle.platformNorm.slug);
  } else if (options.platformNormSkill) {
    parts.push(
      "",
      `【平台规范】Skill 未找到：${options.platformNormSkill}`,
    );
  }

  if (bundle.process) {
    parts.push("", "## 流程 Skill", formatSkillBodyForPrompt(bundle.process));
    injectedSlugs.push(bundle.process.slug);
  } else if (options.processSkill) {
    parts.push("", `【流程 Skill】未找到：${options.processSkill}`);
  }

  if (options.agentKit) {
    parts.push("", formatAgentKitSection(options.agentKit));
  }

  if (options.chatCatalog) {
    parts.push("", formatChatCatalogForPrompt(options.chatCatalog));
  }

  if (hasMultiTurnContext(options.messages)) {
    parts.push(
      "",
      "## 多轮会话",
      "当前为同一会话中的后续轮次。用户消息可能引用上文中的编号选项（如「1」「2」）、确认语或「继续」；务必结合下方对话历史理解当前用户消息，勿将孤立数字或短语当作无上下文的新问题。",
    );
  }

  const systemPrompt = parts.join("\n").trim();
  const userPrompt =
    options.messages && options.messages.length > 0
      ? formatConversationUserPrompt(options.messages)
      : userTurn(options.userText);

  return {
    systemPrompt,
    userPrompt,
    meta: {
      skillsRoot,
      promptsRoot,
      agentKitPath: options.agentKit?.agentKitPath ?? null,
      injectedSlugs,
      missingSlugs: bundle.missing,
      platformFiles: platform.files,
      missingPlatformFiles: platform.missing,
      catalogVersion: options.chatCatalog?.version,
      catalogSlugs: options.chatCatalog?.entries.map((e) => e.slug),
      orchestrationMode: options.chatCatalog
        ? "hybrid-steer"
        : undefined,
    },
  };
}

/** @deprecated 使用 composeRunPrompts / composeSystemPrompt + userTurn */
export type ComposePromptOptions = ComposeRunPromptsOptions;

/** @deprecated */
export type ComposedPromptMeta = ComposedRunPromptsMeta;

/** @deprecated */
export type ComposedPrompt = {
  prompt: string;
  meta: ComposedRunPromptsMeta;
};

export function composePrompt(options: ComposeRunPromptsOptions): string {
  const r = composeRunPrompts(options);
  return `${r.systemPrompt}\n\n---\n\n## 用户问题\n\n${r.userPrompt}`;
}

export function composePromptWithMeta(
  options: ComposeRunPromptsOptions,
): ComposedPrompt {
  const r = composeRunPrompts(options);
  return {
    prompt: `${r.systemPrompt}\n\n---\n\n## 用户问题\n\n${r.userPrompt}`,
    meta: r.meta,
  };
}

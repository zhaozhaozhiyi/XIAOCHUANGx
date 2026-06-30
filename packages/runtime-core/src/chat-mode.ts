export type ChatModeId = "auto" | "fast" | "deep";

/** @deprecated API 兼容；映射为 `deep` */
export type LegacyChatModeId = ChatModeId | "research";

/** 将请求中的 mode 规范为自动策略；旧 `research` 等价 `deep`。 */
export function normalizeChatMode(mode: string): ChatModeId | null {
  if (mode === "research") return "deep";
  if (mode === "auto" || mode === "fast" || mode === "deep") return mode;
  return null;
}

/** Mock / Activity：复杂问题走完整研究节奏（由 Agent 决策的演示启发式） */
export function isComplexDeepQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length > 80) return true;
  return /研究|报告|多信源|对比|归纳|政策|行业|研报|公告/.test(t);
}

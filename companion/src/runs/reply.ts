import { isComplexDeepQuestion, type ChatModeId } from "@jlc/runtime-core";
import { AGENT_REGISTRY, type AgentId } from "@jlc/runtime-core";

const AGENT_LABELS: Record<AgentId, string> = Object.fromEntries(
  Object.entries(AGENT_REGISTRY).map(([id, entry]) => [
    id,
    entry.execution.displayName.replace(/\s+CLI$/, ""),
  ]),
) as Record<AgentId, string>;

/** 无 CLI 或 simulate 模式下的演示回复（与 web mock 语义对齐） */
export function buildSimulatedReply(
  userText: string,
  mode: ChatModeId,
  agentId: AgentId,
): string {
  const q = userText.toLowerCase();
  const tag = `【${AGENT_LABELS[agentId]} · 本机 CLI`;

  if (q.includes("库存") && q.includes("螺纹")) {
    return `${tag}】\n\n据数据源 数据，上周螺纹钢社会库存环比下降 2.3%。库存较近三年同期偏低。\n\n来源：数据源 · 螺纹钢社会库存`;
  }
  if (q.includes("原油") || q.includes("多空")) {
    return `${tag}】\n\n已汇总 3 类信源观点（演示）。综合判断：短期震荡。`;
  }
  if (q.includes("大纲") || q.includes("周报")) {
    return `${tag}】\n\n已生成螺纹钢周报大纲（演示）：\n1. 价格与基差\n2. 供给\n3. 需求\n4. 库存\n5. 展望`;
  }

  const modeNote =
    mode === "deep"
      ? isComplexDeepQuestion(userText)
        ? "【深度 · 完整研究】将展示研究导图与可导出摘要（演示）。"
        : "【深度 · 分步推理】如下（演示）："
      : "";

  return `${tag}】\n\n${modeNote}\n\n已收到：「${userText.slice(0, 200)}」\n\n（Companion simulate：接入真实 CLI spawn 后，此处为 ${AGENT_LABELS[agentId]} 进程输出。）`;
}

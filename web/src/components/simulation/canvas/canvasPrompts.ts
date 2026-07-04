import type { SimulationNode } from "@/lib/chat-parts";
import type { EdgeInsertRequest, NormalizedScenario } from "./canvasTypes";
import { nodeKindLabel } from "./canvasHelpers";

export function findCanvasSourceNode(
  nodeId: string,
  normalized: NormalizedScenario,
): SimulationNode | null {
  if (normalized.prompt?.id === nodeId) return normalized.prompt;
  if (normalized.topic.id === nodeId) return normalized.topic;
  return normalized.nodes.find((node) => node.id === nodeId) ?? null;
}

export function buildEdgeInsertPrompt(request: EdgeInsertRequest): string {
  return [
    "请在当前推演画布的这条边上插入一个中间节点，并只重算这条边之后的下游结构。",
    "",
    `Edge ID：${request.edgeId}`,
    `Source：${request.sourceLabel} (${request.sourceId})`,
    `Target：${request.targetLabel} (${request.targetId})`,
    request.edgeLabel ? `当前关系：${request.edgeLabel}` : "",
    `插入节点类型：${nodeKindLabel(request.insertType)}`,
    "",
    "要求：",
    "1. 保留 Source、Target 和已有上游节点，不要让起始问题节点消失。",
    "2. 生成新的中间节点、必要的边、影响预览和需要用户确认的下一步。",
    "3. 如果该插入会改变变量、假设、风险、结论或 Scenario，请标注变化范围。",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildManualConnectionPrompt({
  sourceLabel,
  targetLabel,
  sourceId,
  targetId,
}: {
  sourceLabel: string;
  targetLabel: string;
  sourceId: string;
  targetId: string;
}): string {
  return [
    "用户在画布上手动连接了两个节点，请判断这条关系是否成立，并生成可追溯的结构化边。",
    "",
    `Source：${sourceLabel} (${sourceId})`,
    `Target：${targetLabel} (${targetId})`,
    "",
    "请输出：关系类型、因果/证据/时间逻辑、需要补充的 Evidence，以及这条连接会影响哪些下游节点和 Scenario。",
  ].join("\n");
}

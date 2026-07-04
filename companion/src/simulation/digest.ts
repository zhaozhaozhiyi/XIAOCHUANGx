import type {
  CanvasSnapshot,
  SimulationNode,
  SimulationStageId,
} from "@jlc/contracts";

// F5a: Canvas Digest —— 把当前画布快照压缩成给 AI 的结构化工作记忆。
// 参见《推演画布自然语言干预设计讨论稿》§4.2。
// 关键约束：
// - Digest 是 AI 的隐藏上下文（进 contextNotes / 系统提示），不是给用户看的回答。
// - 快照是事实源，Digest 只是压缩后的决策视图。
// - 面向"AI 判断这句话落在世界模型哪个层级"的决策，而非完整 JSON。

const STAGE_LABELS: Record<SimulationStageId, string> = {
  question: "问题定义",
  entity: "主体建模",
  hypothesis: "假设构建",
  variable: "变量识别",
  risk: "风险与事件",
  reasoning: "推理与证据",
  scenario: "情景与路径",
  output: "结论与输出",
};

const NODE_INDEX_LIMIT = 24;
const EDGE_INDEX_LIMIT = 16;
const DEPENDENCY_INDEX_LIMIT = 16;

function nodeLabel(node: SimulationNode): string {
  return node.label?.trim() || node.id;
}

function nodeRef(node: SimulationNode): string {
  const status = node.status ? `/${node.status}` : "";
  return `${node.id}=${nodeLabel(node)}[${node.type}${status}]`;
}

function collectByType(
  nodes: SimulationNode[],
  type: SimulationNode["type"],
): SimulationNode[] {
  return nodes.filter((node) => node.type === type);
}

function labelList(nodes: SimulationNode[], limit = 8): string {
  const labels = nodes.map(nodeLabel);
  if (labels.length <= limit) return labels.join("、");
  return `${labels.slice(0, limit).join("、")} 等 ${labels.length} 项`;
}

function nodeIndexLine(nodes: SimulationNode[]): string | undefined {
  if (nodes.length === 0) return undefined;
  const refs = nodes.slice(0, NODE_INDEX_LIMIT).map(nodeRef);
  const suffix =
    nodes.length > NODE_INDEX_LIMIT
      ? `；其余 ${nodes.length - NODE_INDEX_LIMIT} 个省略`
      : "";
  return `节点索引：${refs.join("；")}${suffix}`;
}

function edgeIndexLine(snapshot: CanvasSnapshot): string | undefined {
  const edges = snapshot.edges ?? [];
  if (edges.length === 0) return undefined;
  const refs = edges.slice(0, EDGE_INDEX_LIMIT).map((edge) => {
    const relation = edge.label ? `「${edge.label}」` : edge.type;
    return `${edge.id}:${edge.source}->${edge.target}(${relation})`;
  });
  const suffix =
    edges.length > EDGE_INDEX_LIMIT
      ? `；其余 ${edges.length - EDGE_INDEX_LIMIT} 条省略`
      : "";
  return `关系索引：${refs.join("；")}${suffix}`;
}

function pathIndexLine(snapshot: CanvasSnapshot): string | undefined {
  const paths = snapshot.paths ?? [];
  if (paths.length === 0) return undefined;
  const refs = paths
    .slice(0, 8)
    .map((path) => `${path.id}=${path.label?.trim() || path.id}`);
  const suffix = paths.length > 8 ? `；其余 ${paths.length - 8} 条省略` : "";
  return `路径索引：${refs.join("；")}${suffix}`;
}

function dependencyIndexLine(nodes: SimulationNode[]): string | undefined {
  const refs: string[] = [];
  for (const node of nodes) {
    const upstream = node.data?.upstreamNodeIds;
    if (!Array.isArray(upstream)) continue;
    const upstreamIds = upstream.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );
    if (upstreamIds.length === 0) continue;
    refs.push(`${node.id}<-${upstreamIds.slice(0, 5).join(",")}`);
    if (refs.length >= DEPENDENCY_INDEX_LIMIT) break;
  }
  return refs.length ? `声明依赖：${refs.join("；")}` : undefined;
}

// 争议点：active 的 inference/risk 节点，或标注了 uncertainty 的节点。
function contentionLines(nodes: SimulationNode[]): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    const uncertainty = node.data?.uncertainty;
    if (Array.isArray(uncertainty) && uncertainty.length > 0) {
      const items = uncertainty
        .filter((item): item is string => typeof item === "string")
        .slice(0, 2);
      if (items.length) lines.push(`${nodeLabel(node)}：${items.join("；")}`);
    }
  }
  return lines.slice(0, 4);
}

function focusLine(snapshot: CanvasSnapshot): string | undefined {
  // 优先用最近一次干预/选择/动作定位当前焦点。
  const intervention = snapshot.interventions?.at(-1);
  if (intervention?.sourceNodeId) {
    const node = snapshot.nodes.find((n) => n.id === intervention.sourceNodeId);
    if (node) return nodeRef(node);
  }
  const selection = snapshot.selections?.at(-1);
  if (selection?.targetId) {
    const node = snapshot.nodes.find((n) => n.id === selection.targetId);
    if (node) return nodeRef(node);
  }
  return undefined;
}

function recentActionLine(snapshot: CanvasSnapshot): string | undefined {
  const action = snapshot.actions?.at(-1);
  if (action?.type) return action.type;
  const selection = snapshot.selections?.at(-1);
  if (selection?.type) return `选择了${selection.type}`;
  return undefined;
}

export type CanvasDigestInput = {
  snapshot: CanvasSnapshot | null | undefined;
  topic?: string;
};

// 生成 Digest 文本；无快照或空图时返回 null（首轮建模无需 digest）。
export function buildCanvasDigest(input: CanvasDigestInput): string | null {
  const snapshot = input.snapshot;
  if (!snapshot) return null;
  const nodes = snapshot.nodes ?? [];
  if (nodes.length === 0) return null;

  const topicNode =
    nodes.find((n) => n.id === snapshot.topicNodeId) ??
    nodes.find((n) => n.type === "topic");
  const topicText =
    topicNode?.label?.trim() || input.topic?.trim() || "未命名推演";

  const entities = collectByType(nodes, "entity");
  const variables = collectByType(nodes, "variable");
  const hypotheses = collectByType(nodes, "hypothesis");
  const risks = collectByType(nodes, "risk");
  const conclusions = collectByType(nodes, "conclusion");

  const lines: string[] = [];
  lines.push(`当前问题：${topicText}`);

  const stage = snapshot.stageState?.current;
  if (stage && STAGE_LABELS[stage]) {
    lines.push(`当前阶段：${STAGE_LABELS[stage]}`);
  }

  if (entities.length) lines.push(`核心主体：${labelList(entities)}`);
  if (variables.length) lines.push(`关键变量：${labelList(variables)}`);
  if (hypotheses.length) lines.push(`主要假设：${labelList(hypotheses)}`);

  if (snapshot.paths?.length) {
    const pathLabels = snapshot.paths
      .map((path) => path.label?.trim() || path.id)
      .slice(0, 6);
    lines.push(`当前路径：${pathLabels.join("、")}`);
  }

  if (risks.length) lines.push(`风险/事件：${labelList(risks)}`);
  if (conclusions.length) lines.push(`阶段结论：${labelList(conclusions)}`);

  const contentions = contentionLines(nodes);
  if (contentions.length) lines.push(`争议点：${contentions.join("；")}`);

  const focus = focusLine(snapshot);
  if (focus) lines.push(`当前焦点：${focus}`);

  const recent = recentActionLine(snapshot);
  if (recent) lines.push(`最近操作：${recent}`);

  const nodeIndex = nodeIndexLine(nodes);
  if (nodeIndex) lines.push(nodeIndex);

  const dependencyIndex = dependencyIndexLine(nodes);
  if (dependencyIndex) lines.push(dependencyIndex);

  const edgeIndex = edgeIndexLine(snapshot);
  if (edgeIndex) lines.push(edgeIndex);

  const pathIndex = pathIndexLine(snapshot);
  if (pathIndex) lines.push(pathIndex);

  lines.push(
    `画布规模：${nodes.length} 个节点、${(snapshot.edges ?? []).length} 条边、${(snapshot.paths ?? []).length} 条路径。`,
  );

  return lines.join("\n");
}

import {
  checkNodeTransition,
  isAllowedEdgeType,
  type CanvasSnapshot,
  type SimulationEdge,
  type SimulationNode,
} from "@jlc/contracts";

// F4: 世界模型图的转换语法运行时校验。
// AI 偶发的非法边（反向因果、类型短路、非法边类型）此前静默入图且永不清除。
// 这里在快照落盘前对合并后的图做一次校验，产出违规清单——
// 不删除边（删除会破坏引用它的 path，并与 preserving-upstream 冲突），
// 而是以警告形式暴露，供运行时 log/telemetry 与后续执行器消费。

export type GrammarViolation = {
  edgeId: string;
  source: string;
  target: string;
  kind:
    | "disallowed_shortcut" // 命中明确禁止的短路（硬违规）
    | "unlisted_transition" // 未在语法白名单（软警告）
    | "invalid_edge_type" // 边 type 不在 causal/temporal/evidence_support
    | "dangling_endpoint"; // source/target 指向不存在的节点
  message: string;
};

function nodeTypeById(
  nodes: SimulationNode[],
): Map<string, SimulationNode["type"]> {
  const map = new Map<string, SimulationNode["type"]>();
  for (const node of nodes) map.set(node.id, node.type);
  return map;
}

export function findGrammarViolations(input: {
  nodes: SimulationNode[];
  edges: SimulationEdge[];
}): GrammarViolation[] {
  const typeById = nodeTypeById(input.nodes);
  const violations: GrammarViolation[] = [];

  for (const edge of input.edges) {
    const base = { edgeId: edge.id, source: edge.source, target: edge.target };

    if (!isAllowedEdgeType(edge.type)) {
      violations.push({
        ...base,
        kind: "invalid_edge_type",
        message: `边类型非法：${String(edge.type)}（应为 causal/temporal/evidence_support）。`,
      });
      // 边类型非法时不再判转换，避免重复噪音。
      continue;
    }

    const sourceType = typeById.get(edge.source);
    const targetType = typeById.get(edge.target);
    if (!sourceType || !targetType) {
      violations.push({
        ...base,
        kind: "dangling_endpoint",
        message: `边端点缺失节点：${!sourceType ? edge.source : edge.target}。`,
      });
      continue;
    }

    const verdict = checkNodeTransition(sourceType, targetType);
    if (verdict.ok) continue;
    violations.push({
      ...base,
      kind:
        verdict.reason === "disallowed_shortcut"
          ? "disallowed_shortcut"
          : "unlisted_transition",
      message: verdict.message ?? `不合法的转换：${sourceType} → ${targetType}。`,
    });
  }

  return violations;
}

export function summarizeGrammarViolations(
  violations: GrammarViolation[],
): string {
  if (violations.length === 0) return "";
  const hard = violations.filter((v) => v.kind === "disallowed_shortcut").length;
  const other = violations.length - hard;
  const head = `世界模型图存在 ${violations.length} 处语法问题${
    hard ? `（含 ${hard} 处禁止短路）` : ""
  }${other && hard ? "" : ""}：`;
  const lines = violations
    .slice(0, 8)
    .map((v) => `- [${v.kind}] ${v.source}→${v.target}：${v.message}`);
  const more =
    violations.length > 8 ? [`- 其余 ${violations.length - 8} 处省略。`] : [];
  return [head, ...lines, ...more].join("\n");
}

export function findSnapshotGrammarViolations(
  snapshot: Pick<CanvasSnapshot, "nodes" | "edges">,
): GrammarViolation[] {
  return findGrammarViolations({ nodes: snapshot.nodes, edges: snapshot.edges });
}

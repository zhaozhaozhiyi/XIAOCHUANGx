import { CANVAS_NODE_TOP, PROMPT_COLUMN_X } from "./canvasConstants";
import type { CanvasPosition } from "./canvasTypes";

export type DependencyLayoutNode = {
  id: string;
  kind: string;
  width: number;
  height: number;
  order: number;
  minRank?: number;
};

export type DependencyLayoutEdge = {
  source: string;
  target: string;
};

const DEFAULT_COLUMN_GAP = 190;
const DEFAULT_ROW_GAP = 58;

const KIND_MIN_RANK: Record<string, number> = {
  prompt: 0,
  topic: 1,
  entity: 2,
  hypothesis: 3,
  variable: 3,
  evidence: 4,
  event: 4,
  inference: 5,
  risk: 6,
  decision: 7,
  action: 7,
  conclusion: 8,
  scenario: 9,
  path: 10,
  history: 11,
  summary: 11,
  report: 12,
  suggestion: 12,
  next_action: 12,
  recovery: 12,
};

function minRankFor(node: DependencyLayoutNode): number {
  return node.minRank ?? KIND_MIN_RANK[node.kind] ?? 4;
}

function dedupeEdges(
  edges: DependencyLayoutEdge[],
  nodeIds: Set<string>,
): DependencyLayoutEdge[] {
  const seen = new Set<string>();
  const result: DependencyLayoutEdge[] = [];
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    const key = `${edge.source}->${edge.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(edge);
  }
  return result;
}

function findStronglyConnectedComponents(
  nodes: DependencyLayoutNode[],
  edges: DependencyLayoutEdge[],
): Map<string, number> {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexById = new Map<string, number>();
  const lowlinkById = new Map<string, number>();
  const componentById = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const node of nodes) outgoing.set(node.id, []);
  for (const edge of edges) {
    outgoing.get(edge.source)?.push(edge.target);
  }

  const visit = (nodeId: string) => {
    indexById.set(nodeId, index);
    lowlinkById.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const targetId of outgoing.get(nodeId) ?? []) {
      if (!indexById.has(targetId)) {
        visit(targetId);
        lowlinkById.set(
          nodeId,
          Math.min(lowlinkById.get(nodeId) ?? 0, lowlinkById.get(targetId) ?? 0),
        );
      } else if (onStack.has(targetId)) {
        lowlinkById.set(
          nodeId,
          Math.min(lowlinkById.get(nodeId) ?? 0, indexById.get(targetId) ?? 0),
        );
      }
    }

    if (lowlinkById.get(nodeId) !== indexById.get(nodeId)) return;

    const componentId = componentById.size;
    while (stack.length > 0) {
      const currentId = stack.pop()!;
      onStack.delete(currentId);
      componentById.set(currentId, componentId);
      if (currentId === nodeId) break;
    }
  };

  for (const node of nodes) {
    if (!indexById.has(node.id)) visit(node.id);
  }

  return componentById;
}

function computeRanks(
  nodes: DependencyLayoutNode[],
  edges: DependencyLayoutEdge[],
): Map<string, number> {
  const componentById = findStronglyConnectedComponents(nodes, edges);
  const componentMinRank = new Map<number, number>();
  const componentOrder = new Map<number, number>();

  for (const node of nodes) {
    const componentId = componentById.get(node.id) ?? 0;
    componentMinRank.set(
      componentId,
      Math.max(componentMinRank.get(componentId) ?? 0, minRankFor(node)),
    );
    componentOrder.set(
      componentId,
      Math.min(componentOrder.get(componentId) ?? node.order, node.order),
    );
  }

  const componentEdges = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();
  for (const componentId of componentMinRank.keys()) {
    componentEdges.set(componentId, new Set());
    indegree.set(componentId, 0);
  }
  for (const edge of edges) {
    const sourceComponent = componentById.get(edge.source);
    const targetComponent = componentById.get(edge.target);
    if (
      sourceComponent == null ||
      targetComponent == null ||
      sourceComponent === targetComponent
    ) {
      continue;
    }
    const targets = componentEdges.get(sourceComponent);
    if (!targets || targets.has(targetComponent)) continue;
    targets.add(targetComponent);
    indegree.set(targetComponent, (indegree.get(targetComponent) ?? 0) + 1);
  }

  const componentRank = new Map(componentMinRank);
  const queue = Array.from(componentMinRank.keys())
    .filter((componentId) => (indegree.get(componentId) ?? 0) === 0)
    .sort((left, right) => {
      const rankDelta =
        (componentMinRank.get(left) ?? 0) - (componentMinRank.get(right) ?? 0);
      if (rankDelta !== 0) return rankDelta;
      return (componentOrder.get(left) ?? 0) - (componentOrder.get(right) ?? 0);
    });

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const componentId = queue[cursor]!;
    const nextRank = (componentRank.get(componentId) ?? 0) + 1;
    for (const targetComponent of componentEdges.get(componentId) ?? []) {
      componentRank.set(
        targetComponent,
        Math.max(
          componentRank.get(targetComponent) ?? 0,
          componentMinRank.get(targetComponent) ?? 0,
          nextRank,
        ),
      );
      indegree.set(targetComponent, (indegree.get(targetComponent) ?? 0) - 1);
      if ((indegree.get(targetComponent) ?? 0) === 0) {
        queue.push(targetComponent);
      }
    }
  }

  const rankById = new Map<string, number>();
  for (const node of nodes) {
    const componentId = componentById.get(node.id) ?? 0;
    rankById.set(
      node.id,
      Math.max(minRankFor(node), componentRank.get(componentId) ?? 0),
    );
  }
  return rankById;
}

function averageNeighborOrder(
  nodeId: string,
  neighborsById: Map<string, string[]>,
  orderById: Map<string, number>,
): number | null {
  const neighbors = neighborsById.get(nodeId) ?? [];
  const orders = neighbors
    .map((neighborId) => orderById.get(neighborId))
    .filter((value): value is number => typeof value === "number");
  if (orders.length === 0) return null;
  return orders.reduce((sum, value) => sum + value, 0) / orders.length;
}

export function computeDependencyLayout(input: {
  nodes: DependencyLayoutNode[];
  edges: DependencyLayoutEdge[];
  left?: number;
  top?: number;
  columnGap?: number;
  rowGap?: number;
}): Map<string, CanvasPosition> {
  const nodes = input.nodes;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeIds = new Set(nodeById.keys());
  const edges = dedupeEdges(input.edges, nodeIds);
  const rankById = computeRanks(nodes, edges);
  const incomingById = new Map<string, string[]>();
  const outgoingById = new Map<string, string[]>();

  for (const node of nodes) {
    incomingById.set(node.id, []);
    outgoingById.set(node.id, []);
  }
  for (const edge of edges) {
    incomingById.get(edge.target)?.push(edge.source);
    outgoingById.get(edge.source)?.push(edge.target);
  }

  const nodesByRank = new Map<number, DependencyLayoutNode[]>();
  for (const node of nodes) {
    const rank = rankById.get(node.id) ?? minRankFor(node);
    const bucket = nodesByRank.get(rank) ?? [];
    bucket.push(node);
    nodesByRank.set(rank, bucket);
  }

  const ranks = Array.from(nodesByRank.keys()).sort((left, right) => left - right);
  const orderById = new Map<string, number>();
  const updateOrder = () => {
    for (const rank of ranks) {
      (nodesByRank.get(rank) ?? []).forEach((node, index) => {
        orderById.set(node.id, index);
      });
    }
  };

  for (const rank of ranks) {
    nodesByRank.get(rank)?.sort((left, right) => {
      const minRankDelta = minRankFor(left) - minRankFor(right);
      if (minRankDelta !== 0) return minRankDelta;
      return left.order - right.order;
    });
  }
  updateOrder();

  for (let pass = 0; pass < 4; pass += 1) {
    for (const rank of ranks) {
      nodesByRank.get(rank)?.sort((left, right) => {
        const leftBarycenter = averageNeighborOrder(left.id, incomingById, orderById);
        const rightBarycenter = averageNeighborOrder(right.id, incomingById, orderById);
        if (leftBarycenter != null || rightBarycenter != null) {
          return (leftBarycenter ?? left.order) - (rightBarycenter ?? right.order);
        }
        return left.order - right.order;
      });
      updateOrder();
    }
    for (const rank of [...ranks].reverse()) {
      nodesByRank.get(rank)?.sort((left, right) => {
        const leftBarycenter = averageNeighborOrder(left.id, outgoingById, orderById);
        const rightBarycenter = averageNeighborOrder(right.id, outgoingById, orderById);
        if (leftBarycenter != null || rightBarycenter != null) {
          return (leftBarycenter ?? left.order) - (rightBarycenter ?? right.order);
        }
        return left.order - right.order;
      });
      updateOrder();
    }
  }

  const rankX = new Map<number, number>();
  let xCursor = input.left ?? PROMPT_COLUMN_X;
  for (const rank of ranks) {
    rankX.set(rank, xCursor);
    const maxWidth = Math.max(
      ...((nodesByRank.get(rank) ?? []).map((node) => node.width)),
      300,
    );
    xCursor += maxWidth + (input.columnGap ?? DEFAULT_COLUMN_GAP);
  }

  const positions = new Map<string, CanvasPosition>();
  const rowGap = input.rowGap ?? DEFAULT_ROW_GAP;
  const top = input.top ?? CANVAS_NODE_TOP;

  for (const rank of ranks) {
    const rankNodes = nodesByRank.get(rank) ?? [];
    const x = rankX.get(rank) ?? PROMPT_COLUMN_X;
    const desiredTops = new Map<string, number>();

    for (const node of rankNodes) {
      const upstreamCenters = (incomingById.get(node.id) ?? [])
        .map((sourceId) => {
          const source = nodeById.get(sourceId);
          const sourcePosition = positions.get(sourceId);
          if (!source || !sourcePosition) return null;
          return sourcePosition.y + source.height / 2;
        })
        .filter((value): value is number => typeof value === "number");
      const desiredCenter =
        upstreamCenters.length > 0
          ? upstreamCenters.reduce((sum, value) => sum + value, 0) /
            upstreamCenters.length
          : top + (orderById.get(node.id) ?? 0) * (node.height + rowGap) + node.height / 2;
      desiredTops.set(node.id, Math.max(top, desiredCenter - node.height / 2));
    }

    rankNodes.sort((left, right) => {
      const topDelta =
        (desiredTops.get(left.id) ?? top) - (desiredTops.get(right.id) ?? top);
      if (Math.abs(topDelta) > 1) return topDelta;
      return (orderById.get(left.id) ?? left.order) - (orderById.get(right.id) ?? right.order);
    });

    let yCursor = top;
    for (const node of rankNodes) {
      const y = Math.max(yCursor, desiredTops.get(node.id) ?? top);
      positions.set(node.id, { x, y: Math.round(y) });
      yCursor = y + node.height + rowGap;
    }
  }

  return positions;
}

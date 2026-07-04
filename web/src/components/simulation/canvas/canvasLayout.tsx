"use client";

import { useEffect, useRef } from "react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { ALIGNMENT_THRESHOLD } from "./canvasConstants";
import type { AlignmentGuideState, CanvasFlowEdge, CanvasFlowNode, ManualNodePositions, NormalizedScenario } from "./canvasTypes";
import { isSimulationNode, nodeConfigRows, nodeMetricBadges, nodeSummary, topicAnalysisSteps } from "./canvasHelpers";

export function canvasNodeSize(node: CanvasFlowNode): { width: number; height: number } {
  if (node.data.kind === "topic" && node.data.topicDefinitionPhase) {
    const phase = node.data.topicDefinitionPhase;
    if (phase === "form") {
      const questionCount = node.data.entryRequirementsPart?.questions.length ?? 7;
      return {
        width: 920,
        height: Math.max(680, 180 + questionCount * 92),
      };
    }
    if (phase === "analyzing") {
      const steps =
        node.data.source && isSimulationNode(node.data.source)
          ? topicAnalysisSteps(node.data.source)
          : [];
      return {
        width: 520,
        height: Math.max(
          220,
          96 + Math.max(steps.length, 1) * 28,
        ),
      };
    }
    const rows = nodeConfigRows(node.data).length;
    return {
      width: 420,
      height: Math.max(220, 132 + rows * 24),
    };
  }
  const wide = node.data.kind === "prompt" || node.data.kind === "topic";
  const width = wide ? 360 : 300;
  const summary = nodeSummary(node.data);
  const rows =
    node.data.kind === "prompt" ? 2 : nodeConfigRows(node.data).length;
  const badges = nodeMetricBadges(node.data).length;
  const estimatedHeight =
    (wide ? 92 : 80) +
    (summary ? 32 : 0) +
    rows * 24 +
    (badges ? 24 : 0);
  return {
    width,
    height: Math.max(
      wide ? (node.data.kind === "prompt" ? 108 : 132) : 118,
      estimatedHeight,
    ),
  };
}

export function computeAlignmentGuides(
  draggedNode: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): AlignmentGuideState | null {
  const draggedSize = canvasNodeSize(draggedNode);
  const dragged = {
    left: draggedNode.position.x,
    right: draggedNode.position.x + draggedSize.width,
    centerX: draggedNode.position.x + draggedSize.width / 2,
    top: draggedNode.position.y,
    bottom: draggedNode.position.y + draggedSize.height,
    centerY: draggedNode.position.y + draggedSize.height / 2,
  };
  let horizontal: AlignmentGuideState["horizontal"];
  let vertical: AlignmentGuideState["vertical"];

  for (const node of nodes) {
    if (node.id === draggedNode.id) continue;
    const size = canvasNodeSize(node);
    const bounds = {
      left: node.position.x,
      right: node.position.x + size.width,
      centerX: node.position.x + size.width / 2,
      top: node.position.y,
      bottom: node.position.y + size.height,
      centerY: node.position.y + size.height / 2,
    };
    const verticalMatches = [
      [dragged.left, bounds.left],
      [dragged.centerX, bounds.centerX],
      [dragged.right, bounds.right],
    ];
    const horizontalMatches = [
      [dragged.top, bounds.top],
      [dragged.centerY, bounds.centerY],
      [dragged.bottom, bounds.bottom],
    ];

    for (const [left, right] of verticalMatches) {
      if (Math.abs(left - right) > ALIGNMENT_THRESHOLD) continue;
      const y1 = Math.min(dragged.top, bounds.top) - 48;
      const y2 = Math.max(dragged.bottom, bounds.bottom) + 48;
      vertical = { x: right, y1, y2 };
      break;
    }
    for (const [left, right] of horizontalMatches) {
      if (Math.abs(left - right) > ALIGNMENT_THRESHOLD) continue;
      const x1 = Math.min(dragged.left, bounds.left) - 48;
      const x2 = Math.max(dragged.right, bounds.right) + 48;
      horizontal = { y: right, x1, x2 };
      break;
    }
    if (horizontal && vertical) break;
  }

  return horizontal || vertical ? { horizontal, vertical } : null;
}

export function SimulationAlignmentGuides({
  guides,
}: {
  guides: AlignmentGuideState | null;
}) {
  const viewport = useViewport();
  if (!guides) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {guides.horizontal ? (
        <div
          className="absolute h-px bg-[var(--accent)]/80 shadow-[0_0_0_1px_rgba(17,24,39,0.08)]"
          style={{
            left: viewport.x + guides.horizontal.x1 * viewport.zoom,
            top: viewport.y + guides.horizontal.y * viewport.zoom,
            width: (guides.horizontal.x2 - guides.horizontal.x1) * viewport.zoom,
          }}
        />
      ) : null}
      {guides.vertical ? (
        <div
          className="absolute w-px bg-[var(--accent)]/80 shadow-[0_0_0_1px_rgba(17,24,39,0.08)]"
          style={{
            left: viewport.x + guides.vertical.x * viewport.zoom,
            top: viewport.y + guides.vertical.y1 * viewport.zoom,
            height: (guides.vertical.y2 - guides.vertical.y1) * viewport.zoom,
          }}
        />
      ) : null}
    </div>
  );
}

export function positionsEqual(left: ManualNodePositions, right: ManualNodePositions): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => {
    const leftPosition = left[key];
    const rightPosition = right[key];
    return (
      Boolean(rightPosition) &&
      leftPosition.x === rightPosition.x &&
      leftPosition.y === rightPosition.y
    );
  });
}

export function clonePositions(positions: ManualNodePositions): ManualNodePositions {
  return Object.fromEntries(
    Object.entries(positions).map(([id, position]) => [
      id,
      { x: position.x, y: position.y },
    ]),
  );
}

export function parseStoredPositions(value: string | null): ManualNodePositions {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: ManualNodePositions = {};
    for (const [id, position] of Object.entries(parsed)) {
      if (
        position &&
        typeof position === "object" &&
        "x" in position &&
        "y" in position &&
        typeof position.x === "number" &&
        typeof position.y === "number"
      ) {
        result[id] = { x: position.x, y: position.y };
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function buildLayoutStorageKey(
  normalized: NormalizedScenario,
  layoutScopeId: string,
): string {
  const roundId =
    normalized.topic.roundId ??
    normalized.prompt?.roundId ??
    normalized.nodes[0]?.roundId ??
    "round_1";
  return `simulation-canvas-layout:v2-dependency:${layoutScopeId}:${roundId}:${normalized.topic.id}`;
}

export function SimulationCanvasViewportFit({ fitKey }: { fitKey?: string }) {
  const { fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const fittedKey = useRef<string | null>(null);

  useEffect(() => {
    if (fitKey != null && !fitKey) return;
    const nextKey = fitKey ?? "__initial__";
    if (fittedKey.current === nextKey) return;
    const hasFittedBefore = fittedKey.current != null;
    fittedKey.current = nextKey;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.16, duration: hasFittedBefore ? 180 : 0 });
    }, hasFittedBefore ? 80 : 0);
    return () => window.clearTimeout(timer);
  }, [fitKey, fitView]);

  return null;
}

export function SimulationCanvasLayerFit({ fitKey }: { fitKey: string }) {
  const { fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const previousFitKey = useRef(fitKey);
  const hasMounted = useRef(false);

  useEffect(() => {
    const keyChanged = previousFitKey.current !== fitKey;
    const shouldFit = keyChanged || (!hasMounted.current && fitKey !== "all");
    hasMounted.current = true;
    previousFitKey.current = fitKey;
    if (!shouldFit) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: 0.18, duration: 180 });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fitKey, fitView]);

  return null;
}

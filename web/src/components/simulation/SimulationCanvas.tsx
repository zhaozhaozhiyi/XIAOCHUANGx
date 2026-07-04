"use client";

import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  SelectionMode,
  type EdgeMouseHandler,
  type IsValidConnection,
  type OnConnect,
  type OnNodeDrag,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SimulationLayerTabs } from "@/components/simulation/SimulationLayerTabs";
import { type PendingIntervention } from "@/components/simulation/SimulationPendingInterventionCard";
import {
  buildInterventionActions,
  buildNodeExpandPrompt,
  buildTopicBoundaryPrompt,
} from "@/components/simulation/SimulationPromptBuilders";
import type { SimulationRequirementsPart } from "@/components/simulation/SimulationEntryRequirementsCard";
import type { SimulationTopicAnalysisActivity } from "@/lib/simulation-topic-analysis-activity";
import type {
  DeliverablesPart,
  ErrorPart,
  SimulationSummaryPart,
  SimulationSuggestionPart,
} from "@/lib/chat-parts";
import { buildCanvas } from "@/components/simulation/canvas/buildCanvas";
import {
  CANVAS_LAYERS,
  EDGE_RELATION_META,
  LAYOUT_HISTORY_LIMIT,
  NODE_REVEAL_MS,
  REVEAL_KIND_ORDER,
  SEMANTIC_EDGE_RELATION_TYPES_LIST,
} from "@/components/simulation/canvas/canvasConstants";
import {
  computeInterventionImpact,
  decisionBranches,
  formatInterventionImpact,
  isSimulationNode,
  nodeDetailRows,
  nodeKindLabel,
  nodeLayer,
  normalizeScenario,
  scenarioDiff,
  shouldShowCanvasInspector,
  topicBoundaryLines,
  valueLabel,
} from "@/components/simulation/canvas/canvasHelpers";
import { edgeTypes, SimulationConnectionLine } from "@/components/simulation/canvas/SimulationCanvasEdge";
import {
  buildLayoutStorageKey,
  clonePositions,
  computeAlignmentGuides,
  parseStoredPositions,
  positionsEqual,
  SimulationAlignmentGuides,
  SimulationCanvasLayerFit,
  SimulationCanvasViewportFit,
} from "@/components/simulation/canvas/canvasLayout";
import {
  buildEdgeInsertPrompt,
  buildManualConnectionPrompt,
  findCanvasSourceNode,
} from "@/components/simulation/canvas/canvasPrompts";
import { SimulationCanvasActivityProvider } from "@/components/simulation/canvas/SimulationCanvasActivityContext";
import { SimulationCanvasSideRail, SimulationCanvasTools } from "@/components/simulation/canvas/SimulationCanvasToolbar";
import { nodeTypes } from "@/components/simulation/canvas/SimulationCanvasNode";
import { SimulationCanvasInspector } from "@/components/simulation/canvas/SimulationCanvasInspector";
import { inferSimulationStageState, isConnectionAllowed } from "@jlc/contracts";
import type {
  AlignmentGuideState,
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasLayerId,
  CanvasNodeToolbarActionId,
  EdgeInsertRequest,
  ManualNodePositions,
  QuestionDefinitionActionId,
  Scenario,
  SimulationRequirementSummaryPart,
} from "@/components/simulation/canvas/canvasTypes";

function areAlignmentGuidesEqual(
  left: AlignmentGuideState | null,
  right: AlignmentGuideState | null,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftHorizontal = left.horizontal;
  const rightHorizontal = right.horizontal;
  const leftVertical = left.vertical;
  const rightVertical = right.vertical;
  const horizontalEqual =
    leftHorizontal === rightHorizontal ||
    Boolean(
      leftHorizontal &&
        rightHorizontal &&
        leftHorizontal.y === rightHorizontal.y &&
        leftHorizontal.x1 === rightHorizontal.x1 &&
        leftHorizontal.x2 === rightHorizontal.x2,
    );
  const verticalEqual =
    leftVertical === rightVertical ||
    Boolean(
      leftVertical &&
        rightVertical &&
        leftVertical.x === rightVertical.x &&
        leftVertical.y1 === rightVertical.y1 &&
        leftVertical.y2 === rightVertical.y2,
    );
  return horizontalEqual && verticalEqual;
}

export function SimulationCanvas({
  scenario,
  summaries = [],
  suggestions = [],
  deliverables = [],
  errors = [],
  entryRequirementsPart,
  requirementSummaryPart,
  isReplying = false,
  onRequirementsSubmitted,
  onRequirementsDraftChange,
  onContinueAsMessage,
  topicAnalysisActivity = null,
  embedded = false,
}: {
  scenario: Scenario;
  summaries?: SimulationSummaryPart[];
  suggestions?: SimulationSuggestionPart[];
  deliverables?: DeliverablesPart[];
  errors?: ErrorPart[];
  entryRequirementsPart?: SimulationRequirementsPart;
  requirementSummaryPart?: SimulationRequirementSummaryPart;
  isReplying?: boolean;
  onRequirementsSubmitted?: (partId: string, answer: string) => void;
  onRequirementsDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      answers?: Record<string, string>;
    },
  ) => void;
  onContinueAsMessage?: (answer: string) => void;
  topicAnalysisActivity?: SimulationTopicAnalysisActivity | null;
  embedded?: boolean;
}) {
  const pathname = usePathname();
  const normalizedScenario = useMemo(() => normalizeScenario(scenario), [scenario]);
  const stageState = useMemo(
    () => inferSimulationStageState(scenario),
    [scenario],
  );
  const nodeCount =
    normalizedScenario.nodes.length +
    (normalizedScenario.prompt ? 1 : 0) +
    1;
  const pathCount =
    normalizedScenario.scenarioViews.length || normalizedScenario.paths.length;
  const pathStatusLabel = pathCount > 0 ? `${pathCount} 条推理路径` : "推理路径生成中";
  const firstPathId =
    normalizedScenario.scenarioViews[0]?.id ?? normalizedScenario.paths[0]?.id ?? null;
  const [selectedPathId, setSelectedPathId] = useState<string | null>(
    normalizedScenario.scenarioViews.find((item) => item.status === "selected")?.id ??
      normalizedScenario.paths.find((path) => path.status === "selected")?.id ??
      firstPathId,
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [activeLayerId, setActiveLayerId] = useState<CanvasLayerId>("all");
  const [variableDrafts, setVariableDrafts] = useState<Record<string, string>>({});
  const [pendingIntervention, setPendingIntervention] =
    useState<PendingIntervention | null>(null);
  const [pendingCanvasEdge, setPendingCanvasEdge] = useState<{
    id: string;
    source: string;
    target: string;
    label: string;
  } | null>(null);
  const layoutScopeId =
    pathname ??
    scenario.roundId ??
    normalizedScenario.topic.roundId ??
    normalizedScenario.prompt?.roundId ??
    "simulation-canvas";
  const layoutStorageKey = useMemo(
    () => buildLayoutStorageKey(normalizedScenario, layoutScopeId),
    [layoutScopeId, normalizedScenario],
  );
  const [manualPositions, setManualPositions] = useState<ManualNodePositions>({});
  const [layoutHydratedKey, setLayoutHydratedKey] = useState<string | null>(null);
  const [layoutHistory, setLayoutHistory] = useState<{
    past: ManualNodePositions[];
    future: ManualNodePositions[];
  }>({ past: [], future: [] });
  const [alignmentGuides, setAlignmentGuides] =
    useState<AlignmentGuideState | null>(null);
  const visibleNodesRef = useRef<CanvasFlowNode[]>([]);
  const draggedNodeRef = useRef<CanvasFlowNode | null>(null);
  const alignmentFrameRef = useRef<number | null>(null);
  const selectedGroupSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds],
  );

  useEffect(() => {
    return () => {
      if (alignmentFrameRef.current == null) return;
      window.cancelAnimationFrame(alignmentFrameRef.current);
      alignmentFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedPositions = parseStoredPositions(
        window.localStorage.getItem(layoutStorageKey),
      );
      setManualPositions(storedPositions);
      setLayoutHydratedKey(layoutStorageKey);
      setLayoutHistory({ past: [], future: [] });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [layoutStorageKey]);

  useEffect(() => {
    if (layoutHydratedKey !== layoutStorageKey) return;
    window.localStorage.setItem(
      layoutStorageKey,
      JSON.stringify(manualPositions),
    );
  }, [layoutHydratedKey, layoutStorageKey, manualPositions]);

  const pushLayoutSnapshot = useCallback(() => {
    const snapshot = clonePositions(manualPositions);
    setLayoutHistory((current) => {
      const last = current.past[current.past.length - 1];
      if (last && positionsEqual(last, snapshot)) return current;
      return {
        past: [...current.past, snapshot].slice(-LAYOUT_HISTORY_LIMIT),
        future: [],
      };
    });
  }, [manualPositions]);

  const handleUndoLayout = useCallback(() => {
    const previous = layoutHistory.past[layoutHistory.past.length - 1];
    if (!previous) return;
    setLayoutHistory({
      past: layoutHistory.past.slice(0, -1),
      future: [
        clonePositions(manualPositions),
        ...layoutHistory.future,
      ].slice(0, LAYOUT_HISTORY_LIMIT),
    });
    setManualPositions(clonePositions(previous));
  }, [layoutHistory, manualPositions]);

  const handleRedoLayout = useCallback(() => {
    const next = layoutHistory.future[0];
    if (!next) return;
    setLayoutHistory({
      past: [...layoutHistory.past, clonePositions(manualPositions)].slice(
        -LAYOUT_HISTORY_LIMIT,
      ),
      future: layoutHistory.future.slice(1),
    });
    setManualPositions(clonePositions(next));
  }, [layoutHistory, manualPositions]);

  const handleResetLayout = useCallback(() => {
    if (Object.keys(manualPositions).length === 0) return;
    pushLayoutSnapshot();
    setManualPositions({});
  }, [manualPositions, pushLayoutSnapshot]);

  const handleNodeToolbarAction = useCallback(
    (action: CanvasNodeToolbarActionId, nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      const sourceNode = findCanvasSourceNode(nodeId, normalizedScenario);
      if (action === "inspect") return;
      if (action === "copy") {
        const selectedSource = sourceNode;
        const text = selectedSource
          ? [
              `节点：${selectedSource.label}`,
              `类型：${nodeKindLabel(selectedSource.type)}`,
              selectedSource.detail ? `说明：${selectedSource.detail}` : "",
              selectedSource.value != null
                ? `当前值：${valueLabel(selectedSource.value)}`
                : "",
            ]
              .filter(Boolean)
              .join("\n")
          : nodeId;
        void window.navigator.clipboard?.writeText(text).catch(() => undefined);
        return;
      }
      if (!sourceNode || !onContinueAsMessage) return;
      const impactLines = formatInterventionImpact(
        computeInterventionImpact(sourceNode, normalizedScenario),
      );
      onContinueAsMessage(
        buildNodeExpandPrompt({
          node: sourceNode,
          nodeTypeLabel: nodeKindLabel(sourceNode.type),
          impactLines,
        }),
      );
    },
    [normalizedScenario, onContinueAsMessage],
  );

  const handleInsertEdgeNode = useCallback(
    (request: EdgeInsertRequest) => {
      setPendingCanvasEdge({
        id: `pending-insert:${request.edgeId}:${Date.now()}`,
        source: request.sourceId,
        target: request.targetId,
        label: "插点生成中",
      });
      onContinueAsMessage?.(buildEdgeInsertPrompt(request));
    },
    [onContinueAsMessage],
  );
  const handleCanvasNodeSelect = useCallback((nodeId: string, additive = false) => {
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setSelectedGroupIds((current) => {
      if (!additive) return [nodeId];
      if (!current.includes(nodeId)) return [...current, nodeId];
      return current;
    });
    if (nodeId.startsWith("path:")) {
      setSelectedPathId(nodeId.slice("path:".length));
    } else if (nodeId.startsWith("scenario:")) {
      setActiveLayerId("scenario");
      setSelectedPathId(nodeId.slice("scenario:".length));
    }
  }, []);
  const handleQuestionDefinitionAction = useCallback(
    (nodeId: string, action: QuestionDefinitionActionId) => {
      const node = findCanvasSourceNode(nodeId, normalizedScenario);
      if (!node || node.type !== "topic" || !onContinueAsMessage) return;
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setSelectedGroupIds([nodeId]);
      onContinueAsMessage(
        buildTopicBoundaryPrompt({
          node,
          operation: action === "confirm" ? "确认" : "修改",
          topicLines: topicBoundaryLines(node),
          impactLines: [],
          instruction:
            action === "confirm"
              ? "用户已确认该问题定义。请从 Topic 继续生成世界模型层：Entity、Variable、Hypothesis、Inference，并保留 Prompt→Topic 的问题层关系。输出的 Topic 必须标记 status=confirmed，data.state=modeling_world。"
              : "请只更新问题定义表单字段，继续保持 data.state=waiting_boundary_confirmation，暂不要生成 Entity、Variable、Hypothesis 或 Scenario。",
        }),
      );
    },
    [normalizedScenario, onContinueAsMessage],
  );
  const { nodes, edges, sourceById } = useMemo(
    () =>
      buildCanvas({
        scenario,
        selectedPathId,
        selectedNodeId,
        selectedNodeIds: selectedGroupSet,
        selectedEdgeId,
        manualPositions,
        onNodeToolbarAction: handleNodeToolbarAction,
        onNodeSelect: handleCanvasNodeSelect,
        onQuestionDefinitionAction: handleQuestionDefinitionAction,
        onInsertEdgeNode: handleInsertEdgeNode,
        summaries,
        suggestions,
        deliverables,
        errors,
        entryRequirementsPart,
        requirementSummaryPart,
        isReplying,
        onRequirementsSubmitted,
        onRequirementsDraftChange,
        onRequirementsContinue: onContinueAsMessage,
        embedded,
      }),
    [
      scenario,
      embedded,
      selectedPathId,
      selectedNodeId,
      selectedGroupSet,
      selectedEdgeId,
      manualPositions,
      handleNodeToolbarAction,
      handleCanvasNodeSelect,
      handleQuestionDefinitionAction,
      handleInsertEdgeNode,
      summaries,
      suggestions,
      deliverables,
      errors,
      entryRequirementsPart,
      requirementSummaryPart,
      isReplying,
      onRequirementsSubmitted,
      onRequirementsDraftChange,
      onContinueAsMessage,
    ],
  );
  const revealOrder = useMemo(
    () =>
      nodes
        .map((node, index) => ({
          id: node.id,
          index,
          order: REVEAL_KIND_ORDER.get(node.data.kind) ?? 99,
          x: node.position.x,
          y: node.position.y,
        }))
        .sort((left, right) => {
          if (left.order !== right.order) return left.order - right.order;
          if (left.x !== right.x) return left.x - right.x;
          if (left.y !== right.y) return left.y - right.y;
          return left.index - right.index;
        })
        .map((item) => item.id),
    [nodes],
  );
  const revealKey = revealOrder.join("|");
  const skipRevealStagger = isReplying;
  const initialRevealCount = skipRevealStagger
    ? nodes.length
    : Math.min(nodes.length, normalizedScenario.prompt ? 2 : 1);
  const [revealState, setRevealState] = useState({
    key: revealKey,
    ids: revealOrder.slice(0, initialRevealCount),
  });

  useEffect(() => {
    if (skipRevealStagger) {
      const timer = window.setTimeout(() => {
        setRevealState((current) => {
          if (
            current.key === revealKey &&
            current.ids.length === revealOrder.length &&
            current.ids.every((id, index) => id === revealOrder[index])
          ) {
            return current;
          }
          return { key: revealKey, ids: revealOrder };
        });
      }, 0);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      setRevealState((current) => {
        const currentRevealIds = new Set(current.ids);
        const nextNodeIds = new Set(revealOrder);
        const preservedIds = current.ids.filter((id) => nextNodeIds.has(id));
        for (const id of revealOrder.slice(0, initialRevealCount)) {
          currentRevealIds.add(id);
        }
        const nextIds = revealOrder.filter(
          (id) => currentRevealIds.has(id) || preservedIds.includes(id),
        );
        if (
          current.key === revealKey &&
          current.ids.length === nextIds.length &&
          current.ids.every((id, index) => id === nextIds[index])
        ) {
          return current;
        }
        return { key: revealKey, ids: nextIds };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialRevealCount, revealKey, revealOrder, skipRevealStagger]);

  const revealedNodeIds = useMemo(
    () => new Set(revealState.ids),
    [revealState.ids],
  );

  useEffect(() => {
    if (skipRevealStagger) return;
    if (revealedNodeIds.size >= revealOrder.length) return;
    const nextId = revealOrder.find((id) => !revealedNodeIds.has(id));
    if (!nextId) return;
    const timer = window.setTimeout(() => {
      setRevealState((current) =>
        current.key === revealKey
          ? { ...current, ids: [...current.ids, nextId] }
          : current,
      );
    }, NODE_REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealedNodeIds, revealKey, revealOrder, skipRevealStagger]);
  const revealedNodes = useMemo(
    () => nodes.filter((node) => revealedNodeIds.has(node.id)),
    [nodes, revealedNodeIds],
  );
  const revealedEdges = useMemo(
    () =>
      edges.filter(
        (edge) => revealedNodeIds.has(edge.source) && revealedNodeIds.has(edge.target),
      ),
    [edges, revealedNodeIds],
  );
  const isRevealing = revealedNodes.length < nodes.length;
  const layerCounts = useMemo(() => {
    const counts = new Map<CanvasLayerId, number>();
    for (const layer of CANVAS_LAYERS) counts.set(layer.id, 0);
    counts.set("all", revealedNodes.length);
    for (const node of revealedNodes) {
      const layer = nodeLayer(node.data.kind);
      counts.set(layer, (counts.get(layer) ?? 0) + 1);
    }
    return counts;
  }, [revealedNodes]);
  const visibleNodes = useMemo(() => {
    if (activeLayerId === "all") return revealedNodes;
    const revealedById = new Map(revealedNodes.map((node) => [node.id, node]));
    const upstreamByTarget = new Map<string, string[]>();
    for (const edge of revealedEdges) {
      const upstream = upstreamByTarget.get(edge.target) ?? [];
      upstream.push(edge.source);
      upstreamByTarget.set(edge.target, upstream);
    }

    const visibleIds = new Set<string>();
    const queue: string[] = [];
    for (const node of revealedNodes) {
      const layer = nodeLayer(node.data.kind);
      if (layer === "question" || layer === activeLayerId) {
        visibleIds.add(node.id);
        queue.push(node.id);
      }
    }

    for (let index = 0; index < queue.length; index += 1) {
      const targetId = queue[index];
      for (const sourceId of upstreamByTarget.get(targetId) ?? []) {
        if (visibleIds.has(sourceId) || !revealedById.has(sourceId)) continue;
        visibleIds.add(sourceId);
        queue.push(sourceId);
      }
    }

    return revealedNodes.filter((node) => visibleIds.has(node.id));
  }, [activeLayerId, revealedEdges, revealedNodes]);
  useEffect(() => {
    visibleNodesRef.current = visibleNodes;
  }, [visibleNodes]);
  const visibleNodeFitKey = useMemo(
    () => visibleNodes.map((node) => node.id).join("|"),
    [visibleNodes],
  );
  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );
  const effectivePendingCanvasEdge = useMemo(() => {
    if (!pendingCanvasEdge) return null;
    const realEdgeExists = normalizedScenario.edges.some(
      (edge) =>
        edge.source === pendingCanvasEdge.source &&
        edge.target === pendingCanvasEdge.target,
    );
    return realEdgeExists ? null : pendingCanvasEdge;
  }, [normalizedScenario.edges, pendingCanvasEdge]);
  const visibleEdges = useMemo(
    () => {
      const base = revealedEdges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      );
      if (
        !effectivePendingCanvasEdge ||
        !visibleNodeIds.has(effectivePendingCanvasEdge.source) ||
        !visibleNodeIds.has(effectivePendingCanvasEdge.target)
      ) {
        return base;
      }
      const pendingEdge: CanvasFlowEdge = {
        id: effectivePendingCanvasEdge.id,
        type: "simulation",
        source: effectivePendingCanvasEdge.source,
        target: effectivePendingCanvasEdge.target,
        animated: true,
        style: { stroke: "#f59e0b", strokeDasharray: "6 5" },
        data: {
          kind: "inference",
          relationType: "system",
          label: effectivePendingCanvasEdge.label,
        },
      };
      return [...base, pendingEdge];
    },
    [effectivePendingCanvasEdge, revealedEdges, visibleNodeIds],
  );
  const hoverAwareVisibleEdges = useMemo(
    () =>
      visibleEdges.map((edge) => {
        if (!edge.data?.onInsertNode) return edge;
        return {
          ...edge,
          data: {
            ...edge.data,
            isHovered: edge.id === hoveredEdgeId,
          },
        };
      }),
    [hoveredEdgeId, visibleEdges],
  );
  const handleNodeDragStart = useCallback<OnNodeDrag<CanvasFlowNode>>(
    () => {
      pushLayoutSnapshot();
    },
    [pushLayoutSnapshot],
  );
  const scheduleAlignmentGuideUpdate = useCallback(() => {
    if (alignmentFrameRef.current != null) return;
    alignmentFrameRef.current = window.requestAnimationFrame(() => {
      alignmentFrameRef.current = null;
      const draggedNode = draggedNodeRef.current;
      const nextGuides = draggedNode
        ? computeAlignmentGuides(draggedNode, visibleNodesRef.current)
        : null;
      setAlignmentGuides((current) =>
        areAlignmentGuidesEqual(current, nextGuides) ? current : nextGuides,
      );
    });
  }, []);
  const handleNodeDrag = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_, node) => {
      draggedNodeRef.current = node;
      scheduleAlignmentGuideUpdate();
    },
    [scheduleAlignmentGuideUpdate],
  );
  const handleNodeDragStop = useCallback<OnNodeDrag<CanvasFlowNode>>(
    (_, node, draggedNodes) => {
      draggedNodeRef.current = null;
      if (alignmentFrameRef.current != null) {
        window.cancelAnimationFrame(alignmentFrameRef.current);
        alignmentFrameRef.current = null;
      }
      setAlignmentGuides((current) => (current == null ? current : null));
      const nodesToPersist = draggedNodes.length > 0 ? draggedNodes : [node];
      setManualPositions((current) => {
        const next = { ...current };
        for (const item of nodesToPersist) {
          next[item.id] = {
            x: Math.round(item.position.x),
            y: Math.round(item.position.y),
          };
        }
        return next;
      });
    },
    [],
  );
  const handleEdgeMouseEnter = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      setHoveredEdgeId(edge.id);
    },
    [],
  );
  const handleEdgeMouseLeave = useCallback<EdgeMouseHandler<CanvasFlowEdge>>(
    (_, edge) => {
      setHoveredEdgeId((current) => (current === edge.id ? null : current));
    },
    [],
  );
  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams<
      CanvasFlowNode,
      CanvasFlowEdge
    >) => {
      setSelectedGroupIds(selectedNodes.map((node) => node.id));
      if (selectedEdges[0]) {
        setSelectedEdgeId(selectedEdges[0].id);
        setSelectedNodeId(null);
      }
    },
    [],
  );
  // F4: 手动连线合法性校验。复用 transition-grammar 运行时表，
  // 拦截明确禁止的短路（如 topic→action、variable→conclusion），
  // 避免非法边入图并回环给 AI。未列出的转换放行（软约束交由 AI 判断）。
  const handleIsValidConnection = useCallback<IsValidConnection<CanvasFlowEdge>>(
    (connection) => {
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      const sourceNode = sourceById.get(connection.source)?.source;
      const targetNode = sourceById.get(connection.target)?.source;
      // 只有当两端都是有类型的推演节点时才用语法校验；
      // 系统节点（path/scenario/输出等）不参与语法约束，放行。
      if (
        !sourceNode ||
        !targetNode ||
        !isSimulationNode(sourceNode) ||
        !isSimulationNode(targetNode)
      ) {
        return true;
      }
      return isConnectionAllowed(sourceNode.type, targetNode.type);
    },
    [sourceById],
  );

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      // 与 isValidConnection 一致的兜底：非法短路不入图、不回环给 AI。
      if (!handleIsValidConnection(connection)) return;
      const sourceLabel = sourceById.get(connection.source)?.label ?? connection.source;
      const targetLabel = sourceById.get(connection.target)?.label ?? connection.target;
      setPendingCanvasEdge({
        id: `pending-edge:${connection.source}:${connection.target}:${Date.now()}`,
        source: connection.source,
        target: connection.target,
        label: "关系生成中",
      });
      onContinueAsMessage?.(
        buildManualConnectionPrompt({
          sourceLabel,
          targetLabel,
          sourceId: connection.source,
          targetId: connection.target,
        }),
      );
    },
    [handleIsValidConnection, onContinueAsMessage, sourceById],
  );
  const effectiveSelectedNodeId =
    selectedNodeId && visibleNodeIds.has(selectedNodeId) ? selectedNodeId : null;
  const selected = effectiveSelectedNodeId
    ? sourceById.get(effectiveSelectedNodeId)
    : undefined;
  const showInspector = shouldShowCanvasInspector(embedded, selected);
  const selectedSource = selected?.source;
  const selectedPath =
    selected?.kind === "path"
      ? normalizedScenario.paths.find(
          (path) => `path:${path.id}` === effectiveSelectedNodeId,
        ) ?? null
      : null;
  const selectedScenarioView = selected?.scenarioView ?? null;
  const selectedNode =
    selectedSource && isSimulationNode(selectedSource) ? selectedSource : null;
  const selectedImpact = selectedNode
    ? computeInterventionImpact(selectedNode, normalizedScenario)
    : null;
  const selectedImpactLines = formatInterventionImpact(selectedImpact);
  const selectedNodeActions = selectedNode
    ? buildInterventionActions({
        node: selectedNode,
        nodeTypeLabel: nodeKindLabel(selectedNode.type),
        impactLines: selectedImpactLines,
      })
    : [];
  const selectedNodeDetailRows = selectedNode ? nodeDetailRows(selectedNode) : [];
  const selectedImpactGroups = selectedImpact
    ? [
        { label: "预计影响节点", items: selectedImpact.downstreamNodes },
        { label: "预计影响边", items: selectedImpact.affectedEdges },
        { label: "预计影响路径", items: selectedImpact.affectedPaths },
        { label: "预计影响情景", items: selectedImpact.affectedScenarios },
        { label: "需重新评估", items: selectedImpact.staleCandidates },
      ]
    : [];
  const selectedDecisionBranches = decisionBranches(selectedNode);
  const selectedScenarioDiff = scenarioDiff(
    selectedScenarioView,
    normalizedScenario.scenarioViews,
    normalizedScenario.nodes,
    normalizedScenario.edges,
    normalizedScenario.paths,
  );
  const selectedRelatedPaths =
    selectedImpact?.affectedPaths.length
      ? selectedImpact.affectedPaths
      : selectedNode && selectedNode.pathIds?.length
            ? normalizedScenario.paths.filter((path) => selectedNode.pathIds?.includes(path.id))
      : selectedNode
        ? normalizedScenario.paths.filter((path) =>
            normalizedScenario.edges
              .filter(
                (edge) =>
                  edge.source === selectedNode.id || edge.target === selectedNode.id,
              )
              .some((edge) => path.edgeIds.includes(edge.id)),
          )
        : [];
  const revealedScenarioViews = normalizedScenario.scenarioViews.filter((view) =>
    revealedNodeIds.has(`scenario:${view.id}`),
  );
  const revealedPaths = normalizedScenario.paths.filter((path) =>
    revealedNodeIds.has(`path:${path.id}`),
  );
  const revealedPathCount =
    revealedScenarioViews.length || revealedPaths.length;
  const visiblePathStatusLabel =
    revealedPathCount > 0 ? `${revealedPathCount} 条推理路径` : "推理路径生成中";

  useEffect(() => {
    const handleHighlight = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; id?: string }>).detail;
      if (!detail?.id) return;
      if (detail.kind === "path") {
        const pathNodeId = `path:${detail.id}`;
        if (!sourceById.has(pathNodeId)) return;
        setSelectedPathId(detail.id);
        setSelectedNodeId(pathNodeId);
        setSelectedEdgeId(null);
        setSelectedGroupIds([pathNodeId]);
        return;
      }
      if (detail.kind === "scenario") {
        const scenarioNodeId = `scenario:${detail.id}`;
        if (!sourceById.has(scenarioNodeId)) return;
        setActiveLayerId("scenario");
        setSelectedPathId(detail.id);
        setSelectedNodeId(scenarioNodeId);
        setSelectedEdgeId(null);
        setSelectedGroupIds([scenarioNodeId]);
        return;
      }
      if (detail.kind === "node" && sourceById.has(detail.id)) {
        setSelectedNodeId(detail.id);
        setSelectedEdgeId(null);
        setSelectedGroupIds([detail.id]);
      }
    };
    window.addEventListener("jlc-simulation-highlight", handleHighlight);
    return () =>
      window.removeEventListener("jlc-simulation-highlight", handleHighlight);
  }, [sourceById]);

  const handleLayerChange = useCallback((layerId: string) => {
    setActiveLayerId(layerId as CanvasLayerId);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setSelectedGroupIds([]);
  }, []);

  const renderQuickSuggestionActions = (variant: "rail" | "bar") => {
    if (!onContinueAsMessage) return null;
    const suggestionItems = suggestions
      .flatMap((part) => part.suggestions ?? [])
      .slice(0, 3)
      .map((suggestion) => ({
        id: `suggestion:${suggestion.suggestionId}`,
        label: suggestion.title,
        message: [
          "请基于这条推演建议继续生成下一轮节点：",
          `建议：${suggestion.title}`,
          suggestion.description,
        ]
          .filter(Boolean)
          .join("\n"),
      }));
    const nextActionItems = suggestions
      .flatMap((part) => part.nextActions ?? [])
      .slice(0, 2)
      .map((action) => ({
        id: `next-action:${action.actionId}`,
        label: action.title,
        message: [
          "请执行这条沙盘下一步行动：",
          `行动：${action.title}`,
          action.description,
          action.targetId ? `目标：${action.targetId}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      }));
    const items = [...suggestionItems, ...nextActionItems].slice(0, 3);
    if (items.length === 0) return null;
    const buttonClass =
      variant === "rail"
        ? "max-w-[11rem] truncate rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] leading-4 text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
        : "max-w-[14rem] truncate rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--fg-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]";
    return (
      <div className="flex min-w-0 flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => onContinueAsMessage(item.message)}
            className={buttonClass}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  };

  const scenarioPathActions =
    revealedScenarioViews.length > 0 || revealedPaths.length > 0 || renderQuickSuggestionActions("rail") ? (
      <>
        {renderQuickSuggestionActions("rail")}
        {revealedScenarioViews.map((scenarioView) => {
          const selected = selectedPathId === scenarioView.id;
          return (
            <button
              key={scenarioView.id}
              type="button"
              onClick={() => {
                setActiveLayerId("scenario");
                setSelectedPathId(scenarioView.id);
                setSelectedNodeId(`scenario:${scenarioView.id}`);
                setSelectedEdgeId(null);
                setSelectedGroupIds([`scenario:${scenarioView.id}`]);
              }}
              className={[
                "rounded-[var(--radius-md)] border px-2 py-0.5 text-[10px] leading-4 transition-colors",
                selected
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {scenarioView.label}
            </button>
          );
        })}
        {revealedPaths.map((path) => {
          const selected = selectedPathId === path.id;
          return (
            <button
              key={path.id}
              type="button"
              onClick={() => {
                setSelectedPathId(path.id);
                setSelectedNodeId(`path:${path.id}`);
                setSelectedEdgeId(null);
                setSelectedGroupIds([`path:${path.id}`]);
              }}
              className={[
                "rounded-[var(--radius-md)] border px-2 py-0.5 text-[10px] leading-4 transition-colors",
                selected
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {path.label}
            </button>
          );
        })}
      </>
    ) : null;

  const statusChips = (
    <>
      {isRevealing ? (
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--fg-secondary)] shadow-[var(--shadow-sm)]">
          正在生成 {revealedNodes.length}/{nodeCount}
        </span>
      ) : null}
      <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--fg-secondary)] shadow-[var(--shadow-sm)]">
        {visiblePathStatusLabel}
      </span>
      {renderQuickSuggestionActions("bar")}
      {revealedScenarioViews.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {revealedScenarioViews.map((scenarioView) => {
            const selected = selectedPathId === scenarioView.id;
            return (
              <button
                key={scenarioView.id}
                type="button"
                onClick={() => {
                  setActiveLayerId("scenario");
                  setSelectedPathId(scenarioView.id);
                  setSelectedNodeId(`scenario:${scenarioView.id}`);
                  setSelectedEdgeId(null);
                  setSelectedGroupIds([`scenario:${scenarioView.id}`]);
                }}
                className={[
                  "rounded-[var(--radius-md)] border px-2.5 py-1 text-xs shadow-[var(--shadow-sm)] transition-colors",
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg-secondary)] hover:border-[var(--accent)]",
                ].join(" ")}
              >
                {scenarioView.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {revealedPaths.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {revealedPaths.map((path) => {
            const selected = selectedPathId === path.id;
            return (
              <button
                key={path.id}
                type="button"
                onClick={() => {
                  setSelectedPathId(path.id);
                  setSelectedNodeId(`path:${path.id}`);
                  setSelectedEdgeId(null);
                  setSelectedGroupIds([`path:${path.id}`]);
                }}
                className={[
                  "rounded-[var(--radius-md)] border px-2.5 py-1 text-xs shadow-[var(--shadow-sm)] transition-colors",
                  selected
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                    : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg-secondary)] hover:border-[var(--accent)]",
                ].join(" ")}
              >
                {path.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col overflow-hidden bg-[var(--surface)]"
          : "h-full min-h-[560px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)]"
      }
    >
      {!embedded ? (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] px-3 py-2">
            {statusChips}
          </div>
          <SimulationLayerTabs
            layers={CANVAS_LAYERS}
            activeLayerId={activeLayerId}
            layerCounts={layerCounts}
            onLayerChange={handleLayerChange}
          />
        </>
      ) : null}

      <div
        className={
          embedded
            ? "relative min-h-0 flex-1"
            : "relative min-h-[520px] xl:h-[calc(100vh-12rem)]"
        }
      >
        <div className="h-full min-h-0 min-w-0 bg-[var(--surface)]">
          <SimulationCanvasActivityProvider value={topicAnalysisActivity}>
            <ReactFlow
              nodes={visibleNodes}
              edges={hoverAwareVisibleEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView={false}
              minZoom={0.35}
              maxZoom={1.6}
              proOptions={{ hideAttribution: true }}
              nodesDraggable
              nodesConnectable={Boolean(onContinueAsMessage)}
              panOnDrag
              elementsSelectable
              selectionOnDrag={false}
              selectionKeyCode="Shift"
              multiSelectionKeyCode={["Shift", "Meta", "Control"]}
              selectionMode={SelectionMode.Partial}
              connectionLineComponent={SimulationConnectionLine}
              onNodeDragStart={handleNodeDragStart}
              onNodeDrag={handleNodeDrag}
              onNodeDragStop={handleNodeDragStop}
              onEdgeMouseEnter={handleEdgeMouseEnter}
              onEdgeMouseLeave={handleEdgeMouseLeave}
              onSelectionChange={handleSelectionChange}
              onConnect={handleConnect}
              isValidConnection={handleIsValidConnection}
              onPaneClick={() => {
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setSelectedGroupIds([]);
              }}
              onEdgeClick={(_, edge) => {
                setSelectedEdgeId(edge.id);
                setSelectedNodeId(null);
                setSelectedGroupIds([]);
              }}
              onNodeClick={(event, node) =>
                handleCanvasNodeSelect(
                  node.id,
                  event.shiftKey || event.metaKey || event.ctrlKey,
                )
              }
            >
              <Background gap={20} size={1} />
              <SimulationCanvasViewportFit fitKey={visibleNodeFitKey} />
              <SimulationCanvasLayerFit fitKey={activeLayerId} />
              <SimulationAlignmentGuides guides={alignmentGuides} />
              {embedded ? (
                <SimulationCanvasSideRail
                  isRevealing={isRevealing}
                  revealedCount={revealedNodes.length}
                  nodeCount={nodeCount}
                  pathStatusLabel={visiblePathStatusLabel}
                  waveLabel={stageState.waveId}
                  scenarioPathActions={scenarioPathActions}
                  layers={CANVAS_LAYERS}
                  activeLayerId={activeLayerId}
                  layerCounts={layerCounts}
                  onLayerChange={handleLayerChange}
                  manualPositionCount={Object.keys(manualPositions).length}
                  canUndo={layoutHistory.past.length > 0}
                  canRedo={layoutHistory.future.length > 0}
                  onUndo={handleUndoLayout}
                  onRedo={handleRedoLayout}
                  onResetLayout={handleResetLayout}
                />
              ) : null}
              {!embedded ? <Controls position="bottom-right" showInteractive={false} /> : null}
              {!embedded ? (
                <SimulationCanvasTools
                  manualPositionCount={Object.keys(manualPositions).length}
                  canUndo={layoutHistory.past.length > 0}
                  canRedo={layoutHistory.future.length > 0}
                  onUndo={handleUndoLayout}
                  onRedo={handleRedoLayout}
                  onResetLayout={handleResetLayout}
                />
              ) : null}
              {!embedded ? (
                <Panel
                  position="bottom-right"
                  className="pointer-events-none !m-0 !mb-1 !mr-2 select-none"
                >
                  <span className="text-[10px] text-[var(--fg-tertiary)]">
                    沙盘推演
                  </span>
                </Panel>
              ) : null}
              {!embedded ? (
                <Panel
                  position="bottom-left"
                  className="pointer-events-none !m-0 !mb-1 !ml-2 select-none"
                >
                  <div className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)]/85 px-2 py-1 text-[10px] text-[var(--fg-tertiary)] backdrop-blur-sm">
                    {SEMANTIC_EDGE_RELATION_TYPES_LIST.map((relationType) => (
                      <span key={relationType} className="flex items-center gap-1">
                        <svg width="18" height="6" aria-hidden>
                          <line
                            x1="1"
                            y1="3"
                            x2="17"
                            y2="3"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeDasharray={
                              EDGE_RELATION_META[relationType].dash
                            }
                          />
                        </svg>
                        {EDGE_RELATION_META[relationType].label}
                      </span>
                    ))}
                  </div>
                </Panel>
              ) : null}
            </ReactFlow>
          </SimulationCanvasActivityProvider>
        </div>

        {showInspector && selected ? (
          <SimulationCanvasInspector
            embedded={embedded}
            selected={selected}
            selectedNode={selectedNode}
            selectedPath={selectedPath}
            selectedScenarioView={selectedScenarioView}
            selectedScenarioDiff={selectedScenarioDiff}
            selectedImpact={selectedImpact}
            selectedImpactLines={selectedImpactLines}
            selectedNodeActions={selectedNodeActions}
            selectedNodeDetailRows={selectedNodeDetailRows}
            selectedImpactGroups={selectedImpactGroups}
            selectedDecisionBranches={selectedDecisionBranches}
            selectedRelatedPaths={selectedRelatedPaths}
            pendingIntervention={pendingIntervention}
            effectiveSelectedNodeId={effectiveSelectedNodeId}
            scenario={scenario}
            normalizedScenario={normalizedScenario}
            nodeCount={nodeCount}
            pathStatusLabel={pathStatusLabel}
            variableDrafts={variableDrafts}
            onContinueAsMessage={onContinueAsMessage}
            setSelectedNodeId={setSelectedNodeId}
            setPendingIntervention={setPendingIntervention}
            setVariableDrafts={setVariableDrafts}
          />
        ) : null}
      </div>
    </div>
  );
}

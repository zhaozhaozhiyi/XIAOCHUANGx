import type {
  DeliverablesPart,
  ErrorPart,
  SimulationSuggestionPart,
  SimulationSummaryPart,
} from "@/lib/chat-parts";
import type { SimulationRequirementsPart } from "@/components/simulation/SimulationEntryRequirementsCard";
import {
  AI_COLUMN_X,
  CANVAS_NODE_ROW_STEP,
  CANVAS_NODE_TOP,
} from "./canvasConstants";
import type {
  CanvasEdgeData,
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasKind,
  CanvasNodeData,
  CanvasNodeToolbarActionId,
  EdgeInsertRequest,
  ManualNodePositions,
  QuestionDefinitionActionId,
  Scenario,
  SimulationRequirementSummaryPart,
} from "./canvasTypes";
import {
  edgeStyle,
  interventionSummaryLines,
  isQuestionLayerNodeData,
  isTopicDefinitionPending,
  markdownPlainText,
  normalizeScenario,
  pathIncludesNode,
  promptDisplayText,
  resolveTopicDefinitionPhase,
  shortLabel,
} from "./canvasHelpers";
import {
  computeDependencyLayout,
  type DependencyLayoutEdge,
  type DependencyLayoutNode,
} from "./dependencyLayout";

function estimatedLayoutSize(input: {
  kind: string;
  detail?: string;
  topicDefinitionPhase?: string;
  questionCount?: number;
}): { width: number; height: number } {
  if (input.kind === "topic" && input.topicDefinitionPhase) {
    if (input.topicDefinitionPhase === "form") {
      return {
        width: 920,
        height: Math.max(680, 180 + (input.questionCount ?? 7) * 92),
      };
    }
    if (input.topicDefinitionPhase === "analyzing") {
      return { width: 520, height: 260 };
    }
    return { width: 420, height: 240 };
  }
  if (input.kind === "prompt") return { width: 360, height: 140 };
  if (input.kind === "topic") return { width: 420, height: 180 };
  if (input.kind === "variable") return { width: 300, height: 220 };
  if (input.kind === "scenario" || input.kind === "path") {
    return { width: 320, height: 150 };
  }
  const detailLength = input.detail?.length ?? 0;
  const detailRows = Math.min(4, Math.ceil(detailLength / 54));
  return {
    width: 300,
    height: Math.max(136, 118 + detailRows * 18),
  };
}

export function buildCanvas(input: {
  scenario: Scenario;
  selectedPathId: string | null;
  selectedNodeId: string | null;
  selectedNodeIds?: Set<string>;
  selectedEdgeId?: string | null;
  manualPositions?: ManualNodePositions;
  onNodeToolbarAction?: (
    action: CanvasNodeToolbarActionId,
    nodeId: string,
  ) => void;
  onNodeSelect?: (nodeId: string, additive?: boolean) => void;
  onQuestionDefinitionAction?: (
    nodeId: string,
    action: QuestionDefinitionActionId,
  ) => void;
  onInsertEdgeNode?: (request: EdgeInsertRequest) => void;
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
  onRequirementsContinue?: (answer: string) => void;
  embedded?: boolean;
}): {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  sourceById: Map<string, CanvasNodeData>;
} {
  const {
    scenario,
    selectedPathId,
    selectedNodeId,
    selectedNodeIds = new Set<string>(),
    selectedEdgeId,
    manualPositions = {},
    onNodeToolbarAction,
    onNodeSelect,
    onQuestionDefinitionAction,
    onInsertEdgeNode,
    summaries = [],
    suggestions = [],
    deliverables = [],
    errors = [],
    entryRequirementsPart,
    requirementSummaryPart,
    isReplying = false,
    onRequirementsSubmitted,
    onRequirementsDraftChange,
    onRequirementsContinue,
    embedded = false,
  } = input;
  const sourceById = new Map<string, CanvasNodeData>();
  const nodes: CanvasFlowNode[] = [];
  const edges: CanvasFlowEdge[] = [];
  const normalized = normalizeScenario(scenario);
  const topicDefinitionPhase = resolveTopicDefinitionPhase(normalized.topic, {
    entryRequirementsPart,
    requirementSummaryPart,
  });
  const questionLayerY = CANVAS_NODE_TOP;
  const knownNodeIds = new Set<string>();
  const edgeById = new Map(normalized.edges.map((edge) => [edge.id, edge]));
  const sourceCounts = new Map<string, number>();

  const allStructuredNodes = normalized.nodes;
  const selectedScenarioView =
    selectedPathId == null
      ? null
      : (normalized.scenarioViews.find((view) => view.id === selectedPathId) ?? null);
  const layoutNodes: DependencyLayoutNode[] = [];
  const layoutEdges: DependencyLayoutEdge[] = [];
  const layoutNodeIds = new Set<string>();
  const scenarioSourceById = new Map<string, string>();
  const pathSourceById = new Map<string, string>();
  const pathRelatedNodesById = new Map<string, typeof allStructuredNodes>();
  let layoutOrder = 0;
  const pushLayoutNode = (input: {
    id: string;
    kind: string;
    detail?: string;
    minRank?: number;
  }) => {
    const size = estimatedLayoutSize({
      kind: input.kind,
      detail: input.detail,
      topicDefinitionPhase:
        input.kind === "topic" ? (topicDefinitionPhase ?? undefined) : undefined,
      questionCount: entryRequirementsPart?.questions.length,
    });
    layoutNodes.push({
      id: input.id,
      kind: input.kind,
      order: layoutOrder,
      minRank: input.minRank,
      ...size,
    });
    layoutOrder += 1;
    layoutNodeIds.add(input.id);
  };

  if (normalized.prompt) {
    pushLayoutNode({
      id: normalized.prompt.id,
      kind: "prompt",
      detail: normalized.prompt.detail,
      minRank: 0,
    });
  }
  pushLayoutNode({
    id: normalized.topic.id,
    kind: "topic",
    detail: normalized.topic.detail,
    minRank: normalized.prompt ? 1 : 0,
  });
  for (const item of allStructuredNodes) {
    pushLayoutNode({
      id: item.id,
      kind: item.type,
      detail: item.detail,
    });
  }
  for (const scenarioView of normalized.scenarioViews) {
    const scenarioSource =
      scenarioView.nodeIds.find((nodeId) => layoutNodeIds.has(nodeId)) ??
      normalized.topic.id;
    const scenarioNodeId = `scenario:${scenarioView.id}`;
    scenarioSourceById.set(scenarioView.id, scenarioSource);
    pushLayoutNode({
      id: scenarioNodeId,
      kind: "scenario",
      detail: scenarioView.summary,
    });
    layoutEdges.push({
      source: scenarioSource,
      target: scenarioNodeId,
    });
  }
  for (const path of normalized.paths) {
    const pathNodeId = `path:${path.id}`;
    const relatedNodes = allStructuredNodes.filter((node) =>
      pathIncludesNode(path, node, edgeById),
    );
    pathRelatedNodesById.set(path.id, relatedNodes);
    const pathSourceNode =
      relatedNodes.find((node) => node.type === "conclusion") ??
      relatedNodes.find((node) => node.type === "risk") ??
      relatedNodes[relatedNodes.length - 1];
    const parentScenario = normalized.scenarioViews.find((scenarioView) =>
      scenarioView.pathIds.includes(path.id),
    );
    const pathSource = parentScenario
      ? `scenario:${parentScenario.id}`
      : pathSourceNode?.id ?? normalized.topic.id;
    pathSourceById.set(path.id, pathSource);
    pushLayoutNode({
      id: pathNodeId,
      kind: "path",
      detail: path.summary,
    });
    layoutEdges.push({
      source: pathSource,
      target: pathNodeId,
    });
  }
  if (normalized.prompt) {
    layoutEdges.push({
      source: normalized.prompt.id,
      target: normalized.topic.id,
    });
  }
  for (const edge of normalized.edges) {
    layoutEdges.push({ source: edge.source, target: edge.target });
  }
  for (const item of allStructuredNodes) {
    const hasIncoming = normalized.edges.some((edge) => edge.target === item.id);
    if (!hasIncoming) {
      layoutEdges.push({ source: normalized.topic.id, target: item.id });
    }
  }
  const dependencyPositions = computeDependencyLayout({
    nodes: layoutNodes,
    edges: layoutEdges,
  });
  const addNode = (
    node: Omit<CanvasFlowNode, "type"> & { type?: CanvasFlowNode["type"] },
  ) => {
    const manualPosition = manualPositions[node.id];
    const isSelected = selectedNodeId === node.id || selectedNodeIds.has(node.id);
    const isPathHighlighted =
      Boolean(node.data.isSelected) ||
      Boolean(selectedScenarioView?.nodeIds.includes(node.id)) ||
      Boolean(
        node.id.startsWith("path:") &&
          selectedScenarioView?.pathIds.includes(node.id.slice("path:".length)),
      );
    const estimatedSize = estimatedLayoutSize({
      kind: node.data.kind,
      detail: node.data.detail,
      topicDefinitionPhase: node.data.topicDefinitionPhase,
      questionCount:
        node.data.entryRequirementsPart?.questions.length ??
        entryRequirementsPart?.questions.length,
    });
    const flowNode: CanvasFlowNode = {
      ...node,
      position: manualPosition ?? node.position,
      type: "simulation",
      initialWidth: node.initialWidth ?? estimatedSize.width,
      initialHeight: node.initialHeight ?? estimatedSize.height,
      selected: isSelected,
      data: {
        ...node.data,
        isSelected,
        isPathHighlighted,
        isManualPosition: Boolean(manualPosition),
        onToolbarAction: onNodeToolbarAction,
        onNodeSelect,
        onQuestionDefinitionAction,
        showInspectAction: !(
          embedded && isQuestionLayerNodeData(node.data.kind, node.data)
        ),
      },
    };
    nodes.push(flowNode);
    knownNodeIds.add(flowNode.id);
    sourceById.set(flowNode.id, flowNode.data);
  };
  const addEdge = ({
    id,
    source,
    target,
    kind,
    label,
    relationType = "system",
    selected = false,
    animated = false,
    strokeDasharray,
  }: {
    id: string;
    source: string;
    target: string;
    kind: CanvasKind;
    label?: string;
    relationType?: CanvasEdgeData["relationType"];
    selected?: boolean;
    animated?: boolean;
    strokeDasharray?: string;
  }) => {
    const isSelected = selectedEdgeId === id;
    const isHighlighted =
      selected || selectedNodeId === source || selectedNodeId === target;
    const active = isSelected || isHighlighted;
    const sourceLabel = sourceById.get(source)?.label ?? source;
    const targetLabel = sourceById.get(target)?.label ?? target;
    edges.push({
      id,
      source,
      target,
      type: "simulation",
      animated,
      label,
      selected: isSelected,
      style: {
        ...edgeStyle(kind, active),
        strokeDasharray,
      },
      data: {
        kind,
        label,
        relationType,
        isSelected: active,
        sourceLabel,
        targetLabel,
        onInsertNode: onInsertEdgeNode,
      },
    });
  };

  if (normalized.prompt) {
    const promptText = promptDisplayText(normalized.prompt);
    addNode({
      id: normalized.prompt.id,
      position:
        dependencyPositions.get(normalized.prompt.id) ?? { x: 32, y: questionLayerY },
      data: {
        label: normalized.prompt.label || "用户原问题",
        detail: normalized.prompt.detail ?? promptText,
        kind: "prompt",
        source: normalized.prompt,
      },
    });
  }

addNode({
    id: normalized.topic.id,
    position:
      dependencyPositions.get(normalized.topic.id) ?? { x: 440, y: questionLayerY },
    data: {
      label: shortLabel(normalized.topic.label, 74),
      detail: normalized.topic.detail,
      kind: "topic",
      source: normalized.topic,
      ...(topicDefinitionPhase
        ? {
            topicDefinitionPhase,
            isReplying,
            requirementSummaryPart,
            entryRequirementsPart:
              topicDefinitionPhase === "form" ? entryRequirementsPart : undefined,
            onRequirementsSubmitted,
            onRequirementsDraftChange,
            onRequirementsContinue,
          }
        : { dependencyLabel: "问题层" }),
    },
  });

  if (normalized.prompt) {
    addEdge({
      id: `${normalized.prompt.id}-${normalized.topic.id}`,
      source: normalized.prompt.id,
      target: normalized.topic.id,
      kind: "topic",
      label: "理解问题",
    });
  }

  for (const item of allStructuredNodes) {
    const upstreamCount = normalized.edges.filter((edge) => edge.target === item.id).length;
    addNode({
      id: item.id,
      position:
        dependencyPositions.get(item.id) ?? { x: 690, y: CANVAS_NODE_TOP },
      data: {
        label: item.label,
        detail: item.detail,
        kind: item.type,
        source: item,
        dependencyLabel:
          upstreamCount > 0 ? `${upstreamCount} 依赖` : undefined,
      },
    });
  }

  for (const item of allStructuredNodes) {
    if (normalized.edges.some((edge) => edge.target === item.id || edge.source === item.id)) {
      continue;
    }
    addEdge({
      id: `topic-${item.id}`,
      source: normalized.topic.id,
      target: item.id,
      kind: item.type,
      label: "展开",
    });
  }

  for (const edge of normalized.edges) {
    if (!knownNodeIds.has(edge.source) || !knownNodeIds.has(edge.target)) {
      continue;
    }
    const targetData = sourceById.get(edge.target);
    const selectedByScenario = Boolean(selectedScenarioView?.edgeIds.includes(edge.id));
    addEdge({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: targetData?.kind ?? "entity",
      label: edge.label,
      relationType: edge.type,
      animated:
        selectedByScenario ||
        selectedNodeId === edge.source ||
        selectedNodeId === edge.target,
      selected: selectedByScenario || selectedNodeId === edge.target,
    });
  }

  normalized.scenarioViews.forEach((scenarioView, index) => {
    const selected = selectedPathId === scenarioView.id;
    const id = `scenario:${scenarioView.id}`;
    addNode({
      id,
      position:
        dependencyPositions.get(id) ?? {
          x: 1960,
          y: CANVAS_NODE_TOP + index * CANVAS_NODE_ROW_STEP,
        },
      data: {
        label: scenarioView.label,
        detail: scenarioView.summary,
        kind: "scenario",
        scenarioView,
        dependencyLabel: `${scenarioView.nodeIds.length} 节点`,
        isSelected: selected,
      },
    });
    addEdge({
      id: `scenario-edge-${scenarioView.id}`,
      source: scenarioSourceById.get(scenarioView.id) ?? normalized.topic.id,
      target: id,
      kind: "scenario",
      label: "情景",
      relationType: "scenario",
      animated: selected,
      selected,
    });
  });

  normalized.paths.forEach((path, index) => {
    const selected = selectedPathId === path.id;
    const id = `path:${path.id}`;
    const relatedNodes = pathRelatedNodesById.get(path.id) ?? [];
    addNode({
      id,
      position:
        dependencyPositions.get(id) ?? {
          x: 1960,
          y:
            CANVAS_NODE_TOP +
            normalized.scenarioViews.length * CANVAS_NODE_ROW_STEP +
            index * CANVAS_NODE_ROW_STEP,
        },
      data: {
        label: path.label,
        detail: path.summary,
        kind: "path",
        source: path,
        dependencyLabel: `${relatedNodes.length} 节点`,
        isSelected: selected,
      },
    });

    addEdge({
      id: `path-edge-${path.id}`,
      source: pathSourceById.get(path.id) ?? normalized.topic.id,
      target: id,
      kind: "path",
      label: "路径",
      relationType: "path",
      animated: selected,
      selected,
    });
  });

  const aiColumnX = AI_COLUMN_X;
  let aiNodeY = CANVAS_NODE_TOP;
  const nextAiPosition = () => {
    const position = { x: aiColumnX, y: aiNodeY };
    aiNodeY += CANVAS_NODE_ROW_STEP;
    return position;
  };
  const aiNodes: CanvasFlowNode[] = [];
  const currentRoundId =
    normalized.topic.roundId ??
    normalized.prompt?.roundId ??
    allStructuredNodes[0]?.roundId ??
    "round_1";
  const historyRoundNumber = /^round_(\d+)$/.exec(currentRoundId)?.[1];
  const showHistoryNode =
    historyRoundNumber != null && Number(historyRoundNumber) >= 2;
  const interventionLines = interventionSummaryLines(normalized.interventions);
  if (showHistoryNode) {
    aiNodes.push({
      id: `history:${currentRoundId}`,
      type: "simulation",
      position: nextAiPosition(),
      data: {
        label: `当前轮次 ${currentRoundId}`,
        detail:
          [
            "这是当前查看的推演轮次。历史版本可用于回看问题边界、变量假设和路径差异。",
            interventionLines.length
              ? `最近干预：${interventionLines.join("；")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
        kind: "history",
        dependencyLabel: currentRoundId,
      },
    });
  }
  summaries.forEach((summary, index) => {
    aiNodes.push({
      id: `summary:${summary.id}`,
      type: "simulation",
      position: nextAiPosition(),
      data: {
        label: `第 ${index + 1} 轮总结`,
        detail: markdownPlainText(summary.markdown),
        kind: "summary",
        summary,
        dependencyLabel: summary.conclusionIds?.length
          ? `${summary.conclusionIds.length} 结论`
          : "汇总",
      },
    });
  });
  suggestions
    .flatMap((part) => part.suggestions ?? [])
    .forEach((suggestion) => {
    aiNodes.push({
      id: `suggestion:${suggestion.suggestionId}`,
      type: "simulation",
      position: nextAiPosition(),
      data: {
        label: suggestion.title,
        detail: suggestion.description,
        kind: "suggestion",
        suggestion,
        dependencyLabel: suggestion.basedOnConclusionId ? "来自结论" : "续推",
      },
    });
    });
  suggestions
    .flatMap((part) => part.nextActions ?? [])
    .forEach((nextAction) => {
      aiNodes.push({
        id: `next_action:${nextAction.actionId}`,
        type: "simulation",
        position: nextAiPosition(),
        data: {
          label: nextAction.title,
          detail: nextAction.description,
          kind: "next_action",
          nextAction,
          dependencyLabel: nextAction.basedOnConclusionId ? "来自结论" : "可执行",
        },
      });
    });
  const showReportNodes =
    !isTopicDefinitionPending(normalized.topic) && normalized.paths.length > 0;
  if (showReportNodes) {
    deliverables.forEach((part) => {
      const primaryPath =
        part.primaryPath ??
        part.items.find((item) => item.kind === "primary")?.path ??
        part.items[0]?.path;
      aiNodes.push({
        id: `report:${part.id}`,
        type: "simulation",
        position: nextAiPosition(),
        data: {
          label: primaryPath
            ? shortLabel(primaryPath.split(/[\\/]/).pop() ?? primaryPath, 46)
            : "推演报告",
          detail: primaryPath ?? "报告已写入本地工作区",
          kind: "report",
          deliverables: part,
          dependencyLabel: "产物",
        },
      });
    });
  }
  errors.forEach((error) => {
    aiNodes.push({
      id: `recovery:${error.id}`,
      type: "simulation",
      position: nextAiPosition(),
      data: {
        label: "推演处理中断",
        detail: error.message,
        kind: "recovery",
        error,
        dependencyLabel: "可恢复",
      },
    });
  });

  aiNodes.forEach((node, index) => {
    addNode(node);
    const preferredConclusionId =
      node.data.summary?.conclusionIds?.find((id) => knownNodeIds.has(id)) ??
      node.data.suggestion?.basedOnConclusionId ??
      node.data.nextAction?.basedOnConclusionId;
    const source =
      preferredConclusionId && knownNodeIds.has(preferredConclusionId)
        ? preferredConclusionId
        : node.data.kind === "history"
          ? normalized.topic.id
        : normalized.paths[index % Math.max(1, normalized.paths.length)]
        ? `path:${normalized.paths[index % normalized.paths.length]!.id}`
        : normalized.topic.id;
    addEdge({
      id: `ai-${node.id}`,
      source,
      target: node.id,
      kind: node.data.kind,
      label: node.data.kind === "history" ? "轮次" : "输出",
      relationType: "output",
      animated: node.data.kind === "recovery",
      selected: node.data.kind === "recovery",
      strokeDasharray:
        node.data.kind === "summary" || node.data.kind === "report"
          ? "6 5"
          : undefined,
    });
  });

  for (const edge of edges) {
    sourceCounts.set(edge.source, (sourceCounts.get(edge.source) ?? 0) + 1);
  }
  for (const node of nodes) {
    if (node.data.dependencyLabel || !sourceCounts.has(node.id)) continue;
    const nextData = {
      ...node.data,
      dependencyLabel: `${sourceCounts.get(node.id)} 下游`,
    };
    node.data = nextData;
    sourceById.set(node.id, nextData);
  }

  return { nodes, edges, sourceById };
}

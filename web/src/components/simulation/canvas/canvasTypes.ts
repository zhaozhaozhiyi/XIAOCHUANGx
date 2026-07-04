import type { Edge, Node } from "@xyflow/react";
import type {
  ChatPart,
  DeliverablesPart,
  ErrorPart,
  SimulationEdge,
  SimulationIntervention,
  SimulationNode,
  SimulationPath,
  SimulationScenarioPart,
  SimulationSuggestionPart,
  SimulationSummaryPart,
} from "@/lib/chat-parts";
import type { SimulationRequirementsPart } from "@/components/simulation/SimulationEntryRequirementsCard";

export type Scenario = SimulationScenarioPart["scenario"];
export type TopicDefinitionPhase = "analyzing" | "form" | "confirmed";
export type SimulationRequirementSummaryPart = Extract<
  ChatPart,
  { kind: "simulation_requirement_summary" }
>;
export type CanvasAiKind = "summary" | "report" | "recovery";
export type CanvasKind = "topic" | SimulationNode["type"] | "path" | CanvasAiKind;
export type ScenarioView = NonNullable<Scenario["scenarios"]>[number];
export type CanvasPosition = { x: number; y: number };
export type ManualNodePositions = Record<string, CanvasPosition>;
export type CanvasNodeToolbarActionId = "inspect" | "expand" | "copy";
export type QuestionDefinitionActionId = "confirm" | "edit";
export type CanvasInsertNodeType =
  | "entity"
  | "variable"
  | "event"
  | "evidence"
  | "hypothesis"
  | "inference"
  | "risk"
  | "decision"
  | "action"
  | "conclusion";

export type EdgeInsertRequest = {
  edgeId: string;
  insertType: CanvasInsertNodeType;
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  edgeLabel?: string;
};

export type AlignmentGuideState = {
  horizontal?: { y: number; x1: number; x2: number };
  vertical?: { x: number; y1: number; y2: number };
};

export type NormalizedScenario = {
  prompt?: SimulationNode;
  topic: SimulationNode;
  nodes: SimulationNode[];
  edges: SimulationEdge[];
  paths: SimulationPath[];
  scenarioViews: ScenarioView[];
  interventions: SimulationIntervention[];
};

export type CanvasNodeData = {
  label: string;
  detail?: string;
  kind: CanvasKind;
  source?: SimulationNode | SimulationPath;
  summary?: SimulationSummaryPart;
  suggestion?: NonNullable<SimulationSuggestionPart["suggestions"]>[number];
  nextAction?: NonNullable<SimulationSuggestionPart["nextActions"]>[number];
  scenarioView?: ScenarioView;
  deliverables?: DeliverablesPart;
  error?: ErrorPart;
  dependencyLabel?: string;
  isSelected?: boolean;
  isPathHighlighted?: boolean;
  isManualPosition?: boolean;
  onToolbarAction?: (
    action: CanvasNodeToolbarActionId,
    nodeId: string,
  ) => void;
  onNodeSelect?: (nodeId: string, additive?: boolean) => void;
  onQuestionDefinitionAction?: (
    nodeId: string,
    action: QuestionDefinitionActionId,
  ) => void;
  entryRequirementsPart?: SimulationRequirementsPart;
  requirementSummaryPart?: SimulationRequirementSummaryPart;
  topicDefinitionPhase?: TopicDefinitionPhase;
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
  showInspectAction?: boolean;
};

export type CanvasFlowNode = Node<CanvasNodeData, "simulation">;

export type CanvasEdgeData = Record<string, unknown> & {
  kind: CanvasKind;
  relationType?: SimulationEdge["type"] | "system" | "scenario" | "path" | "output";
  label?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  sourceLabel?: string;
  targetLabel?: string;
  onInsertNode?: (request: EdgeInsertRequest) => void;
};

export type CanvasFlowEdge = Edge<CanvasEdgeData, "simulation">;

export type DetailRow = {
  label: string;
  value: string;
};

export type TopicAnalysisStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
};

export type ScenarioDiff = {
  baseline?: ScenarioView;
  addedNodes: string[];
  removedNodes: string[];
  addedEdges: string[];
  removedEdges: string[];
  addedPaths: string[];
  removedPaths: string[];
};

export type InterventionImpact = {
  downstreamNodes: SimulationNode[];
  affectedEdges: SimulationEdge[];
  affectedPaths: SimulationPath[];
  affectedScenarios: ScenarioView[];
  // F2: 下游中应在重算时被标记为 historical/updated 的候选节点。
  // 排除 locked 节点（受 preserving-upstream 保护，不自动作废）。
  // 用于向 AI 明确告知哪些节点需要重新评估，驱动 wave-protocol 的 rerun 语义。
  staleCandidates: SimulationNode[];
};

export type CanvasLayerId =
  | "all"
  | "question"
  | "world"
  | "variable"
  | "reasoning"
  | "evidence"
  | "riskDecision"
  | "scenario"
  | "output";

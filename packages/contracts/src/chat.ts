import { z } from "zod";
import type { ArtifactManifest } from "./artifact-manifest";

/** 对话消息块协议版本（持久化、SSE part 事件共用） */
export const CHAT_PARTS_PROTOCOL_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Zones — 对话区两大展示分区（Summary-first + Activity collapsible）
// ---------------------------------------------------------------------------

export const chatPartZoneSchema = z.enum(["summary", "activity"]);
export type ChatPartZone = z.infer<typeof chatPartZoneSchema>;

export const chatPartPresentationRoleSchema = z.enum([
  "process",
  "checkpoint",
  "result",
  "deliverable",
  "technical",
]);
export type ChatPartPresentationRole = z.infer<
  typeof chatPartPresentationRoleSchema
>;

export const assistantSegmentRoleSchema = z.enum([
  "pending",
  "process",
  "final",
]);
export type AssistantSegmentRole = z.infer<typeof assistantSegmentRoleSchema>;

export const assistantSegmentOperationSchema = z.enum([
  "start",
  "delta",
  "commit",
]);
export type AssistantSegmentOperation = z.infer<
  typeof assistantSegmentOperationSchema
>;

export type AssistantSegmentPayload = {
  segmentId: string;
  operation: AssistantSegmentOperation;
  role: AssistantSegmentRole;
  text?: string;
  /** Canonical order assigned when the event enters the unified run stream. */
  streamSeq?: number;
};

// ---------------------------------------------------------------------------
// Part kinds — 分类型 UI 渲染键
// ---------------------------------------------------------------------------

export const chatPartKindSchema = z.enum([
  /** 最终答案 / 主正文 Markdown（summary 区） */
  "summary",
  /** 流式正文片段，run 结束后可合并入 summary */
  "text",
  /** 面向用户的过程说明 / agent commentary */
  "narration",
  /** 加载或启用的 Skill */
  "skill",
  /** 推理 / 思考链（深度模式） */
  "reasoning",
  /** 阶段标签：检索 → 分析 → 生成 */
  "status",
  /** 工具调用（泛型，含 read/write/bash 等） */
  "tool",
  /** 聚合工具卡（Explored / Listed / Ran） */
  "tool_batch",
  /** 整轮耗时与状态 */
  "turn_meta",
  /** 状态芯片 waiting_user 等 */
  "status_chip",
  /** Shell 命令块 */
  "command",
  /** 读文件 */
  "file_read",
  /** 读文档 */
  "document_read",
  /** 写文件 / diff */
  "file_edit",
  /** 编辑文档 */
  "document_edit",
  /** Agent Todo 列表 */
  "todo",
  /** 需要用户补充信息 */
  "clarification",
  /** 写作需求采集卡（AI to UI） */
  "writing_requirements",
  /** 写作需求摘要 */
  "writing_requirement_summary",
  /** 写作大纲 */
  "writing_outline",
  /** PPT 需求采集卡（AI to UI） */
  "ppt_requirements",
  /** PPT 需求摘要 */
  "ppt_requirement_summary",
  /** PPT 页纲 */
  "ppt_outline",
  /** 3D 需求采集卡（AI to UI） */
  "3d_requirements",
  /** 3D 需求摘要 */
  "3d_requirement_summary",
  /** 3D 方案 / 结构卡 */
  "3d_outline",
  /** 视频 P0 需求采集卡（复用通用 Requirements UI） */
  "video_requirements",
  /** 视频 P0 需求摘要 */
  "video_requirement_summary",
  /** 视频 P0 网页视频 outline */
  "video_outline",
  /** 推演需求采集卡（AI to UI） */
  "simulation_requirements",
  /** 推演需求摘要 */
  "simulation_requirement_summary",
  /** 推演初始沙盘结构 */
  "simulation_scenario",
  /** 推演画布节点 */
  "simulation_node",
  /** 推演画布边 */
  "simulation_edge",
  /** 推演路径 */
  "simulation_path",
  /** 推演总结 */
  "simulation_summary",
  /** 推演下一步可执行动作 */
  "simulation_next_action",
  /** 后续推演建议 */
  "simulation_suggestion",
  /** 数据源、文件、外部材料等可溯源引用 */
  "citation",
  /** 工作区产出物链接 */
  "artifact",
  /** 本轮成品列表（主交付 + 附件） */
  "deliverables",
  /** 行内错误（不阻断整轮） */
  "error",
  /** JSON / 结构化预览 */
  "json",
  /** 图片 */
  "image",
  /** 图表（V1.1） */
  "chart",
  /** 深度研究导图 */
  "research_map",
]);
export type ChatPartKind = z.infer<typeof chatPartKindSchema>;

// ---------------------------------------------------------------------------
// Per-kind payloads（ discriminated union on `kind` ）
// ---------------------------------------------------------------------------

export type ChatPartBase = {
  id: string;
  zone: ChatPartZone;
  kind: ChatPartKind;
  /** Stable source segment for provisional process -> final reclassification. */
  segmentId?: string;
  /** Business placement; old records fall back to a deterministic kind mapping. */
  presentationRole?: ChatPartPresentationRole;
  /** SSE 追加顺序（交错时间线排序） */
  streamSeq?: number;
  /** 流式进行中 */
  streaming?: boolean;
  /** 完成时间戳 ms；用于折叠默认态 */
  completedAt?: number;
};

export type SummaryPart = ChatPartBase & {
  kind: "summary";
  zone: "summary";
  markdown: string;
};

export type TextPart = ChatPartBase & {
  kind: "text";
  zone: "summary";
  markdown: string;
};

export type NarrationPart = ChatPartBase & {
  kind: "narration";
  zone: "activity";
  markdown: string;
};

export type SkillPart = ChatPartBase & {
  kind: "skill";
  zone: "activity";
  slug: string;
  label?: string;
  role?: "process" | "platform" | "catalog" | "injected";
};

export type ReasoningPart = ChatPartBase & {
  kind: "reasoning";
  zone: "activity";
  markdown: string;
};

export type StatusPart = ChatPartBase & {
  kind: "status";
  zone: "activity";
  label: string;
  phase?: string;
};

export type ToolPart = ChatPartBase & {
  kind: "tool";
  zone: "activity";
  tool: string;
  status?: "pending" | "running" | "success" | "error" | "cancelled";
  message?: string;
  callId?: string;
  input?: unknown;
  output?: unknown;
};

export type ToolBatchItem = {
  tool: string;
  status?: "pending" | "running" | "success" | "error" | "cancelled";
  message?: string;
};

export type ToolBatchPart = ChatPartBase & {
  kind: "tool_batch";
  zone: "activity";
  title: string;
  items: ToolBatchItem[];
};

export type TurnMetaPart = ChatPartBase & {
  kind: "turn_meta";
  zone: "activity";
  durationMs?: number;
  label?: string;
  runStatus?: "running" | "complete" | "waiting_user" | "cancelled";
};

export type StatusChipPart = ChatPartBase & {
  kind: "status_chip";
  zone: "activity" | "summary";
  chip: string;
};

export type CommandPart = ChatPartBase & {
  kind: "command";
  zone: "activity";
  command: string;
  callId?: string;
  status?: ToolPart["status"];
  exitCode?: number | null;
  stdoutPreview?: string;
  stderrPreview?: string;
};

export type FileReadPart = ChatPartBase & {
  kind: "file_read";
  zone: "activity";
  path: string;
  callId?: string;
  status?: ToolPart["status"];
  lineRange?: { start: number; end: number };
};

export type DocumentReadPart = ChatPartBase & {
  kind: "document_read";
  zone: "activity";
  path: string;
  callId?: string;
  status?: ToolPart["status"];
  docType: string;
};

export type FileEditPart = ChatPartBase & {
  kind: "file_edit";
  zone: "activity";
  path: string;
  callId?: string;
  status?: ToolPart["status"];
  additions?: number;
  deletions?: number;
  /** 大 diff 仅存摘要，详情跳转工作区 */
  diffPreview?: string;
};

export type DocumentEditPart = ChatPartBase & {
  kind: "document_edit";
  zone: "activity";
  path: string;
  callId?: string;
  status?: ToolPart["status"];
  docType: string;
  additions?: number;
  deletions?: number;
  diffPreview?: string;
};

export type TodoItem = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
};
export const chatTodoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
});

export type TodoPart = ChatPartBase & {
  kind: "todo";
  zone: "activity";
  items: TodoItem[];
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  header?: string;
  options?: Array<{ label: string; description?: string }>;
  multiSelect?: boolean;
};

export type ClarificationPart = ChatPartBase & {
  kind: "clarification";
  zone: "summary";
  runId: string;
  clarificationId: string;
  toolUseId: string;
  question: string;
  questions: ClarificationQuestion[];
  selectedOptions?: Record<string, string[]>;
  draft?: string;
  submitted?: boolean;
  answer?: string;
};

export type StructuredQuestionOption = {
  label: string;
  description?: string;
};

export type StructuredQuestion = {
  id: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "single_select"
    | "multi_select"
    | "date"
    | "time"
    | "datetime"
    | "number"
    | "file_pick"
    | "file_upload";
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: StructuredQuestionOption[];
};

export type RequirementsPart = ChatPartBase & {
  kind:
    | "writing_requirements"
    | "ppt_requirements"
    | "3d_requirements"
    | "video_requirements"
    | "simulation_requirements";
  zone: "summary";
  runId?: string;
  toolUseId?: string;
  title: string;
  description?: string;
  questions: StructuredQuestion[];
  selectedOptions?: Record<string, string[]>;
  answers?: Record<string, string>;
  submitted?: boolean;
  answer?: string;
};

export type RequirementSummaryPart = ChatPartBase & {
  kind:
    | "writing_requirement_summary"
    | "ppt_requirement_summary"
    | "3d_requirement_summary"
    | "video_requirement_summary"
    | "simulation_requirement_summary";
  zone: "summary";
  title?: string;
  markdown: string;
};

export type OutlineSource = "ai" | "user";

export type WritingOutlineSection = {
  id: string;
  title: string;
  bullets: string[];
};

export type WritingOutlineData = {
  version: 1;
  source: OutlineSource;
  committed: boolean;
  sections: WritingOutlineSection[];
};

export type PptOutlineSlide = {
  id: string;
  title: string;
  bullets: string[];
};

export type PptOutlineData = {
  version: 1;
  source: OutlineSource;
  committed: boolean;
  slides: PptOutlineSlide[];
};

export type WritingOutlinePart = ChatPartBase & {
  kind: "writing_outline";
  zone: "summary";
  title?: string;
  markdown: string;
  outline?: WritingOutlineData;
};

export type PptOutlinePart = ChatPartBase & {
  kind: "ppt_outline";
  zone: "summary";
  title?: string;
  coverTitle?: string;
  markdown: string;
  outline?: PptOutlineData;
};

export type IndustrialDrawingOutlineData = {
  version: 1;
  source: OutlineSource;
  committed: boolean;
  title: string;
  blocks: Array<{
    id: string;
    title: string;
    bullets: string[];
  }>;
};

export type IndustrialDrawingOutlinePart = ChatPartBase & {
  kind: "3d_outline";
  zone: "summary";
  title?: string;
  markdown: string;
  outline?: IndustrialDrawingOutlineData;
};

export type VideoOutlineData = {
  version: 1;
  source: OutlineSource;
  committed: boolean;
  title: string;
  blocks: Array<{
    id: string;
    title: string;
    bullets: string[];
  }>;
};

export type VideoOutlinePart = ChatPartBase & {
  kind: "video_outline";
  zone: "summary";
  title?: string;
  markdown: string;
  outline?: VideoOutlineData;
};

export type OutlinePart =
  | WritingOutlinePart
  | PptOutlinePart
  | IndustrialDrawingOutlinePart
  | VideoOutlinePart;

export type SimulationNodeType =
  | "prompt"
  | "topic"
  | "entity"
  | "variable"
  | "event"
  | "conclusion"
  | "risk"
  | "evidence"
  | "hypothesis"
  | "inference"
  | "decision"
  | "action"
  | "scenario"
  | "summary"
  | "report"
  | "next_action"
  | "history"
  | "recovery"
  | "suggestion";

export type SimulationStageId =
  | "question"
  | "entity"
  | "hypothesis"
  | "variable"
  | "risk"
  | "reasoning"
  | "scenario"
  | "output";

export type SimulationStageStatus =
  | "idle"
  | "generating"
  | "awaiting_confirmation"
  | "confirmed"
  | "failed";

export type SimulationStageState = {
  current: SimulationStageId;
  status: SimulationStageStatus;
  completed: SimulationStageId[];
  awaitingConfirmation?: boolean;
  message?: string;
  waveId?: string;
};

export type SimulationEdgeType =
  | "causal"
  | "temporal"
  | "evidence_support";

export type SimulationValueSchema = {
  kind: "number" | "enum" | "boolean" | "priority" | "datetime";
  range?: [number, number];
  options?: string[];
  unit?: string;
};

export type SimulationNode = {
  id: string;
  type: SimulationNodeType;
  label: string;
  detail?: string;
  roundId: string;
  pathIds?: string[];
  stage?: SimulationStageId;
  status?: "draft" | "pending" | "active" | "confirmed" | "updated" | "historical" | "failed";
  data?: Record<string, unknown>;
  locked?: boolean;
  value?: unknown;
  defaultValue?: unknown;
  valueSchema?: SimulationValueSchema;
  evidenceSource?: string;
  evidenceCredibility?: "high" | "medium" | "low";
};

export type SimulationEdge = {
  id: string;
  type: SimulationEdgeType;
  source: string;
  target: string;
  label?: string;
  roundId: string;
};

export type SimulationPath = {
  id: string;
  label: string;
  probability?: number;
  status: "available" | "selected" | "excluded" | "locked";
  edgeIds: string[];
  summary?: string;
  roundId: string;
  excludedReason?: string;
};

export type SimulationScenarioView = {
  id: string;
  label: string;
  status: "available" | "selected" | "excluded" | "locked";
  pathIds: string[];
  nodeIds: string[];
  edgeIds: string[];
  probability?: number;
  summary?: string;
  roundId: string;
};

export type SimulationSelectionType =
  | "entry"
  | "path"
  | "variable"
  | "scenario"
  | "inspect"
  | "report";

export type SimulationSelectionResult = {
  id: string;
  type: SimulationSelectionType;
  targetId?: string;
  value?: unknown;
  roundId: string;
  createdAt: string;
};

export type SimulationActionRecord = {
  id: string;
  type: string;
  targetId?: string;
  payload?: unknown;
  roundId: string;
  createdAt: string;
};

export type SimulationInterventionKind =
  | "node_expand"
  | "prompt_reparse"
  | "topic_confirm"
  | "topic_edit"
  | "entity_update"
  | "variable_override"
  | "event_assumption"
  | "evidence_update"
  | "hypothesis_update"
  | "inference_rerun"
  | "inference_challenge"
  | "risk_mitigate"
  | "risk_stress_test"
  | "decision_select"
  | "action_simulate"
  | "conclusion_challenge"
  | "path_continue"
  | "scenario_continue"
  | "scenario_compare"
  | "scenario_counterfactual"
  | "summary_continue"
  | "report_update"
  | "next_action_execute"
  | "history_restore"
  | "recovery_retry";

export type SimulationImpactPreview = {
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  affectedPathIds?: string[];
  affectedScenarioIds: string[];
  affectedNodeLabels?: string[];
  affectedEdgeLabels?: string[];
  affectedPathLabels?: string[];
  affectedScenarioLabels?: string[];
  reason?: string;
};

export type SimulationIntervention = {
  id: string;
  kind: SimulationInterventionKind;
  sourceNodeId: string;
  sourceNodeType: SimulationNodeType | "path" | "edge";
  roundId: string;
  scenarioId?: string;
  pathId?: string;
  stageId?: SimulationStageId;
  waveId?: string;
  payload?: Record<string, unknown>;
  impactPreview?: SimulationImpactPreview;
  requiresConfirmation: boolean;
  createdAt: string;
};

export type CanvasSnapshot = {
  roundId: string;
  parentRoundId?: string;
  promptNodeId?: string;
  topicNodeId?: string;
  nodes: SimulationNode[];
  edges: SimulationEdge[];
  scenarios?: SimulationScenarioView[];
  paths: SimulationPath[];
  selections: SimulationSelectionResult[];
  actions: SimulationActionRecord[];
  interventions?: SimulationIntervention[];
  stageState?: SimulationStageState;
  provenance?: SimulationScenarioProvenance;
  createdAt: string;
};

export type SimulationTopicDefinition = {
  problem: string;
  goal?: string;
  timeRange?: string;
  spaceRange?: string;
  industry?: string;
  state?:
    | "understanding"
    | "waiting_boundary_confirmation"
    | "modeling_world"
    | "identifying_variables"
    | "generating_scenarios"
    | "waiting_next_action"
    | "completed";
};

export type SimulationScenarioProvenance = {
  source: "llm" | "mock" | "fallback" | "progressive_preview";
  label?: string;
  reason?: string;
  warning?: string;
  generatedAt?: string;
};

export type SimulationScenarioPart = ChatPartBase & {
  kind: "simulation_scenario";
  zone: "summary";
  title?: string;
  scenario: {
    prompt?: SimulationNode;
    topic: string | SimulationNode;
    topicDefinition?: SimulationTopicDefinition;
    nodes?: SimulationNode[];
    scenarios?: SimulationScenarioView[];
    entities: SimulationNode[];
    variables: SimulationNode[];
    assumptions?: string[];
    paths: SimulationPath[];
    edges: SimulationEdge[];
    interventions?: SimulationIntervention[];
    stageState?: SimulationStageState;
    provenance?: SimulationScenarioProvenance;
    roundId?: string;
  };
};

export type SimulationNodePart = ChatPartBase & {
  kind: "simulation_node";
  zone: "activity";
  node: SimulationNode;
};

export type SimulationEdgePart = ChatPartBase & {
  kind: "simulation_edge";
  zone: "activity";
  edge: SimulationEdge;
};

export type SimulationPathPart = ChatPartBase & {
  kind: "simulation_path";
  zone: "summary";
  path: SimulationPath;
};

export type SimulationSummaryPart = ChatPartBase & {
  kind: "simulation_summary";
  zone: "summary";
  roundId: string;
  markdown: string;
  conclusionIds?: string[];
};

export type SimulationSuggestionPart = ChatPartBase & {
  kind: "simulation_suggestion" | "simulation_next_action";
  zone: "summary";
  suggestions?: Array<{
    suggestionId: string;
    title: string;
    description: string;
    basedOnConclusionId?: string;
  }>;
  nextActions?: Array<{
    actionId: string;
    title: string;
    description: string;
    actionType:
      | "continue"
      | "add_data"
      | "add_entity"
      | "add_variable"
      | "rerun_inference"
      | "generate_report";
    targetId?: string;
    basedOnConclusionId?: string;
    expectedEffect?: string;
  }>;
};

export type SimulationPart =
  | SimulationScenarioPart
  | SimulationNodePart
  | SimulationEdgePart
  | SimulationPathPart
  | SimulationSummaryPart
  | SimulationSuggestionPart;

export type CitationPart = ChatPartBase & {
  kind: "citation";
  zone: "summary";
  title: string;
  source: string;
  url?: string;
  snippet?: string;
};

export type ArtifactPart = ChatPartBase & {
  kind: "artifact";
  zone: "summary";
  path: string;
  label?: string;
  mime?: string;
};

export type DeliverableItem = {
  path: string;
  label?: string;
  mime?: string;
  kind?: "primary" | "attachment" | "directory";
  workspaceProjectId?: string;
  previewUrl?: string;
  recordingUrl?: string;
  devCommand?: string;
  devServerStatus?: "running" | "unknown";
};

export type DeliverablesPart = ChatPartBase & {
  kind: "deliverables";
  zone: "summary";
  headline?: string;
  primaryPath?: string;
  workspaceProjectId?: string;
  manifest?: ArtifactManifest;
  items: DeliverableItem[];
};

export type ErrorPart = ChatPartBase & {
  kind: "error";
  zone: "activity" | "summary";
  message: string;
  code?: string;
};

export type JsonPart = ChatPartBase & {
  kind: "json";
  zone: "activity";
  label?: string;
  value: unknown;
};

export type ImagePart = ChatPartBase & {
  kind: "image";
  zone: "summary";
  src: string;
  alt?: string;
};

export type ChartPart = ChatPartBase & {
  kind: "chart";
  zone: "summary";
  chartId: string;
  title?: string;
};

export type ResearchMapPart = ChatPartBase & {
  kind: "research_map";
  zone: "summary";
  /** 导图节点 JSON 或 Mermaid 源 */
  payload: unknown;
};

export type ChatPart =
  | SummaryPart
  | TextPart
  | NarrationPart
  | SkillPart
  | ReasoningPart
  | StatusPart
  | ToolPart
  | ToolBatchPart
  | TurnMetaPart
  | StatusChipPart
  | CommandPart
  | FileReadPart
  | DocumentReadPart
  | FileEditPart
  | DocumentEditPart
  | TodoPart
  | ClarificationPart
  | RequirementsPart
  | RequirementSummaryPart
  | OutlinePart
  | SimulationPart
  | CitationPart
  | ArtifactPart
  | DeliverablesPart
  | ErrorPart
  | JsonPart
  | ImagePart
  | ChartPart
  | ResearchMapPart;

// ---------------------------------------------------------------------------
// Message envelope
// ---------------------------------------------------------------------------

export const chatMessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;

export const chatMessageStatusSchema = z.enum([
  "complete",
  "loading",
  "streaming",
  "error",
  "cancelled",
]);
export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>;

/** Activity 区折叠态（按消息 id 持久化到 session UI state） */
export const activityCollapseSchema = z.enum([
  /** 流式中强制展开 */
  "expanded",
  /** 完成后默认 */
  "collapsed",
  /** 用户手动展开，优先于 collapsed */
  "user_expanded",
  /** 用户手动收起，流式结束后仍保持 */
  "user_collapsed",
]);
export type ActivityCollapse = z.infer<typeof activityCollapseSchema>;

export type ChatMessagePartsEnvelope = {
  protocolVersion: typeof CHAT_PARTS_PROTOCOL_VERSION;
  role: ChatMessageRole;
  status: ChatMessageStatus;
  parts: ChatPart[];
  /** 仅 assistant；控制 Activity 区折叠 */
  activityCollapse?: ActivityCollapse;
  /**
   * 向后兼容：由 parts 中 summary/text 拼接，或旧数据直存。
   * 新写入应以 parts 为准。
   */
  contentFallback?: string;
  runId?: string;
  agentId?: string;
};

// ---------------------------------------------------------------------------
// SSE → reducer 输入（Companion 现有事件 + 扩展 part 事件）
// ---------------------------------------------------------------------------

export const companionRunSseEventSchema = z.enum([
  "run.accepted",
  "run.started",
  "project.ensured",
  "message.delta",
  "interim_assistant",
  "assistant.segment",
  "tool.progress",
  "clarification.required",
  "canonical.output",
  "part.append",
  "part.patch",
  "run.finished",
  "run.error",
  "run.cancelled",
]);
export type CompanionRunSseEvent = z.infer<typeof companionRunSseEventSchema>;

/** Agent 在调工具前的可见进度说明（对齐 Hermes `interim_assistant` SSE） */
export type InterimAssistantPayload = {
  text: string;
  /** 正文已通过 `message.delta` 流出时设为 true，避免重复渲染 */
  already_streamed?: boolean;
};

/** `part.append`：追加新块；`part.patch`：更新已有块（流式/完成态） */
export type PartAppendPayload = {
  part: ChatPart;
};

export type PartPatchPayload = {
  partId: string;
  patch: Partial<
    Pick<ChatPart, "streaming" | "completedAt"> & {
      markdown?: string;
      message?: string;
      status?: string;
      exitCode?: number | null;
      items?: TodoItem[];
    }
  >;
};

/** runtime-core AgentStreamEvent → ChatPart 的归一化中间态 */
export type AgentStreamEventNormalized =
  | { type: "text_delta"; delta: string }
  | { type: "tool_progress"; tool: string; status?: string; message?: string }
  | { type: "status"; label: string }
  | { type: "error"; message: string; code?: string };

// ---------------------------------------------------------------------------
// Canonical output protocol — provider-neutral events + turn result
// ---------------------------------------------------------------------------

/** 统一输出协议版本（多 CLI / 多 LLM 收敛层） */
export const CHAT_OUTPUT_PROTOCOL_VERSION = 1 as const;

export const canonicalRunOutcomeStatusSchema = z.enum([
  "success",
  "waiting_user",
  "cancelled",
  "failed",
]);
export type CanonicalRunOutcomeStatus = z.infer<
  typeof canonicalRunOutcomeStatusSchema
>;

export const canonicalToolStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "error",
  "cancelled",
]);
export type CanonicalToolStatus = z.infer<typeof canonicalToolStatusSchema>;

export const canonicalNextActionTypeSchema = z.enum([
  "none",
  "ask_user",
  "continue",
  "open_artifact",
]);
export type CanonicalNextActionType = z.infer<
  typeof canonicalNextActionTypeSchema
>;

export const canonicalExecutionClassSchema = z.enum([
  "direct_answer",
  "light_analysis",
  "tool_required",
  "artifact_oriented",
]);
export type CanonicalExecutionClass = z.infer<
  typeof canonicalExecutionClassSchema
>;

export const canonicalEventTypeSchema = z.enum([
  "run_accepted",
  "run_started",
  "status_changed",
  "assistant_delta",
  "reasoning_delta",
  "tool_started",
  "tool_finished",
  "artifact_found",
  "citation_found",
  "workspace_change",
  "todo_updated",
  "run_waiting_user",
  "run_finished",
  "run_failed",
  "run_cancelled",
]);
export type CanonicalEventType = z.infer<typeof canonicalEventTypeSchema>;

export type CanonicalProviderInfo = {
  agentId: string;
  providerId: string;
  model?: string;
};
export const canonicalProviderInfoSchema = z.object({
  agentId: z.string(),
  providerId: z.string(),
  model: z.string().optional(),
});

export type CanonicalCitation = {
  id: string;
  title: string;
  source: string;
  url?: string;
  snippet?: string;
};
export const canonicalCitationSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.string().optional(),
  snippet: z.string().optional(),
});

export type CanonicalArtifact = {
  path: string;
  label?: string;
  mime?: string;
  kind?: "primary" | "attachment" | "preview";
};
export const canonicalArtifactSchema = z.object({
  path: z.string(),
  label: z.string().optional(),
  mime: z.string().optional(),
  kind: z.enum(["primary", "attachment", "preview"]).optional(),
});

export type CanonicalWorkspaceChange = {
  path: string;
  kind: "read" | "created" | "modified" | "deleted";
  additions?: number;
  deletions?: number;
};
export const canonicalWorkspaceChangeSchema = z.object({
  path: z.string(),
  kind: z.enum(["read", "created", "modified", "deleted"]),
  additions: z.number().optional(),
  deletions: z.number().optional(),
});

export type CanonicalRationale = {
  summary?: string;
  bullets?: string[];
};
export const canonicalRationaleSchema = z.object({
  summary: z.string().optional(),
  bullets: z.array(z.string()).optional(),
});

export type CanonicalOutcome = {
  status: CanonicalRunOutcomeStatus;
  finishedAt?: number;
  durationMs?: number;
  code?: string;
  message?: string;
};
export const canonicalOutcomeSchema = z.object({
  status: canonicalRunOutcomeStatusSchema,
  finishedAt: z.number().optional(),
  durationMs: z.number().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

export type CanonicalFinalAnswer = {
  markdown: string;
  title?: string;
  confidence?: "low" | "medium" | "high";
  language?: string;
};
export const canonicalFinalAnswerSchema = z.object({
  markdown: z.string(),
  title: z.string().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
  language: z.string().optional(),
});

export type CanonicalNextAction = {
  type: CanonicalNextActionType;
  message?: string;
};
export const canonicalNextActionSchema = z.object({
  type: canonicalNextActionTypeSchema,
  message: z.string().optional(),
});

export type CanonicalOutputDebug = {
  eventCount?: number;
  toolCallCount?: number;
  toolFinishedCount?: number;
  assistantDeltaCount?: number;
  latestStatus?: string;
  compressedHistory?: boolean;
};
export const canonicalOutputDebugSchema = z.object({
  eventCount: z.number().optional(),
  toolCallCount: z.number().optional(),
  toolFinishedCount: z.number().optional(),
  assistantDeltaCount: z.number().optional(),
  latestStatus: z.string().optional(),
  compressedHistory: z.boolean().optional(),
});

export type CanonicalEventBase = {
  type: CanonicalEventType;
  runId: string;
  timestamp: number;
};

export type CanonicalRunAcceptedEvent = CanonicalEventBase & {
  type: "run_accepted";
  message?: string;
};

export type CanonicalRunStartedEvent = CanonicalEventBase & {
  type: "run_started";
  provider: string;
  agentId: string;
  model?: string;
};

export type CanonicalStatusChangedEvent = CanonicalEventBase & {
  type: "status_changed";
  phase: string;
  label: string;
};

export type CanonicalAssistantDeltaEvent = CanonicalEventBase & {
  type: "assistant_delta";
  text: string;
};

export type CanonicalReasoningDeltaEvent = CanonicalEventBase & {
  type: "reasoning_delta";
  text: string;
};

export type CanonicalToolStartedEvent = CanonicalEventBase & {
  type: "tool_started";
  callId: string;
  tool: string;
  message?: string;
  input?: unknown;
};

export type CanonicalToolFinishedEvent = CanonicalEventBase & {
  type: "tool_finished";
  callId: string;
  tool: string;
  status: Extract<CanonicalToolStatus, "success" | "error" | "cancelled">;
  message?: string;
  output?: unknown;
};

export type CanonicalArtifactFoundEvent = CanonicalEventBase & {
  type: "artifact_found";
  path: string;
  mime?: string;
  label?: string;
};

export type CanonicalCitationFoundEvent = CanonicalEventBase & {
  type: "citation_found";
  title: string;
  source: string;
  url?: string;
  snippet?: string;
};

export type CanonicalWorkspaceChangeEvent = CanonicalEventBase & {
  type: "workspace_change";
  path: string;
  kind: CanonicalWorkspaceChange["kind"];
  additions?: number;
  deletions?: number;
};

export type CanonicalTodoUpdatedEvent = CanonicalEventBase & {
  type: "todo_updated";
  items: TodoItem[];
};

export type CanonicalRunWaitingUserEvent = CanonicalEventBase & {
  type: "run_waiting_user";
  question?: string;
};

export type CanonicalRunFinishedEvent = CanonicalEventBase & {
  type: "run_finished";
};

export type CanonicalRunFailedEvent = CanonicalEventBase & {
  type: "run_failed";
  code?: string;
  message: string;
};

export type CanonicalRunCancelledEvent = CanonicalEventBase & {
  type: "run_cancelled";
};

export type CanonicalEvent =
  | CanonicalRunAcceptedEvent
  | CanonicalRunStartedEvent
  | CanonicalStatusChangedEvent
  | CanonicalAssistantDeltaEvent
  | CanonicalReasoningDeltaEvent
  | CanonicalToolStartedEvent
  | CanonicalToolFinishedEvent
  | CanonicalArtifactFoundEvent
  | CanonicalCitationFoundEvent
  | CanonicalWorkspaceChangeEvent
  | CanonicalTodoUpdatedEvent
  | CanonicalRunWaitingUserEvent
  | CanonicalRunFinishedEvent
  | CanonicalRunFailedEvent
  | CanonicalRunCancelledEvent;

export type CanonicalTurnOutput = {
  protocolVersion: typeof CHAT_OUTPUT_PROTOCOL_VERSION;
  sessionId: string;
  turnId: string;
  runId: string;
  provider: CanonicalProviderInfo;
  executionClass?: CanonicalExecutionClass;
  outcome: CanonicalOutcome;
  finalAnswer: CanonicalFinalAnswer;
  rationale?: CanonicalRationale;
  citations?: CanonicalCitation[];
  artifacts?: CanonicalArtifact[];
  workspaceChanges?: CanonicalWorkspaceChange[];
  todos?: TodoItem[];
  nextAction?: CanonicalNextAction;
  debug?: CanonicalOutputDebug;
};

/** 与现有 UI 兼容：标准结果与 `parts[]` 可并存，后续逐步收敛到 canonical output */
export type ChatMessageCanonicalEnvelope = ChatMessagePartsEnvelope & {
  canonicalOutput?: CanonicalTurnOutput;
};

export type CanonicalOutputPayload = {
  canonicalOutput: CanonicalTurnOutput;
};

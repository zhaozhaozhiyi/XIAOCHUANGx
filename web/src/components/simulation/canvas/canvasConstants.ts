import type { SimulationNode } from "@/lib/chat-parts";
import type {
  CanvasEdgeData,
  CanvasInsertNodeType,
  CanvasKind,
  CanvasLayerId,
} from "./canvasTypes";

// F3: 边语义可视化。transition-grammar 定义了三种世界模型边类型
// （causal / temporal / evidence_support），此前画布对它们视觉无差别。
// 这里给每种关系类型一个稳定的视觉与文案约定：
// - dash: SVG strokeDasharray（undefined = 实线）
// - label: 中文关系名，用于悬停 tooltip
// - hint: 一句话解释该关系语义
export type EdgeRelationType = NonNullable<CanvasEdgeData["relationType"]>;

export const EDGE_RELATION_META: Record<
  EdgeRelationType,
  { dash?: string; label: string; hint: string }
> = {
  causal: { label: "因果", hint: "上游驱动/影响/触发下游" },
  temporal: { dash: "7 5", label: "时序", hint: "顺序、生命周期或版本演进" },
  evidence_support: {
    dash: "2 4",
    label: "证据支撑",
    hint: "证据或来源支撑该假设、推理或结论",
  },
  system: { label: "系统", hint: "系统关系" },
  scenario: { label: "情景", hint: "情景与其组成的关系" },
  path: { dash: "6 6", label: "路径", hint: "路径与其结论的关系" },
  output: { dash: "6 5", label: "输出", hint: "输出、总结或轮次记忆关系" },
};

// 只有世界模型语义边（用户关心的因果/时序/证据）在图上展示关系类型徽标；
// 系统装配边（system/scenario/path/output）不打扰用户。
export const SEMANTIC_EDGE_RELATION_TYPES_LIST: readonly EdgeRelationType[] = [
  "causal",
  "temporal",
  "evidence_support",
];

export const SEMANTIC_EDGE_RELATION_TYPES: ReadonlySet<EdgeRelationType> = new Set(
  SEMANTIC_EDGE_RELATION_TYPES_LIST,
);

export const CANVAS_LAYERS: Array<{
  id: CanvasLayerId;
  label: string;
}> = [
  { id: "all", label: "全部" },
  { id: "question", label: "问题层" },
  { id: "world", label: "世界模型" },
  { id: "variable", label: "变量层" },
  { id: "reasoning", label: "事件/推理" },
  { id: "evidence", label: "证据层" },
  { id: "riskDecision", label: "风险/决策" },
  { id: "scenario", label: "情景层" },
  { id: "output", label: "输出层" },
];

export const NODE_REVEAL_MS = 460;
export const PROMPT_TEXT_MAX = 200;
export const CANVAS_NODE_TOP = 56;
export const CANVAS_NODE_ROW_STEP = 172;
export const CANVAS_NODE_GROUP_GAP = 64;
export const SCENARIO_COLUMN_X = 1960;
export const AI_COLUMN_X = 2320;
export const PROMPT_COLUMN_X = 32;
export const TOPIC_COLUMN_X = 440;
export const ALIGNMENT_THRESHOLD = 8;
export const LAYOUT_HISTORY_LIMIT = 24;

export const STRUCTURED_NODE_LANES: Array<{
  x: number;
  kinds: Array<SimulationNode["type"]>;
}> = [
  { x: 860, kinds: ["entity", "variable", "hypothesis"] },
  { x: 1210, kinds: ["event", "inference", "evidence"] },
  { x: 1560, kinds: ["risk", "decision", "action", "conclusion"] },
];

export const EDGE_INSERT_OPTIONS: Array<{
  type: CanvasInsertNodeType;
  label: string;
}> = [
  { type: "hypothesis", label: "假设" },
  { type: "event", label: "事件" },
  { type: "evidence", label: "证据" },
  { type: "inference", label: "推理" },
  { type: "risk", label: "风险" },
  { type: "action", label: "行动" },
];

// F5b: 世界模型波次（wave）一等公民展示。
// skill-world-model 的 wave-driven 协议按推理波次增量生成节点，
// 每个节点在 data.waveId / data.waveIndex / data.waveTitle 携带波次归属（F1 已镜像到顶层）。
// 这里给标准波次一个稳定的顺序与中文名，供画布按波次分组/折叠/回看。
export const WAVE_ORDER: ReadonlyArray<{ id: string; index: number; label: string }> = [
  { id: "wave_0_question", index: 0, label: "问题边界" },
  { id: "wave_1_skeleton", index: 1, label: "世界骨架" },
  { id: "wave_2_context", index: 2, label: "证据与背景" },
  { id: "wave_3_hypothesis", index: 3, label: "因果假设" },
  { id: "wave_4_inference", index: 4, label: "中间推理" },
  { id: "wave_5_risk", index: 5, label: "风险与扰动" },
  { id: "wave_6_paths", index: 6, label: "情景路径" },
  { id: "wave_7_intervention", index: 7, label: "决策干预" },
  { id: "wave_8_output", index: 8, label: "输出与记忆" },
];

export const WAVE_META_BY_ID = new Map(
  WAVE_ORDER.map((wave) => [wave.id, wave]),
);

export const REVEAL_KIND_ORDER = new Map<CanvasKind, number>([
  ["prompt", 0],
  ["topic", 1],
  ["entity", 2],
  ["variable", 3],
  ["hypothesis", 4],
  ["event", 5],
  ["evidence", 6],
  ["inference", 7],
  ["risk", 8],
  ["decision", 9],
  ["action", 10],
  ["conclusion", 11],
  ["scenario", 12],
  ["path", 13],
  ["summary", 14],
  ["next_action", 15],
  ["suggestion", 16],
  ["report", 17],
  ["history", 18],
  ["recovery", 19],
]);


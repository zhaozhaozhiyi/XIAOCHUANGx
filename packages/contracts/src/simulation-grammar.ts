import type { SimulationEdgeType, SimulationNodeType } from "./chat";

// F4: skill-world-model 的 transition-grammar 运行时化。
// 此前转换语法只存在于 Skill 文档（references/transition-grammar.md），
// 靠 AI 自觉遵守，运行时零校验——非法边（反向因果、类型短路）可静默入图且永不清除。
// 本模块把语法抽成共享数据 + 校验函数，供 companion 解析校验与 web 连线校验共用。
//
// 数据源：skills/skill-world-model/references/transition-grammar.md 的 Core Grammar。

// 合法的高层转换：upstream nodeType -> downstream nodeType。
// 与文档 Core Grammar 一一对应。
const ALLOWED_NODE_TRANSITIONS: ReadonlyArray<
  readonly [SimulationNodeType, SimulationNodeType]
> = [
  ["prompt", "topic"],
  ["topic", "entity"],
  ["topic", "variable"],
  ["topic", "evidence"],
  ["entity", "variable"],
  ["variable", "hypothesis"],
  ["evidence", "hypothesis"],
  ["hypothesis", "inference"],
  ["evidence", "inference"],
  ["variable", "inference"],
  ["event", "variable"],
  ["event", "risk"],
  ["risk", "scenario"],
  ["inference", "scenario"],
  ["inference", "conclusion"],
  ["conclusion", "decision"],
  ["decision", "action"],
  ["action", "next_action"],
  ["summary", "report"],
];
// 注：Core Grammar 里 risk/scenario -> path、path -> conclusion 描述的是路径层关系，
// 节点图内不会出现 nodeType="path"（path 是 SimulationPath 结构），故不作为节点边校验。

const NODE_TRANSITION_SET: ReadonlySet<string> = new Set(
  ALLOWED_NODE_TRANSITIONS.map(([from, to]) => `${from}->${to}`),
);

// 通配转换：任意节点都可产生这些下游（文档 Core Grammar 末段）。
// - any active node -> suggestion
// - any superseded node -> history
// - failed step -> recovery
const ANY_SOURCE_TARGETS: ReadonlySet<SimulationNodeType> = new Set([
  "suggestion",
  "history",
  "recovery",
]);

// 明确禁止的短路（文档 Disallowed Shortcuts）。命中即高风险违规。
const DISALLOWED_SHORTCUTS: ReadonlySet<string> = new Set([
  "topic->action",
  "variable->conclusion",
  "evidence->conclusion",
  "risk->action",
  "scenario->report",
]);

// 合法边类型（文档 Allowed edge types）。
const ALLOWED_EDGE_TYPES: ReadonlySet<SimulationEdgeType> = new Set<
  SimulationEdgeType
>(["temporal", "causal", "evidence_support"]);

export type TransitionVerdict = {
  ok: boolean;
  // "allowed"：命中白名单或通配；"unlisted"：未在白名单但也非明确禁止（软警告）；
  // "disallowed_shortcut"：命中明确禁止的短路（硬违规）。
  reason: "allowed" | "unlisted" | "disallowed_shortcut";
  message?: string;
};

// 校验一条节点到节点的转换是否符合语法。
export function checkNodeTransition(
  sourceType: SimulationNodeType,
  targetType: SimulationNodeType,
): TransitionVerdict {
  const key = `${sourceType}->${targetType}`;

  if (DISALLOWED_SHORTCUTS.has(key)) {
    return {
      ok: false,
      reason: "disallowed_shortcut",
      message: `不建议的短路连接：${sourceType} → ${targetType} 跳过了必要的中间层。`,
    };
  }

  if (ANY_SOURCE_TARGETS.has(targetType) || NODE_TRANSITION_SET.has(key)) {
    return { ok: true, reason: "allowed" };
  }

  return {
    ok: false,
    reason: "unlisted",
    message: `未定义的转换：${sourceType} → ${targetType}。请确认是否符合因果/时序/证据关系。`,
  };
}

// 供前端 isValidConnection 使用的宽松判定：
// 只拦截明确禁止的短路（硬违规），未列出的转换放行（软警告由 UI 另行提示），
// 避免过度拦截打断用户探索。
export function isConnectionAllowed(
  sourceType: SimulationNodeType,
  targetType: SimulationNodeType,
): boolean {
  return checkNodeTransition(sourceType, targetType).reason !== "disallowed_shortcut";
}

export function isAllowedEdgeType(value: unknown): value is SimulationEdgeType {
  return (
    typeof value === "string" &&
    ALLOWED_EDGE_TYPES.has(value as SimulationEdgeType)
  );
}

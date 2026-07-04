import type { Edge } from "@xyflow/react";
import type { SimulationDecisionBranch } from "@/components/simulation/SimulationWorldChoicePanel";
import type { SimulationRequirementsPart } from "@/components/simulation/SimulationEntryRequirementsCard";
import type {
  SimulationEdge,
  SimulationIntervention,
  SimulationNode,
  SimulationPath,
} from "@/lib/chat-parts";
import { PROMPT_TEXT_MAX } from "./canvasConstants";
import type {
  CanvasKind,
  CanvasLayerId,
  CanvasNodeData,
  DetailRow,
  InterventionImpact,
  NormalizedScenario,
  Scenario,
  ScenarioDiff,
  ScenarioView,
  SimulationRequirementSummaryPart,
  TopicAnalysisStep,
  TopicDefinitionPhase,
} from "./canvasTypes";

export function nodeKindLabel(kind: CanvasKind): string {
  switch (kind) {
    case "prompt":
      return "原问题";
    case "topic":
      return "问题定义";
    case "entity":
      return "主体";
    case "variable":
      return "变量";
    case "hypothesis":
      return "假设";
    case "event":
      return "事件";
    case "conclusion":
      return "结论";
    case "risk":
      return "风险";
    case "evidence":
      return "依据";
    case "inference":
      return "推理";
    case "decision":
      return "决策";
    case "action":
      return "行动";
    case "scenario":
      return "情景";
    case "next_action":
      return "下一步";
    case "history":
      return "历史";
    case "suggestion":
      return "续推建议";
    case "summary":
      return "阶段总结";
    case "report":
      return "本地报告";
    case "recovery":
      return "异常恢复";
    case "path":
      return "推演路径";
  }
}

export function nodeColor(kind: CanvasKind): string {
  switch (kind) {
    case "prompt":
      return "#64748b";
    case "topic":
      return "#111827";
    case "entity":
      return "#2563eb";
    case "variable":
      return "#7c3aed";
    case "hypothesis":
      return "#9333ea";
    case "path":
    case "scenario":
      return "#059669";
    case "risk":
      return "#dc2626";
    case "evidence":
      return "#0891b2";
    case "suggestion":
    case "next_action":
      return "#ca8a04";
    case "inference":
      return "#0d9488";
    case "decision":
      return "#ea580c";
    case "action":
      return "#65a30d";
    case "history":
      return "#475569";
    case "summary":
      return "#0f766e";
    case "report":
      return "#475569";
    case "recovery":
      return "#b45309";
    case "conclusion":
      return "#16a34a";
    case "event":
      return "#4f46e5";
  }
}

export function nodeLayer(kind: CanvasKind): CanvasLayerId {
  switch (kind) {
    case "prompt":
    case "topic":
      return "question";
    case "entity":
      return "world";
    case "variable":
      return "variable";
    case "hypothesis":
    case "event":
    case "inference":
      return "reasoning";
    case "evidence":
      return "evidence";
    case "risk":
    case "decision":
    case "action":
    case "conclusion":
      return "riskDecision";
    case "scenario":
    case "path":
      return "scenario";
    case "summary":
    case "report":
    case "next_action":
    case "suggestion":
    case "history":
    case "recovery":
      return "output";
  }
}

export function shortLabel(value: string, max = 42): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}...` : trimmed;
}

export function clampText(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, Math.max(0, max - 3))}...`;
}

export function sameText(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  return left.replace(/\s+/g, " ").trim() === right.replace(/\s+/g, " ").trim();
}

export function markdownPlainText(markdown: string, max = 170): string {
  return shortLabel(
    markdown
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`~-]/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
    max,
  );
}

export function valueLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

export function percentLabel(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

export function ratingLabel(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.max(0, Math.min(5, Math.round(value)));
    return `${normalized}/5`;
  }
  if (typeof value === "string" && value.trim()) return value;
  return undefined;
}

export function objectTextValue(
  value: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const item = value[key];
    if (typeof item === "string" && item.trim()) return item;
    if (typeof item === "number" || typeof item === "boolean") return String(item);
  }
  return undefined;
}

export function decisionBranches(node: SimulationNode | null): SimulationDecisionBranch[] {
  if (node?.type !== "decision") return [];
  const branches = Array.isArray(node.data?.options)
    ? node.data.options
    : node.data?.branches;
  if (!Array.isArray(branches)) return [];
  return branches
    .map((branch, index): SimulationDecisionBranch | null => {
      if (
        typeof branch === "string" ||
        typeof branch === "number" ||
        typeof branch === "boolean"
      ) {
        const label = valueLabel(branch);
        return { id: `${index}:${label}`, label };
      }
      if (branch && typeof branch === "object" && !Array.isArray(branch)) {
        const record = branch as Record<string, unknown>;
        const label =
          objectTextValue(record, ["label", "title", "name", "value", "id"]) ??
          valueLabel(branch);
        const detail = objectTextValue(record, [
          "detail",
          "description",
          "summary",
          "expectedEffect",
        ]);
        return {
          id: objectTextValue(record, ["id"]) ?? `${index}:${label}`,
          label,
          detail,
          scenarioId: objectTextValue(record, ["scenarioId", "scenario"]),
        };
      }
      return null;
    })
    .filter(Boolean) as SimulationDecisionBranch[];
}

export function isSimulationNode(value: SimulationNode | SimulationPath): value is SimulationNode {
  return "type" in value;
}

export function nodeSummary(data: CanvasNodeData): string | undefined {
  if (data.detail) return data.detail;
  if (data.summary) return markdownPlainText(data.summary.markdown);
  if (data.nextAction) return data.nextAction.description;
  if (data.suggestion) return data.suggestion.description;
  if (data.deliverables) {
    return data.deliverables.primaryPath ?? data.deliverables.items[0]?.path;
  }
  if (data.error) return data.error.message;
  return undefined;
}

export function promptDisplayText(node: SimulationNode): string {
  return clampText(
    nodeDataText(node, "rawText") ?? node.detail ?? node.label,
    PROMPT_TEXT_MAX,
  );
}

export function topicDefinitionState(node: SimulationNode): string | undefined {
  return nodeDataText(node, "state") ?? node.status;
}

export function topicDefinitionStateLabel(state: string | undefined): string {
  switch (state) {
    case "understanding":
      return "AI 正在理解";
    case "waiting_boundary_confirmation":
    case "active":
    case "pending":
      return "待用户确认";
    case "modeling_world":
      return "正在进入世界模型";
    case "identifying_variables":
      return "正在识别变量";
    case "generating_scenarios":
      return "正在生成情景";
    case "waiting_next_action":
      return "等待下一步";
    case "completed":
    case "confirmed":
      return "已确认";
    case "updated":
      return "已更新";
    case "historical":
      return "历史版本";
    case "failed":
      return "处理失败";
    default:
      return "待用户确认";
  }
}

export function topicAnalysisSteps(node: SimulationNode): TopicAnalysisStep[] {
  const raw = node.data?.analysisSteps;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index): TopicAnalysisStep | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const record = item as Record<string, unknown>;
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label.trim()
          : typeof record.message === "string" && record.message.trim()
            ? record.message.trim()
            : "";
      if (!label) return null;
      const status =
        record.status === "pending" ||
        record.status === "running" ||
        record.status === "success" ||
        record.status === "error"
          ? record.status
          : "running";
      return {
        id:
          typeof record.id === "string" && record.id.trim()
            ? record.id.trim()
            : `topic-analysis-${index}`,
        label,
        status,
      };
    })
    .filter((item): item is TopicAnalysisStep => item != null)
    .slice(-4);
}

export function isTopicDefinitionPending(node: SimulationNode): boolean {
  if (node.type !== "topic") return false;
  const state = topicDefinitionState(node);
  if (
    state === "modeling_world" ||
    state === "identifying_variables" ||
    state === "generating_scenarios" ||
    state === "waiting_next_action" ||
    state === "completed" ||
    state === "confirmed"
  ) {
    return false;
  }
  return true;
}

export function isQuestionLayerNodeData(
  kind: CanvasKind,
  data: Pick<CanvasNodeData, "topicDefinitionPhase" | "dependencyLabel">,
): boolean {
  if (kind === "prompt") return true;
  if (kind === "topic") {
    return Boolean(data.topicDefinitionPhase) || data.dependencyLabel === "问题层";
  }
  return false;
}

export function shouldShowCanvasInspector(
  embedded: boolean,
  selected: CanvasNodeData | undefined,
): boolean {
  if (!selected) return false;
  void embedded;
  return true;
}

export function resolveTopicDefinitionPhase(
  sourceNode: SimulationNode | null,
  options: {
    entryRequirementsPart?: SimulationRequirementsPart;
    requirementSummaryPart?: SimulationRequirementSummaryPart;
  },
): TopicDefinitionPhase | null {
  if (!sourceNode || sourceNode.type !== "topic") return null;
  const inQuestionLayerFlow =
    Boolean(options.entryRequirementsPart) ||
    Boolean(options.requirementSummaryPart) ||
    isTopicDefinitionPending(sourceNode);
  if (!inQuestionLayerFlow) return null;
  const state = topicDefinitionState(sourceNode);
  if (
    state === "identifying_variables" ||
    state === "generating_scenarios" ||
    state === "waiting_next_action" ||
    state === "completed"
  ) {
    return null;
  }
  if (
    options.requirementSummaryPart ||
    state === "modeling_world" ||
    state === "confirmed"
  ) {
    return "confirmed";
  }
  if (options.entryRequirementsPart) {
    return "form";
  }
  if (
    state === "understanding" ||
    state === "waiting_boundary_confirmation" ||
    state === "active" ||
    state === "pending" ||
    !state
  ) {
    return "analyzing";
  }
  return null;
}

export function topicDefinitionPhaseBadge(
  phase: TopicDefinitionPhase,
  options: { submitted?: boolean; isReplying?: boolean },
): string {
  switch (phase) {
    case "analyzing":
      return "分析中";
    case "form":
      return options.submitted ? "已提交" : "待确认";
    case "confirmed":
      return options.isReplying ? "进入世界模型" : "已确认";
  }
}

export function topicBoundaryLines(node: SimulationNode): string[] {
  return [
    `问题：${nodeDataText(node, "problem") ?? node.label}`,
    `推演目标：${nodeDataText(node, "goal") ?? "待确认"}`,
    `时间范围：${nodeDataText(node, "timeRange") ?? "待确认"}`,
    `空间范围：${nodeDataText(node, "spaceRange") ?? "待确认"}`,
    `行业：${nodeDataText(node, "industry") ?? "待确认"}`,
    `状态：${topicDefinitionStateLabel(topicDefinitionState(node))}`,
  ];
}

export function nodeMetricBadges(data: CanvasNodeData): string[] {
  const source = data.source;
  if (source && isSimulationNode(source)) {
    const badges: string[] = [];
    if (source.type === "variable" && source.value != null) {
      badges.push(`当前 ${valueLabel(source.value)}${source.valueSchema?.unit ?? ""}`);
    }
    if (source.locked) badges.push("已锁定");
    const probability = percentLabel(source.data?.probability);
    if (probability) badges.push(`概率 ${probability}`);
    const confidence = percentLabel(source.data?.confidence);
    if (confidence) badges.push(`置信 ${confidence}`);
    const impact = ratingLabel(source.data?.impact);
    if (impact) badges.push(`影响 ${impact}`);
    const controllability = ratingLabel(source.data?.controllability);
    if (controllability) badges.push(`可控 ${controllability}`);
    const branches = Array.isArray(source.data?.options)
      ? source.data.options
      : source.data?.branches;
    if (Array.isArray(branches) && branches.length > 0) {
      badges.push(`${branches.length} 分支`);
    }
    return badges.slice(0, 3);
  }
  if (data.scenarioView?.probability != null) {
    return [`概率 ${Math.round(data.scenarioView.probability * 100)}%`];
  }
  return [];
}

export function compactDataValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => valueLabel(item)).join("、");
  }
  return undefined;
}

export function compactDataFirstValue(
  data: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!data) return undefined;
  for (const key of keys) {
    const value = compactDataValue(data[key]);
    if (value) return value;
  }
  return undefined;
}

export function branchLabels(node: SimulationNode): string | undefined {
  const branches = Array.isArray(node.data?.options)
    ? node.data.options
    : node.data?.branches;
  if (!Array.isArray(branches) || branches.length === 0) return undefined;
  return branches
    .slice(0, 3)
    .map((branch) => {
      if (branch && typeof branch === "object" && !Array.isArray(branch)) {
        return (
          objectTextValue(branch as Record<string, unknown>, [
            "label",
            "title",
            "name",
            "value",
            "id",
          ]) ?? valueLabel(branch)
        );
      }
      return valueLabel(branch);
    })
    .join(" / ");
}

export function nodeConfigRows(data: CanvasNodeData): DetailRow[] {
  const rows: DetailRow[] = [];
  const source = data.source;
  if (source && isSimulationNode(source)) {
    switch (source.type) {
      case "prompt":
        rows.push({
          label: "原文",
          value: compactDataFirstValue(source.data, ["rawText"]) ?? source.detail ?? source.label,
        });
        break;
      case "topic":
        rows.push({
          label: "问题",
          value: compactDataFirstValue(source.data, ["problem"]) ?? source.label,
        });
        rows.push({
          label: "目标",
          value: compactDataFirstValue(source.data, ["goal"]) ?? "待确认",
        });
        rows.push({
          label: "时间",
          value: compactDataFirstValue(source.data, ["timeRange"]) ?? "待确认",
        });
        rows.push({
          label: "空间",
          value: compactDataFirstValue(source.data, ["spaceRange"]) ?? "待确认",
        });
        rows.push({
          label: "行业",
          value: compactDataFirstValue(source.data, ["industry"]) ?? "待确认",
        });
        rows.push({
          label: "状态",
          value: topicDefinitionStateLabel(topicDefinitionState(source)),
        });
        break;
      case "entity":
        for (const [keys, label] of [
          [["goal", "goals"], "目标"],
          [["influences", "affects"], "影响"],
          [["variables", "variableIds"], "变量"],
          [["events", "eventIds"], "事件"],
        ] as const) {
          const value = compactDataFirstValue(source.data, [...keys]);
          if (value) rows.push({ label, value });
        }
        break;
      case "variable":
        rows.push({
          label: "当前",
          value: `${valueLabel(source.value) || "待确认"}${source.valueSchema?.unit ?? ""}`,
        });
        if (source.valueSchema?.range) {
          rows.push({
            label: "范围",
            value: `${source.valueSchema.range[0]} - ${source.valueSchema.range[1]}${source.valueSchema.unit ?? ""}`,
          });
        }
        if (source.valueSchema?.options?.length) {
          rows.push({ label: "选项", value: source.valueSchema.options.join(" / ") });
        }
        break;
      case "event":
        rows.push({
          label: "IF",
          value: compactDataFirstValue(source.data, ["condition"]) ?? source.label,
        });
        rows.push({
          label: "THEN",
          value: compactDataFirstValue(source.data, ["scope"]) ?? source.detail ?? "重算下游",
        });
        {
          const probability = percentLabel(source.data?.probability);
          if (probability) rows.push({ label: "概率", value: probability });
        }
        break;
      case "hypothesis":
        rows.push({
          label: "假设",
          value:
            compactDataFirstValue(source.data, ["statement"]) ??
            source.detail ??
            source.label,
        });
        {
          const confidence = percentLabel(source.data?.confidence);
          if (confidence) rows.push({ label: "可信", value: confidence });
        }
        break;
      case "inference":
        rows.push({
          label: "依据",
          value:
            compactDataFirstValue(source.data, ["rationale"]) ??
            source.detail ??
            source.label,
        });
        {
          const model = compactDataFirstValue(source.data, ["modelName", "model"]);
          if (model) rows.push({ label: "模型", value: model });
          const confidence = percentLabel(source.data?.confidence);
          if (confidence) rows.push({ label: "可信", value: confidence });
          const evidenceIds = source.data?.evidenceIds;
          if (Array.isArray(evidenceIds)) {
            rows.push({ label: "证据", value: `${evidenceIds.length} 条` });
          }
        }
        break;
      case "risk":
        {
          const probability = percentLabel(source.data?.probability);
          const impact = ratingLabel(source.data?.impact);
          const controllability = ratingLabel(source.data?.controllability);
          if (probability) rows.push({ label: "概率", value: probability });
          if (impact) rows.push({ label: "影响", value: impact });
          if (controllability) rows.push({ label: "可控", value: controllability });
          const trigger = compactDataFirstValue(source.data, ["triggerSignal"]);
          if (trigger) rows.push({ label: "信号", value: trigger });
        }
        break;
      case "decision":
        {
          const branches = branchLabels(source);
          if (branches) rows.push({ label: "分支", value: branches });
        }
        break;
      case "action":
        for (const [keys, label] of [
          [["target"], "对象"],
          [["expectedEffect"], "预期"],
          [["cost"], "成本"],
        ] as const) {
          const value = compactDataFirstValue(source.data, [...keys]);
          if (value) rows.push({ label, value });
        }
        break;
      case "conclusion":
        for (const [keys, label] of [
          [["variables", "variableIds"], "变量"],
          [["evidence", "evidenceIds"], "证据"],
          [["assumptions", "hypothesisIds"], "假设"],
          [["risks", "riskIds"], "风险"],
        ] as const) {
          const value = compactDataFirstValue(source.data, [...keys]);
          if (value) rows.push({ label, value });
        }
        break;
      case "evidence":
        rows.push({
          label: "来源",
          value:
            source.evidenceSource ??
            compactDataFirstValue(source.data, ["source"]) ??
            source.label,
        });
        if (source.evidenceCredibility) {
          rows.push({ label: "可信", value: source.evidenceCredibility });
        }
        for (const [keys, label] of [
          [["updatedAt"], "更新"],
          [["page", "quoteLocation"], "位置"],
        ] as const) {
          const value = compactDataFirstValue(source.data, [...keys]);
          if (value) rows.push({ label, value });
        }
        break;
      default:
        break;
    }
  } else if (source) {
    rows.push({ label: "状态", value: source.status });
    if (source.probability != null) {
      rows.push({ label: "概率", value: `${Math.round(source.probability * 100)}%` });
    }
    rows.push({ label: "边", value: `${source.edgeIds.length} 条` });
  } else if (data.scenarioView) {
    if (data.scenarioView.probability != null) {
      rows.push({
        label: "概率",
        value: `${Math.round(data.scenarioView.probability * 100)}%`,
      });
    }
    rows.push({ label: "节点", value: `${data.scenarioView.nodeIds.length} 个` });
    rows.push({ label: "路径", value: `${data.scenarioView.pathIds.length} 条` });
  } else if (data.deliverables) {
    rows.push({
      label: "主文件",
      value: data.deliverables.primaryPath ?? data.deliverables.items[0]?.path ?? "已生成",
    });
  }

  const maxRows =
    source && isSimulationNode(source) && source.type === "topic" ? 6 : 4;
  return rows
    .filter((row) => row.value.trim())
    .map((row) => ({ ...row, value: clampText(row.value, 86) }))
    .slice(0, maxRows);
}


export function edgeStyle(kind: CanvasKind, selected = false): Edge["style"] {
  return {
    stroke: nodeColor(kind),
    strokeWidth: selected ? 2.4 : 1.35,
  };
}


export function pathIncludesNode(
  path: SimulationPath,
  node: SimulationNode,
  edgeById: Map<string, SimulationEdge>,
): boolean {
  if (node.pathIds?.includes(path.id)) return true;
  return path.edgeIds.some((edgeId) => {
    const edge = edgeById.get(edgeId);
    return edge?.source === node.id || edge?.target === node.id;
  });
}

export function nodeDataText(node: SimulationNode, key: string): string | undefined {
  const value = node.data?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function nodeDataValueText(node: SimulationNode, key: string): string | undefined {
  const value = node.data?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return valueLabel(value);
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => valueLabel(item)).join("、");
  }
  return undefined;
}

export function nodeDataFirstValueText(node: SimulationNode, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = nodeDataValueText(node, key);
    if (value) return value;
  }
  return undefined;
}

export function nodeDetailRows(node: SimulationNode): DetailRow[] {
  const rows: DetailRow[] = [];
  if (node.status && node.type !== "topic") {
    rows.push({ label: "状态", value: node.status });
  }
  if (node.locked) rows.push({ label: "锁定", value: "是" });

  switch (node.type) {
    case "topic":
      rows.push({ label: "问题", value: nodeDataText(node, "problem") ?? node.label });
      rows.push({ label: "推演目标", value: nodeDataText(node, "goal") ?? "待确认" });
      rows.push({ label: "时间范围", value: nodeDataText(node, "timeRange") ?? "待确认" });
      rows.push({ label: "空间范围", value: nodeDataText(node, "spaceRange") ?? "待确认" });
      rows.push({ label: "行业", value: nodeDataText(node, "industry") ?? "待确认" });
      rows.push({
        label: "推演状态",
        value: topicDefinitionStateLabel(topicDefinitionState(node)),
      });
      break;
    case "entity":
      for (const [keys, label] of [
        [["goal", "goals"], "利益目标"],
        [["affectedBy"], "受到影响"],
        [["influences", "affects"], "影响对象"],
        [["variables", "variableIds"], "关联变量"],
        [["events", "eventIds"], "关联事件"],
      ] as const) {
        const value = nodeDataFirstValueText(node, [...keys]);
        if (value) rows.push({ label, value });
      }
      break;
    case "variable":
      rows.push({
        label: "当前值",
        value: `${valueLabel(node.value) || "未提供"}${node.valueSchema?.unit ?? ""}`,
      });
      if (node.defaultValue != null) {
        rows.push({
          label: "默认值",
          value: `${valueLabel(node.defaultValue)}${node.valueSchema?.unit ?? ""}`,
        });
      }
      if (node.valueSchema?.options?.length) {
        rows.push({ label: "可选值", value: node.valueSchema.options.join("、") });
      }
      if (node.valueSchema?.range) {
        rows.push({
          label: "范围",
          value: `${node.valueSchema.range[0]} - ${node.valueSchema.range[1]}${node.valueSchema.unit ?? ""}`,
        });
      }
      break;
    case "event":
      for (const [key, label] of [
        ["condition", "发生条件"],
        ["scope", "影响范围"],
        ["variables", "影响变量"],
        ["actors", "影响主体"],
      ] as const) {
        const value = nodeDataValueText(node, key);
        if (value) rows.push({ label, value });
      }
      {
        const probability = percentLabel(node.data?.probability);
        if (probability) rows.push({ label: "发生概率", value: probability });
      }
      break;
    case "hypothesis":
      for (const [key, label] of [
        ["statement", "假设内容"],
        ["scope", "适用范围"],
        ["branchable", "可生成分支"],
      ] as const) {
        const value = nodeDataValueText(node, key);
        if (value) rows.push({ label, value });
      }
      {
        const confidence = percentLabel(node.data?.confidence);
        if (confidence) rows.push({ label: "可信度", value: confidence });
      }
      break;
    case "inference":
      for (const [key, label] of [
        ["rationale", "推理依据"],
        ["modelName", "使用模型"],
        ["model", "使用模型"],
        ["inputNodeIds", "输入节点"],
        ["outputNodeIds", "输出节点"],
        ["counterEvidence", "反证线索"],
      ] as const) {
        const value = nodeDataValueText(node, key);
        if (value) rows.push({ label, value });
      }
      {
        const confidence = percentLabel(node.data?.confidence);
        if (confidence) rows.push({ label: "可信度", value: confidence });
      }
      break;
    case "risk":
      {
        const probability = percentLabel(node.data?.probability);
        const impact = ratingLabel(node.data?.impact);
        const controllability = ratingLabel(node.data?.controllability);
        if (probability) rows.push({ label: "概率", value: probability });
        if (impact) rows.push({ label: "影响等级", value: impact });
        if (controllability) rows.push({ label: "可控程度", value: controllability });
      }
      break;
    case "decision":
      {
        const branches = Array.isArray(node.data?.options)
          ? node.data.options
          : node.data?.branches;
        if (Array.isArray(branches) && branches.length > 0) {
          rows.push({ label: "决策分支", value: branches.map((item) => valueLabel(item)).join(" / ") });
        }
      }
      break;
    case "action":
      for (const [key, label] of [
        ["target", "作用对象"],
        ["expectedEffect", "预期效果"],
        ["cost", "成本"],
      ] as const) {
        const value = nodeDataValueText(node, key);
        if (value) rows.push({ label, value });
      }
      break;
    case "conclusion":
      for (const [keys, label] of [
        [["variableIds", "variables"], "由哪些变量得到"],
        [["evidenceIds", "evidence"], "引用证据"],
        [["hypothesisIds", "assumptions"], "依赖假设"],
        [["riskIds", "risks"], "关联风险"],
        [["scenarioIds", "scenarios"], "关联情景"],
      ] as const) {
        const value = nodeDataFirstValueText(node, [...keys]);
        if (value) rows.push({ label, value });
      }
      break;
    case "evidence":
      for (const [key, label] of [
        ["source", "来源"],
        ["url", "原文链接"],
        ["updatedAt", "更新时间"],
        ["page", "页码"],
        ["quoteLocation", "引用位置"],
        ["quote", "原文摘录"],
        ["citationCount", "引用次数"],
        ["citedByNodeIds", "引用节点"],
      ] as const) {
        const value = nodeDataValueText(node, key);
        if (value) rows.push({ label, value });
      }
      if (node.evidenceCredibility) {
        rows.push({ label: "可信度", value: node.evidenceCredibility });
      }
      break;
  }

  return rows;
}

export function labelsForIds<T extends { id: string; label?: string }>(
  ids: string[],
  source: T[],
): string[] {
  const byId = new Map(source.map((item) => [item.id, item.label ?? item.id]));
  return ids.map((id) => byId.get(id) ?? id);
}

export function diffSetLabels<T extends { id: string; label?: string }>(
  leftIds: string[],
  rightIds: string[],
  source: T[],
): string[] {
  const right = new Set(rightIds);
  return labelsForIds(
    leftIds.filter((id) => !right.has(id)),
    source,
  );
}

export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function labelList(items: Array<{ label?: string; id: string }>, limit = 5): string {
  const labels = items.map((item) => item.label ?? item.id);
  if (labels.length <= limit) return labels.join("、");
  return `${labels.slice(0, limit).join("、")} 等 ${labels.length} 项`;
}

// F2: 读取节点声明的上游依赖（由 skill-world-model 写入，F1 已镜像到顶层 data.upstreamNodeIds）。
export function nodeUpstreamNodeIds(node: SimulationNode): string[] {
  const raw = node.data?.upstreamNodeIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && !!id.trim());
}

export function computeInterventionImpact(
  node: SimulationNode,
  normalized: NormalizedScenario,
): InterventionImpact {
  const allNodes = uniqueById(
    [normalized.prompt, normalized.topic, ...normalized.nodes].filter(
      Boolean,
    ) as SimulationNode[],
  );

  // F2: 下游邻接来自两个来源的并集：
  // 1) 拓扑边 source -> target（原有逻辑）
  // 2) 声明依赖：若节点 B 的 upstreamNodeIds 含 A，则 A -> B 为一条声明依赖边
  // 二者并集修复 I1：边滞后于节点时，声明依赖仍能定位真实下游。
  const outgoingBySource = new Map<string, string[]>();
  const addAdjacency = (source: string, target: string) => {
    if (source === target) return;
    const list = outgoingBySource.get(source) ?? [];
    if (!list.includes(target)) list.push(target);
    outgoingBySource.set(source, list);
  };

  const edgeByEndpoints = new Map<string, SimulationEdge>();
  for (const edge of normalized.edges) {
    addAdjacency(edge.source, edge.target);
    edgeByEndpoints.set(`${edge.source}->${edge.target}`, edge);
  }
  for (const item of allNodes) {
    for (const upstreamId of nodeUpstreamNodeIds(item)) {
      addAdjacency(upstreamId, item.id);
    }
  }

  const affectedNodeIds = new Set<string>();
  const affectedEdgeIds = new Set<string>();
  const queue = [node.id];
  const visited = new Set(queue);
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    for (const targetId of outgoingBySource.get(currentId) ?? []) {
      // 只有真实存在的拓扑边才计入 affectedEdges；声明依赖不凭空造边。
      const edge = edgeByEndpoints.get(`${currentId}->${targetId}`);
      if (edge) affectedEdgeIds.add(edge.id);
      if (!visited.has(targetId)) {
        visited.add(targetId);
        queue.push(targetId);
      }
      if (targetId !== node.id) affectedNodeIds.add(targetId);
    }
  }

  const downstreamNodes = allNodes.filter((item) => affectedNodeIds.has(item.id));
  const affectedEdges = normalized.edges.filter((edge) =>
    affectedEdgeIds.has(edge.id),
  );
  const affectedPathIds = new Set<string>(node.pathIds ?? []);
  for (const item of downstreamNodes) {
    for (const pathId of item.pathIds ?? []) affectedPathIds.add(pathId);
  }
  for (const path of normalized.paths) {
    if (path.edgeIds.some((edgeId) => affectedEdgeIds.has(edgeId))) {
      affectedPathIds.add(path.id);
    }
  }
  const affectedPaths = normalized.paths.filter((path) =>
    affectedPathIds.has(path.id),
  );
  const affectedScenarios = normalized.scenarioViews.filter((scenarioView) => {
    if (scenarioView.nodeIds.includes(node.id)) return true;
    if (scenarioView.nodeIds.some((nodeId) => affectedNodeIds.has(nodeId))) {
      return true;
    }
    if (scenarioView.edgeIds.some((edgeId) => affectedEdgeIds.has(edgeId))) {
      return true;
    }
    return scenarioView.pathIds.some((pathId) => affectedPathIds.has(pathId));
  });

  // F2: staleCandidates = 下游节点中会因本次干预而需要重新评估的节点。
  // 排除 locked（受保护）与已是 historical/failed 的节点，避免重复作废。
  const staleCandidates = downstreamNodes.filter(
    (item) =>
      !item.locked &&
      item.status !== "historical" &&
      item.status !== "failed",
  );

  return {
    downstreamNodes,
    affectedEdges,
    affectedPaths,
    affectedScenarios,
    staleCandidates,
  };
}

export function formatInterventionImpact(impact?: InterventionImpact | null): string[] {
  if (!impact) return [];
  const lines = [
    impact.downstreamNodes.length
      ? `预计影响节点：${labelList(impact.downstreamNodes)}`
      : "预计影响节点：当前画布未识别明确下游节点，请先评估相关层。",
    impact.affectedEdges.length
      ? `预计影响边：${labelList(impact.affectedEdges)}`
      : undefined,
    impact.affectedPaths.length
      ? `预计影响路径：${labelList(impact.affectedPaths)}`
      : "预计影响路径：当前画布未建立明确路径关系，请重新评估全部路径。",
    impact.affectedScenarios.length
      ? `预计影响情景：${labelList(impact.affectedScenarios)}`
      : undefined,
    // F2: 明确告知 AI 哪些下游节点需要重算/作废，驱动 wave-protocol 的 rerun 语义。
    impact.staleCandidates.length
      ? `需重新评估节点（请标记为 historical/updated，不要静默删除）：${labelList(impact.staleCandidates)}`
      : undefined,
  ];
  return lines.filter(Boolean) as string[];
}

export function interventionImpactLabel(intervention: SimulationIntervention): string {
  const preview = intervention.impactPreview;
  if (!preview) return "";
  const previewItems = (labels: string[] | undefined, ids: string[] | undefined) =>
    labels?.length ? labels : ids ?? [];
  const nodeItems = previewItems(preview.affectedNodeLabels, preview.affectedNodeIds);
  const edgeItems = previewItems(preview.affectedEdgeLabels, preview.affectedEdgeIds);
  const pathItems = previewItems(preview.affectedPathLabels, preview.affectedPathIds);
  const scenarioItems = previewItems(
    preview.affectedScenarioLabels,
    preview.affectedScenarioIds,
  );
  const parts = [
    nodeItems.length ? `节点 ${nodeItems.join("、")}` : "",
    edgeItems.length ? `边 ${edgeItems.join("、")}` : "",
    pathItems.length ? `路径 ${pathItems.join("、")}` : "",
    scenarioItems.length ? `情景 ${scenarioItems.join("、")}` : "",
  ].filter(Boolean);
  return parts.length ? `；影响 ${parts.join(" / ")}` : "";
}

export function interventionTargetLabel(intervention: SimulationIntervention): string {
  const nodeLikeTypes = new Set([
    "prompt",
    "topic",
    "entity",
    "variable",
    "event",
    "evidence",
    "hypothesis",
    "inference",
    "risk",
    "decision",
    "action",
    "conclusion",
    "next_action",
    "suggestion",
  ]);
  if (intervention.sourceNodeType === "path") {
    return `path:${intervention.sourceNodeId}`;
  }
  if (intervention.sourceNodeType === "edge") {
    return `edge:${intervention.sourceNodeId}`;
  }
  if (nodeLikeTypes.has(intervention.sourceNodeType)) {
    return `node:${intervention.sourceNodeId}`;
  }
  return `${intervention.sourceNodeType}:${intervention.sourceNodeId}`;
}

export function interventionSummaryLines(interventions: SimulationIntervention[]): string[] {
  return interventions.slice(-3).map((intervention) => {
    const target = interventionTargetLabel(intervention);
    return `${intervention.kind} → ${target}${interventionImpactLabel(intervention)}`;
  });
}

export function scenarioDiff(
  selected: ScenarioView | null,
  scenarioViews: ScenarioView[],
  nodes: SimulationNode[],
  edges: SimulationEdge[],
  paths: SimulationPath[],
): ScenarioDiff | null {
  if (!selected) return null;
  const baseline =
    scenarioViews.find((view) => view.id === "baseline") ??
    scenarioViews.find((view) => view.label.toLowerCase() === "baseline") ??
    scenarioViews.find((view) => view.id !== selected.id);
  if (!baseline || baseline.id === selected.id) return null;
  return {
    baseline,
    addedNodes: diffSetLabels(selected.nodeIds, baseline.nodeIds, nodes),
    removedNodes: diffSetLabels(baseline.nodeIds, selected.nodeIds, nodes),
    addedEdges: diffSetLabels(selected.edgeIds, baseline.edgeIds, edges),
    removedEdges: diffSetLabels(baseline.edgeIds, selected.edgeIds, edges),
    addedPaths: diffSetLabels(selected.pathIds, baseline.pathIds, paths),
    removedPaths: diffSetLabels(baseline.pathIds, selected.pathIds, paths),
  };
}

export function scenarioContextLines(
  scenarioView: ScenarioView,
  diff: ScenarioDiff | null,
): string[] {
  return [
    `Scenario ID：${scenarioView.id}`,
    `Scenario：${scenarioView.label}`,
    scenarioView.summary ? `摘要：${scenarioView.summary}` : "",
    scenarioView.probability != null
      ? `概率：${Math.round(scenarioView.probability * 100)}%`
      : "",
    scenarioView.pathIds.length ? `Path IDs：${scenarioView.pathIds.join("、")}` : "",
    scenarioView.nodeIds.length ? `Node IDs：${scenarioView.nodeIds.join("、")}` : "",
    scenarioView.edgeIds.length ? `Edge IDs：${scenarioView.edgeIds.join("、")}` : "",
    diff?.baseline ? `Baseline Scenario ID：${diff.baseline.id}` : "",
    diff?.addedNodes.length ? `相对 Baseline 新增节点：${diff.addedNodes.join("、")}` : "",
    diff?.removedNodes.length
      ? `相对 Baseline 缺失节点：${diff.removedNodes.join("、")}`
      : "",
    diff?.addedEdges.length ? `相对 Baseline 新增边：${diff.addedEdges.join("、")}` : "",
    diff?.removedEdges.length ? `相对 Baseline 缺失边：${diff.removedEdges.join("、")}` : "",
    diff?.addedPaths.length ? `相对 Baseline 新增路径：${diff.addedPaths.join("、")}` : "",
    diff?.removedPaths.length ? `相对 Baseline 缺失路径：${diff.removedPaths.join("、")}` : "",
  ].filter(Boolean);
}

export function pathContextLines(
  path: SimulationPath,
  scenarioViews: ScenarioView[],
  edges: SimulationEdge[],
): string[] {
  const relatedScenarioIds = scenarioViews
    .filter((scenarioView) => scenarioView.pathIds.includes(path.id))
    .map((scenarioView) => scenarioView.id);
  const relatedNodeIds = Array.from(
    new Set(
      edges
        .filter((edge) => path.edgeIds.includes(edge.id))
        .flatMap((edge) => [edge.source, edge.target]),
    ),
  );

  return [
    `路径 ID：${path.id}`,
    `路径名称：${path.label}`,
    `路径状态：${path.status}`,
    `Round ID：${path.roundId}`,
    path.probability != null ? `概率：${Math.round(path.probability * 100)}%` : "",
    path.summary ? `路径摘要：${path.summary}` : "",
    path.edgeIds.length ? `Edge IDs：${path.edgeIds.join("、")}` : "",
    relatedNodeIds.length ? `Node IDs：${relatedNodeIds.join("、")}` : "",
    relatedScenarioIds.length ? `Scenario IDs：${relatedScenarioIds.join("、")}` : "",
  ].filter(Boolean);
}

export function topicTitle(scenario: Scenario): string {
  if (typeof scenario.topic === "string") return scenario.topic;
  return (
    nodeDataText(scenario.topic, "problem") ??
    scenario.topic.label ??
    "推演问题定义"
  );
}

export function topicDetail(scenario: Scenario): string {
  if (typeof scenario.topic === "string") return scenario.topic;
  const lines = [
    nodeDataText(scenario.topic, "problem")
      ? `问题：${nodeDataText(scenario.topic, "problem")}`
      : undefined,
    nodeDataText(scenario.topic, "goal")
      ? `推演目标：${nodeDataText(scenario.topic, "goal")}`
      : undefined,
    nodeDataText(scenario.topic, "timeRange")
      ? `时间范围：${nodeDataText(scenario.topic, "timeRange")}`
      : undefined,
    nodeDataText(scenario.topic, "spaceRange")
      ? `空间范围：${nodeDataText(scenario.topic, "spaceRange")}`
      : undefined,
    nodeDataText(scenario.topic, "industry")
      ? `行业：${nodeDataText(scenario.topic, "industry")}`
      : undefined,
    nodeDataText(scenario.topic, "state")
      ? `状态：${nodeDataText(scenario.topic, "state")}`
      : undefined,
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : (scenario.topic.detail ?? scenario.topic.label);
}

export function normalizeScenario(scenario: Scenario): NormalizedScenario {
  const roundId =
    scenario.roundId ??
    scenario.prompt?.roundId ??
    (typeof scenario.topic === "string" ? undefined : scenario.topic.roundId) ??
    scenario.entities[0]?.roundId ??
    scenario.variables[0]?.roundId ??
    "round_1";
  const topic: SimulationNode =
    typeof scenario.topic === "string"
      ? {
          id: "topic_definition",
          type: "topic",
          label: topicTitle(scenario),
          detail: topicDetail(scenario),
          roundId,
          status: "active",
          data: scenario.topicDefinition,
        }
      : {
          ...scenario.topic,
          id: scenario.topic.id || "topic_definition",
          type: "topic",
          detail: scenario.topic.detail ?? topicDetail(scenario),
        };
  const topicPendingConfirmation = isTopicDefinitionPending(topic);
  const nodeById = new Map<string, SimulationNode>();
  const structuredNodes = topicPendingConfirmation
    ? []
    : [...scenario.entities, ...scenario.variables, ...(scenario.nodes ?? [])];
  for (const node of structuredNodes) {
    if (node.id === topic.id || node.id === scenario.prompt?.id) continue;
    nodeById.set(node.id, node);
  }
  const questionLayerNodeIds = new Set(
    [scenario.prompt?.id, topic.id].filter(Boolean) as string[],
  );
  const edges = topicPendingConfirmation
    ? scenario.edges.filter(
        (edge) =>
          questionLayerNodeIds.has(edge.source) &&
          questionLayerNodeIds.has(edge.target),
      )
    : scenario.edges;
  return {
    prompt: scenario.prompt,
    topic,
    nodes: [...nodeById.values()],
    edges,
    paths: topicPendingConfirmation ? [] : scenario.paths,
    scenarioViews: topicPendingConfirmation ? [] : (scenario.scenarios ?? []),
    interventions: scenario.interventions ?? [],
  };
}

import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CanvasSnapshot, ChatPart } from "@jlc/contracts";

type SimulationScenario = Extract<
  ChatPart,
  { kind: "simulation_scenario" }
>["scenario"];
type SimulationNode = Extract<ChatPart, { kind: "simulation_node" }>["node"];

const FALLBACK_REPORT_MARKER = "<!--JLC:SIMULATION_REPORT_FALLBACK-->";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function valueLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "未提供";
  return JSON.stringify(value);
}

function simulationTopicText(topic: SimulationScenario["topic"]): string {
  if (typeof topic === "string") return topic;
  const problem = topic.data?.problem;
  return typeof problem === "string" && problem.trim()
    ? problem
    : topic.label || "推演报告";
}

function mergeNodesById(items: Array<SimulationNode | undefined>): SimulationNode[] {
  const nodes = new Map<string, SimulationNode>();
  for (const item of items) {
    if (!item) continue;
    nodes.set(item.id, { ...nodes.get(item.id), ...item });
  }
  return [...nodes.values()];
}

function scenarioNodes(scenario: SimulationScenario): SimulationNode[] {
  const topicNode = typeof scenario.topic === "string" ? undefined : scenario.topic;
  return mergeNodesById([
    scenario.prompt,
    topicNode,
    ...(scenario.nodes ?? []),
    ...scenario.entities,
    ...scenario.variables,
  ]);
}

function nodeTypeLabel(type: SimulationNode["type"]): string {
  switch (type) {
    case "entity":
      return "主体";
    case "variable":
      return "变量";
    case "hypothesis":
      return "假设";
    case "event":
      return "事件";
    case "inference":
      return "推理";
    case "evidence":
      return "证据";
    case "risk":
      return "风险";
    case "decision":
      return "决策";
    case "action":
      return "行动";
    case "conclusion":
      return "结论";
    case "scenario":
      return "情景";
    case "summary":
      return "总结";
    case "report":
      return "报告";
    case "next_action":
      return "下一步";
    case "history":
      return "历史";
    case "recovery":
      return "恢复";
    case "prompt":
      return "原问题";
    case "topic":
      return "问题定义";
    case "suggestion":
      return "建议";
  }
}

function selectionLabel(snapshot?: CanvasSnapshot | null): string[] {
  if (!snapshot) return [];
  const lines: string[] = [];
  for (const selection of snapshot.selections) {
    if (selection.type === "path" && selection.targetId) {
      const path = snapshot.paths.find((item) => item.id === selection.targetId);
      lines.push(
        `- 已选择路径：[path: ${selection.targetId}] ${path?.label ?? selection.targetId}`,
      );
    }
    if (selection.type === "variable" && selection.targetId) {
      const variable = snapshot.nodes.find((item) => item.id === selection.targetId);
      lines.push(
        `- 已调整变量：[node: ${selection.targetId}] ${variable?.label ?? selection.targetId} → ${valueLabel(selection.value)}`,
      );
    }
    if (selection.type === "scenario" && selection.targetId) {
      const scenario = snapshot.scenarios?.find(
        (item) => item.id === selection.targetId,
      );
      lines.push(
        `- 已选择情景：[scenario: ${selection.targetId}] ${scenario?.label ?? selection.targetId}`,
      );
    }
    if (selection.type === "entry") {
      lines.push("- 已确认入口设定：主题、范围、主体、变量和默认假设已进入本轮沙盘。");
    }
  }
  return lines;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function traceTargetLabel(sourceNodeType: unknown, sourceNodeId: string): string {
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
  const type = typeof sourceNodeType === "string" ? sourceNodeType : "node";
  if (type === "path") {
    return `[path: ${sourceNodeId}]`;
  }
  if (type === "edge") {
    return `[edge: ${sourceNodeId}]`;
  }
  if (nodeLikeTypes.has(type)) {
    return `[node: ${sourceNodeId}]`;
  }
  return `[${type}: ${sourceNodeId}]`;
}

function actionLabel(snapshot?: CanvasSnapshot | null): string[] {
  if (!snapshot) return [];
  return snapshot.actions.flatMap((action) => {
    if (action.type === "path_deepen" && action.targetId) {
      return [`- 本轮动作：围绕 [path: ${action.targetId}] 继续深挖。`];
    }
    if (action.type === "variable_resimulate" && action.targetId) {
      return [`- 本轮动作：基于 [node: ${action.targetId}] 的新假设重算路径。`];
    }
    if (action.type === "entry_confirm") {
      return ["- 本轮动作：确认初始设定并生成基础沙盘。"];
    }
    if (action.type === "node_intervention" && action.targetId) {
      const payload = recordValue(action.payload);
      const kind =
        typeof payload.interventionKind === "string"
          ? payload.interventionKind
          : "node_intervention";
      const target = traceTargetLabel(payload.sourceNodeType, action.targetId);
      return [`- 本轮动作：${kind} 作用于 ${target}。`];
    }
    return [];
  });
}

function formatImpactPreview(
  intervention: NonNullable<CanvasSnapshot["interventions"]>[number],
): string {
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
    nodeItems.length ? `影响节点：${nodeItems.join("、")}` : "",
    edgeItems.length ? `影响边：${edgeItems.join("、")}` : "",
    pathItems.length ? `影响路径：${pathItems.join("、")}` : "",
    scenarioItems.length ? `影响情景：${scenarioItems.join("、")}` : "",
  ].filter(Boolean);
  return parts.length ? `；${parts.join("；")}` : "";
}

function interventionLabel(snapshot?: CanvasSnapshot | null): string[] {
  if (!snapshot?.interventions?.length) return [];
  return snapshot.interventions.map((intervention) => {
    const target = traceTargetLabel(intervention.sourceNodeType, intervention.sourceNodeId);
    return `- 干预：${intervention.kind} → ${target}${formatImpactPreview(intervention)}`;
  });
}

function buildReportMarkdown(
  scenario: SimulationScenario,
  snapshot?: CanvasSnapshot | null,
): string {
  const firstPathId = scenario.paths[0]?.id ?? "path_base";
  const nodes = scenarioNodes(scenario);
  const variables = nodes.filter((node) => node.type === "variable");
  const entities = nodes.filter((node) => node.type === "entity");
  const reasoningNodes = nodes.filter(
    (node) =>
      node.type !== "prompt" &&
      node.type !== "topic" &&
      node.type !== "entity" &&
      node.type !== "variable",
  );
  const firstVariableId = variables[0]?.id ?? nodes[0]?.id ?? "var_1";
  const topic = simulationTopicText(scenario.topic);
  const assumptions = scenario.assumptions ?? [];
  const selectionLines = selectionLabel(snapshot);
  const actionLines = actionLabel(snapshot);
  const interventionLines = interventionLabel(snapshot);
  const traceLines =
    selectionLines.length || actionLines.length || interventionLines.length
      ? [...selectionLines, ...actionLines, ...interventionLines]
      : ["- 当前报告未检测到用户路径选择或变量覆盖；后续重算会保留新轮次快照。"];
  return [
    FALLBACK_REPORT_MARKER,
    "",
    `# ${topic || "推演报告"}`,
    "",
    "## 执行摘要",
    "",
    `- [path: ${firstPathId}] 当前沙盘已形成 ${scenario.paths.length} 条路径、${nodes.length} 个可干预节点、${variables.length} 个关键变量。`,
    `- [node: ${firstVariableId}] 变量变化会影响后续路径重算，应优先观察。`,
    "",
    "## 推演边界",
    "",
    `- 主题：${topic || "未命名推演"}`,
    `- 默认假设：${assumptions.length ? assumptions.join("；") : "未提供"}`,
    "",
    "## 世界模型与关键变量",
    "",
    ...(entities.length
      ? entities.map((entity) => `- [node: ${entity.id}] ${entity.label}${entity.detail ? `：${entity.detail}` : ""}`)
      : ["- 当前报告未检测到明确主体节点。"]),
    ...variables.map(
      (variable) =>
        `- [node: ${variable.id}] ${variable.label}：当前假设 ${valueLabel(variable.value)}${variable.detail ? `；${variable.detail}` : ""}`,
    ),
    "",
    "## 推理链与干预节点",
    "",
    ...(reasoningNodes.length
      ? reasoningNodes.map(
          (node) =>
            `- [node: ${node.id}] ${nodeTypeLabel(node.type)} / ${node.label}${node.detail ? `：${node.detail}` : ""}`,
        )
      : ["- 当前报告未检测到推理、证据、风险、决策或行动节点。"]),
    "",
    "## 路径对比",
    "",
    ...scenario.paths.map(
      (path) =>
        `- [path: ${path.id}] ${path.label}${typeof path.probability === "number" ? `（${Math.round(path.probability * 100)}%）` : ""}：${path.summary ?? "暂无摘要"}`,
    ),
    "",
    "## 变量调整记录",
    "",
    ...traceLines,
    "",
    "## 证据与不确定性",
    "",
    "- 本报告由当前结构化沙盘生成；关键证据应在后续轮次继续补充。",
    "",
    "## 后续建议",
    "",
    "- 选择一条路径继续深挖，或调整关键变量后确认重算。",
    "",
  ].join("\n");
}

export async function ensureSimulationReportFallback(input: {
  cwd: string;
  scenario: SimulationScenario | null;
  snapshot?: CanvasSnapshot | null;
}): Promise<{ relativePaths: string[] } | null> {
  if (!input.scenario) return null;
  const reportPath = join(input.cwd, "simulation-report.md");
  if (await exists(reportPath)) {
    const existing = await readFile(reportPath, "utf8").catch(() => "");
    if (!existing.includes(FALLBACK_REPORT_MARKER)) return null;
  }
  await writeFile(
    reportPath,
    buildReportMarkdown(input.scenario, input.snapshot),
    "utf8",
  );
  return { relativePaths: ["simulation-report.md"] };
}

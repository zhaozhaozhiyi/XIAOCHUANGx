import { createHash, randomUUID } from "node:crypto";
import type {
  SimulationActionRecord,
  SimulationImpactPreview,
  SimulationIntervention,
  SimulationInterventionKind,
  SimulationNodeType,
  SimulationSelectionResult,
  SimulationStageId,
} from "@jlc/contracts";

function firstMatch(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1]?.trim();
}

function stableId(prefix: string, text: string, roundId: string): string {
  const digest = createHash("sha1")
    .update(`${roundId}\n${text}`)
    .digest("hex")
    .slice(0, 10);
  return `${prefix}_${digest}`;
}

function lineValue(text: string, label: string): string | undefined {
  return firstMatch(text, new RegExp(`^${label}[：:]\\s*(.+)$`, "m"));
}

function isSimulationStageId(value: string | undefined): value is SimulationStageId {
  return (
    value === "question" ||
    value === "entity" ||
    value === "hypothesis" ||
    value === "variable" ||
    value === "risk" ||
    value === "reasoning" ||
    value === "scenario" ||
    value === "output"
  );
}

function stageIdFromText(text: string): SimulationStageId | undefined {
  const explicit = lineValue(text, "Stage ID") ?? lineValue(text, "stageId");
  if (isSimulationStageId(explicit)) return explicit;
  const stageLine = lineValue(text, "当前阶段");
  const match = stageLine?.match(/\(([^)]+)\)/);
  return isSimulationStageId(match?.[1]) ? match[1] : undefined;
}

function waveIdFromText(text: string): string | undefined {
  return lineValue(text, "当前 wave") ?? lineValue(text, "waveId");
}

function withStageContext<T extends SimulationIntervention>(
  intervention: T,
  text: string,
): T {
  const stageId = stageIdFromText(text);
  const waveId = waveIdFromText(text);
  return {
    ...intervention,
    ...(stageId ? { stageId } : {}),
    ...(waveId ? { waveId } : {}),
  };
}

function operationValue(text: string): string | undefined {
  return lineValue(text, "操作");
}

function listValue(text: string, label: string): string[] {
  const raw = lineValue(text, label);
  if (!raw) return [];
  return raw
    .replace(/\s*等\s*\d+\s*项\s*$/u, "")
    .split(/[、,，]/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !item.startsWith("当前画布未"));
}

function impactPreviewFromText(text: string): SimulationImpactPreview | undefined {
  const affectedNodeLabels = listValue(text, "预计影响节点");
  const affectedEdgeLabels = listValue(text, "预计影响边");
  const affectedPathLabels = listValue(text, "预计影响路径");
  const affectedScenarioLabels = listValue(text, "预计影响情景");
  if (
    !affectedNodeLabels.length &&
    !affectedEdgeLabels.length &&
    !affectedPathLabels.length &&
    !affectedScenarioLabels.length
  ) {
    return undefined;
  }
  return {
    affectedNodeIds: [],
    affectedEdgeIds: [],
    affectedPathIds: [],
    affectedScenarioIds: [],
    affectedNodeLabels,
    affectedEdgeLabels,
    affectedPathLabels,
    affectedScenarioLabels,
    reason: "parsed_from_structured_message",
  };
}

function scenarioInterventionKind(text: string): SimulationInterventionKind {
  if (/反事实|Counterfactual/i.test(text)) return "scenario_counterfactual";
  if (/对比/.test(text)) return "scenario_compare";
  return "scenario_continue";
}

function riskInterventionKind(operation: string | undefined): SimulationInterventionKind {
  if (operation === "压力测试") return "risk_stress_test";
  return "risk_mitigate";
}

function inferenceInterventionKind(operation: string | undefined): SimulationInterventionKind {
  if (operation === "反证") return "inference_challenge";
  return "inference_rerun";
}

function simulationNodeTypeFromLabel(label: string | undefined): SimulationNodeType | undefined {
  switch (label) {
    case "prompt":
    case "原问题":
      return "prompt";
    case "topic":
    case "问题定义":
      return "topic";
    case "entity":
    case "主体":
      return "entity";
    case "variable":
    case "变量":
      return "variable";
    case "hypothesis":
    case "假设":
      return "hypothesis";
    case "event":
    case "事件":
      return "event";
    case "conclusion":
    case "结论":
      return "conclusion";
    case "risk":
    case "风险":
      return "risk";
    case "evidence":
    case "依据":
    case "证据":
      return "evidence";
    case "inference":
    case "推理":
      return "inference";
    case "decision":
    case "决策":
      return "decision";
    case "action":
    case "行动":
      return "action";
    case "scenario":
    case "情景":
      return "scenario";
    case "next_action":
    case "下一步":
      return "next_action";
    case "history":
    case "历史":
      return "history";
    case "suggestion":
    case "续推建议":
      return "suggestion";
    case "summary":
    case "阶段总结":
      return "summary";
    case "report":
    case "本地报告":
      return "report";
    case "recovery":
    case "异常恢复":
      return "recovery";
    default:
      return undefined;
  }
}

function simulationNodeTypeFromId(id: string | undefined): SimulationNodeType | undefined {
  if (!id) return undefined;
  if (id === "prompt" || id.startsWith("prompt_")) return "prompt";
  if (id === "topic" || id.startsWith("topic_")) return "topic";
  if (id.startsWith("entity_")) return "entity";
  if (id.startsWith("var_") || id.startsWith("variable_")) return "variable";
  if (id.startsWith("event_")) return "event";
  if (id.startsWith("evidence_")) return "evidence";
  if (id.startsWith("hypothesis_")) return "hypothesis";
  if (id.startsWith("inference_")) return "inference";
  if (id.startsWith("risk_")) return "risk";
  if (id.startsWith("decision_")) return "decision";
  if (id.startsWith("action_")) return "action";
  if (id.startsWith("conclusion_")) return "conclusion";
  if (id.startsWith("scenario_")) return "scenario";
  if (id.startsWith("summary_") || id.startsWith("simulation_summary")) {
    return "summary";
  }
  if (id.startsWith("report_") || id.startsWith("simulation_deliverables")) {
    return "report";
  }
  if (id.startsWith("next_action_")) return "next_action";
  if (id.startsWith("history_") || id.startsWith("round_")) return "history";
  if (id.startsWith("recovery_") || id.includes("error")) return "recovery";
  return undefined;
}

function recoveryNodeId(text: string): string | undefined {
  return lineValue(text, "错误代码") ?? lineValue(text, "错误") ?? undefined;
}

function structuredNodeIntervention(input: {
  text: string;
  roundId: string;
  createdAt: string;
}): SimulationIntervention | null {
  const operation = operationValue(input.text);
  const impactPreview = impactPreviewFromText(input.text);
  const candidates: Array<{
    label: string;
    nodeType: SimulationNodeType;
    kind: SimulationInterventionKind | ((operation?: string) => SimulationInterventionKind);
    requiresConfirmation?: boolean;
  }> = [
    { label: "Prompt ID", nodeType: "prompt", kind: "prompt_reparse" },
    {
      label: "Topic ID",
      nodeType: "topic",
      kind: operation === "确认" ? "topic_confirm" : "topic_edit",
    },
    { label: "Entity ID", nodeType: "entity", kind: "entity_update" },
    { label: "Event ID", nodeType: "event", kind: "event_assumption" },
    { label: "Evidence ID", nodeType: "evidence", kind: "evidence_update" },
    { label: "Hypothesis ID", nodeType: "hypothesis", kind: "hypothesis_update" },
    { label: "Inference ID", nodeType: "inference", kind: inferenceInterventionKind },
    { label: "Risk ID", nodeType: "risk", kind: riskInterventionKind },
    { label: "Decision ID", nodeType: "decision", kind: "decision_select" },
    { label: "Conclusion ID", nodeType: "conclusion", kind: "conclusion_challenge" },
  ];

  for (const candidate of candidates) {
    const sourceNodeId = lineValue(input.text, candidate.label);
    if (!sourceNodeId) continue;
    const kind =
      typeof candidate.kind === "function"
        ? candidate.kind(operation)
        : candidate.kind;
    return {
      id: stableId(
        "intervention_node",
        `${candidate.label}\n${sourceNodeId}\n${operation ?? ""}\n${input.text}`,
        input.roundId,
      ),
      kind,
      sourceNodeId,
      sourceNodeType: candidate.nodeType,
      payload: { operation, source: "structured_node_message" },
      impactPreview,
      requiresConfirmation: candidate.requiresConfirmation ?? true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const genericNodeId = lineValue(input.text, "节点 ID");
  const genericNodeType = simulationNodeTypeFromLabel(lineValue(input.text, "节点类型"));
  if (genericNodeId && genericNodeType) {
    return {
      id: stableId(
        "intervention_node_expand",
        `${genericNodeId}\n${genericNodeType}\n${input.text}`,
        input.roundId,
      ),
      kind: "node_expand",
      sourceNodeId: genericNodeId,
      sourceNodeType: genericNodeType,
      payload: {
        source: "node_expand",
        nodeName: lineValue(input.text, "节点名称"),
        nodeDetail: lineValue(input.text, "节点说明"),
      },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const scenarioId = lineValue(input.text, "Scenario ID");
  if (scenarioId) {
    return {
      id: stableId("intervention_scenario", `${scenarioId}\n${input.text}`, input.roundId),
      kind: scenarioInterventionKind(input.text),
      sourceNodeId: scenarioId,
      sourceNodeType: "scenario",
      scenarioId,
      payload: { source: "scenario_selector" },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const summaryId = lineValue(input.text, "Summary ID");
  if (summaryId) {
    return {
      id: stableId("intervention_summary", `${summaryId}\n${operation ?? ""}\n${input.text}`, input.roundId),
      kind: "summary_continue",
      sourceNodeId: summaryId,
      sourceNodeType: "summary",
      payload: { operation, source: "summary_actions" },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const deliverablesId = lineValue(input.text, "Deliverables ID");
  if (deliverablesId) {
    return {
      id: stableId(
        "intervention_report",
        `${deliverablesId}\n${operation ?? ""}\n${input.text}`,
        input.roundId,
      ),
      kind: "report_update",
      sourceNodeId: deliverablesId,
      sourceNodeType: "report",
      payload: {
        operation,
        source: "report_actions",
        primaryPath: lineValue(input.text, "主文件"),
        workspaceProjectId: lineValue(input.text, "Workspace Project"),
      },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const historyLabel = lineValue(input.text, "History");
  const historyRoundId = lineValue(input.text, "Round ID");
  if (historyLabel || historyRoundId) {
    const sourceNodeId = historyRoundId ?? historyLabel ?? "history";
    return {
      id: stableId(
        "intervention_history",
        `${sourceNodeId}\n${operation ?? ""}\n${input.text}`,
        input.roundId,
      ),
      kind: "history_restore",
      sourceNodeId,
      sourceNodeType: "history",
      payload: {
        operation,
        source: "history_actions",
        label: historyLabel,
      },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  if (/请处理这个推演恢复节点/.test(input.text)) {
    const sourceNodeId = recoveryNodeId(input.text) ?? "recovery";
    return {
      id: stableId(
        "intervention_recovery",
        `${sourceNodeId}\n${operation ?? ""}\n${input.text}`,
        input.roundId,
      ),
      kind: "recovery_retry",
      sourceNodeId,
      sourceNodeType: "recovery",
      payload: {
        operation,
        source: "recovery_actions",
        savedNodeCount: lineValue(input.text, "已保存节点"),
        pathStatus: lineValue(input.text, "路径状态"),
      },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  const actionId = lineValue(input.text, "Action ID");
  if (actionId) {
    const isNextAction = /请执行这条推演下一步动作/.test(input.text);
    return {
      id: stableId("intervention_action", `${actionId}\n${operation ?? ""}\n${input.text}`, input.roundId),
      kind: isNextAction ? "next_action_execute" : "action_simulate",
      sourceNodeId: actionId,
      sourceNodeType: isNextAction ? "next_action" : "action",
      payload: { operation, source: isNextAction ? "next_action" : "structured_node_message" },
      impactPreview,
      requiresConfirmation: true,
      roundId: input.roundId,
      createdAt: input.createdAt,
    };
  }

  return null;
}

export function inferSimulationActionTrace(input: {
  userText: string;
  roundId: string;
  createdAt?: string;
  binding?: {
    scope?: "node" | "path" | "variable" | "counterfactual" | "resimulate";
    targetId?: string;
    variableOverrides?: Record<string, unknown>;
  };
}): {
  selections: SimulationSelectionResult[];
  actions: SimulationActionRecord[];
  interventions: SimulationIntervention[];
} {
  const text = input.userText.trim();
  const createdAt = input.createdAt ?? new Date().toISOString();
  const impactPreview = impactPreviewFromText(text);

  const boundPathId =
    input.binding?.scope === "path" ? input.binding.targetId : undefined;
  const pathId = boundPathId ?? firstMatch(text, /^路径 ID[：:]\s*(.+)$/m);
  if (pathId) {
    const id = stableId("selection_path", `${pathId}\n${text}`, input.roundId);
    return {
      selections: [
        {
          id,
          type: "path",
          targetId: pathId,
          roundId: input.roundId,
          createdAt,
        },
      ],
      actions: [
        {
          id: stableId("action_path", `${pathId}\n${text}`, input.roundId),
          type: "path_deepen",
          targetId: pathId,
          payload: { source: "path_selector" },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [
        withStageContext({
          id: stableId("intervention_path", `${pathId}\n${text}`, input.roundId),
          kind: "path_continue",
          sourceNodeId: pathId,
          sourceNodeType: "path",
          pathId,
          payload: { source: "path_selector" },
          requiresConfirmation: true,
          roundId: input.roundId,
          createdAt,
        }, text),
      ],
    };
  }

  const boundVariableId =
    input.binding?.scope === "variable" ? input.binding.targetId : undefined;
  const variableId =
    boundVariableId ?? firstMatch(text, /^变量 ID[：:]\s*(.+)$/m);
  if (variableId) {
    const nextValue =
      input.binding?.variableOverrides?.[variableId] ??
      firstMatch(text, /^新假设[：:]\s*(.+)$/m);
    const id = stableId(
      "selection_variable",
      `${variableId}\n${nextValue ?? ""}\n${text}`,
      input.roundId,
    );
    return {
      selections: [
        {
          id,
          type: "variable",
          targetId: variableId,
          value: nextValue,
          roundId: input.roundId,
          createdAt,
        },
      ],
      actions: [
        {
          id: stableId(
            "action_variable",
            `${variableId}\n${nextValue ?? ""}\n${text}`,
            input.roundId,
          ),
          type: "variable_resimulate",
          targetId: variableId,
          payload: { nextValue, source: "variable_controller" },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [
        withStageContext({
          id: stableId(
            "intervention_variable",
            `${variableId}\n${nextValue ?? ""}\n${text}`,
            input.roundId,
          ),
          kind: "variable_override",
          sourceNodeId: variableId,
          sourceNodeType: "variable",
          payload: { nextValue, source: "variable_controller" },
          impactPreview,
          requiresConfirmation: true,
          roundId: input.roundId,
          createdAt,
        }, text),
      ],
    };
  }

  if (input.binding?.scope === "node" && input.binding.targetId) {
    const sourceNodeType =
      simulationNodeTypeFromLabel(lineValue(text, "节点类型")) ??
      simulationNodeTypeFromId(input.binding.targetId) ??
      "suggestion";
    return {
      selections: [],
      actions: [
        {
          id: stableId(
            "action_node_binding",
            `${input.binding.targetId}\n${sourceNodeType}\n${text}`,
            input.roundId,
          ),
          type: "node_intervention",
          targetId: input.binding.targetId,
          payload: {
            interventionKind: "node_expand",
            sourceNodeType,
            source: "binding",
          },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [
        withStageContext({
          id: stableId(
            "intervention_node_binding",
            `${input.binding.targetId}\n${sourceNodeType}\n${text}`,
            input.roundId,
          ),
          kind: "node_expand",
          sourceNodeId: input.binding.targetId,
          sourceNodeType,
          payload: {
            source: "binding",
            nodeName: lineValue(text, "节点名称"),
            nodeDetail: lineValue(text, "节点说明"),
          },
          impactPreview,
          requiresConfirmation: true,
          roundId: input.roundId,
          createdAt,
        }, text),
      ],
    };
  }

  if (input.binding?.scope === "counterfactual" || input.binding?.scope === "resimulate") {
    const scenarioId =
      input.binding.targetId ??
      lineValue(text, "Scenario ID") ??
      (input.binding.scope === "counterfactual" ? "counterfactual" : "current_scenario");
    const kind: SimulationInterventionKind =
      input.binding.scope === "counterfactual"
        ? "scenario_counterfactual"
        : "scenario_continue";
    const selectionId = stableId(
      "selection_scenario_binding",
      `${input.binding.scope}\n${scenarioId}\n${text}`,
      input.roundId,
    );
    return {
      selections: [
        {
          id: selectionId,
          type: "scenario",
          targetId: scenarioId,
          roundId: input.roundId,
          createdAt,
        },
      ],
      actions: [
        {
          id: stableId(
            "action_scenario_binding",
            `${input.binding.scope}\n${scenarioId}\n${text}`,
            input.roundId,
          ),
          type: "node_intervention",
          targetId: scenarioId,
          payload: {
            interventionKind: kind,
            sourceNodeType: "scenario",
            source: "binding",
          },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [
        withStageContext({
          id: stableId(
            "intervention_scenario_binding",
            `${input.binding.scope}\n${scenarioId}\n${text}`,
            input.roundId,
          ),
          kind,
          sourceNodeId: scenarioId,
          sourceNodeType: "scenario",
          scenarioId,
          payload: { source: "binding", scope: input.binding.scope },
          impactPreview,
          requiresConfirmation: true,
          roundId: input.roundId,
          createdAt,
        }, text),
      ],
    };
  }

  if (!text) return { selections: [], actions: [], interventions: [] };

  const structuredIntervention = structuredNodeIntervention({
    text,
    roundId: input.roundId,
    createdAt,
  });
  if (structuredIntervention) {
    const contextualIntervention = withStageContext(structuredIntervention, text);
    return {
      selections: [],
      actions: [
        {
          id: stableId(
            "action_intervention",
            `${contextualIntervention.kind}\n${contextualIntervention.sourceNodeId}\n${text}`,
            input.roundId,
          ),
          type: "node_intervention",
          targetId: contextualIntervention.sourceNodeId,
          payload: {
            interventionKind: contextualIntervention.kind,
            sourceNodeType: contextualIntervention.sourceNodeType,
          },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [contextualIntervention],
    };
  }

  const looksLikeEntryConfirmation =
    text.startsWith("我补充的信息如下，请继续完成刚才的任务") ||
    /^推演主题[：:]/m.test(text) ||
    /^推演时间范围[：:]/m.test(text) ||
    /^关键主体[：:]/m.test(text) ||
    /^关键变量[：:]/m.test(text);

  if (looksLikeEntryConfirmation) {
    return {
      selections: [
        {
          id: stableId("selection_entry", text, input.roundId),
          type: "entry",
          roundId: input.roundId,
          createdAt,
        },
      ],
      actions: [
        {
          id: stableId("action_entry", text, input.roundId),
          type: "entry_confirm",
          payload: { source: "requirements_card" },
          roundId: input.roundId,
          createdAt,
        },
      ],
      interventions: [
        withStageContext({
          id: stableId("intervention_entry", text, input.roundId),
          kind: "topic_confirm",
          sourceNodeId: "topic_definition",
          sourceNodeType: "topic",
          payload: { source: "requirements_card" },
          requiresConfirmation: false,
          roundId: input.roundId,
          createdAt,
        }, text),
      ],
    };
  }

  return {
    selections: [],
    actions: [
      {
        id: randomUUID(),
        type: "freeform_continue",
        payload: { source: "composer" },
        roundId: input.roundId,
        createdAt,
      },
    ],
    interventions: [],
  };
}

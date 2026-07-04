#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

const requireFromWeb = createRequire(new URL("../web/package.json", import.meta.url));
const { chromium } = requireFromWeb("@playwright/test");

const WEB_URL = process.env.XIAOCHUANG_WEB_URL ?? "http://localhost:3000";
const COMPANION_URL =
  process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477";
const COMPANION_DATA_DIR =
  process.env.COMPANION_DATA_DIR ??
  join(process.env.HOME ?? "", ".jlcresearch", "companion");
const SESSION_PREFIX = `simulation-ui-smoke-${Date.now()}`;
const REQUIREMENTS_SESSION_ID = `${SESSION_PREFIX}-requirements`;
const GATED_SESSION_ID = `${SESSION_PREFIX}-gated`;
const CONFIRMED_SESSION_ID = `${SESSION_PREFIX}-confirmed`;
const SCENARIO_SESSION_ID = `${SESSION_PREFIX}-scenario`;
const SANDBOX_PROJECT_ID = "sandbox-default";
const REPORT_PATH = "simulation-report-smoke.md";
const REPORT_CONTENT = [
  "# 推演报告 Smoke",
  "",
  "报告文件已打开验证。",
  "",
  "- [path: path_base] 最可能路径可以回跳到沙盘。",
  "- [node: var_demand] 需求恢复速度可以高亮变量节点。",
].join("\n");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectCanvasNodeUntilPanel(
  page,
  nodeLabel,
  panelLabel,
  {
    attempts = 4,
    nodeSelector,
    timeoutMs = 4_000,
  } = {},
) {
  const target =
    nodeSelector ??
    `.react-flow__node:has-text("${String(nodeLabel).replace(/"/g, '\\"')}")`;
  const node = page.locator(target).first();
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await node.click();
    try {
      await page.waitForSelector(`text=${panelLabel}`, { timeout: timeoutMs });
      return;
    } catch (error) {
      if (attempt === attempts) throw error;
      await page.waitForTimeout(400 * attempt);
    }
  }
}

async function waitForAnySelector(page, selectors, timeout = 10_000) {
  try {
    await page.waitForFunction(
      (items) =>
        items.some((selector) => {
          if (!selector.startsWith("text=")) return false;
          const text = selector.slice("text=".length);
          return document.body?.innerText.includes(text);
        }),
      selectors,
      { timeout },
    );
  } catch (error) {
    const text = await page
      .locator("body")
      .innerText({ timeout: 1000 })
      .catch(() => "");
    throw new Error(
      `none of ${selectors.join(", ")} appeared. Visible text: ${text
        .replace(/\s+/g, " ")
        .slice(0, 1200)}`,
      { cause: error },
    );
  }
}

const CANVAS_LAYER_IDS = new Map([
  ["全部", "all"],
  ["问题层", "question"],
  ["世界模型", "world"],
  ["变量层", "variable"],
  ["事件/推理", "reasoning"],
  ["证据层", "evidence"],
  ["风险/决策", "riskDecision"],
  ["情景层", "scenario"],
  ["输出层", "output"],
]);

async function clickCanvasLayer(page, label) {
  const layerId = CANVAS_LAYER_IDS.get(label);
  if (!layerId) throw new Error(`unknown canvas layer: ${label}`);

  const visibleLayerButton = page
    .locator(`[data-simulation-layer-id="${layerId}"]:visible`)
    .first();
  if ((await visibleLayerButton.count()) > 0) {
    await visibleLayerButton.click();
    return;
  }

  const trigger = page.locator("[data-simulation-layer-trigger='true']").first();
  if ((await trigger.count()) > 0) {
    await trigger.click();
    await page
      .locator(`[data-simulation-layer-id="${layerId}"]`)
      .first()
      .click();
    return;
  }

  await page.locator(`button:has-text("${label}")`).first().click();
}

function requirementPart() {
  return {
    id: "simulation_requirements_smoke",
    zone: "summary",
    kind: "simulation_requirements",
    title: "请先校对这次推演的关键信息",
    description: "确认后进入初始沙盘。",
    questions: [
      {
        id: "topic",
        label: "推演主题",
        type: "text",
        required: true,
        placeholder: "OPEC+ 减产影响推演",
      },
      {
        id: "time_range",
        label: "推演时间范围",
        type: "text",
        required: true,
        placeholder: "未来三个月",
      },
    ],
    streaming: false,
    completedAt: Date.now(),
  };
}

function requirementSummaryPart() {
  return {
    id: "simulation_requirement_summary_smoke",
    zone: "summary",
    kind: "simulation_requirement_summary",
    title: "推演需求摘要",
    markdown: [
      "## 推演需求摘要",
      "",
      "- 问题：OPEC+ 延长减产",
      "- 推演目标：分析未来三个月油价、库存和炼厂利润影响",
      "- 时间范围：未来三个月",
      "- 空间范围：全球原油市场",
      "- 行业：能源/炼化",
      "- 状态：已确认问题边界，等待初始沙盘",
    ].join("\n"),
    completedAt: Date.now(),
  };
}

function submittedRequirementPart() {
  return {
    ...requirementPart(),
    submitted: true,
    answer: [
      "1. 推演主题",
      "OPEC+ 延长减产",
      "",
      "2. 推演时间范围",
      "未来三个月",
    ].join("\n"),
    completedAt: Date.now(),
  };
}

function scenarioPart() {
  const roundId = "round_1";
  return {
    id: "simulation_scenario_smoke",
    zone: "summary",
    kind: "simulation_scenario",
    title: "基础沙盘",
    streaming: false,
    completedAt: Date.now(),
    scenario: {
      provenance: {
        source: "llm",
        label: "模型结构化推演",
        reason: "由 simulation_scenario fixture 模拟真实结构化输出。",
        generatedAt: new Date().toISOString(),
      },
      prompt: {
        id: "prompt_user",
        type: "prompt",
        label: "用户原问题",
        detail: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
        roundId,
        status: "parsed",
        data: {
          rawText: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
          sentAt: "2026-07-01 10:00",
          parseStatus: "已解析",
        },
      },
      topic: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
      topicDefinition: {
        problem: "OPEC+ 延长减产",
        goal: "分析未来三个月油价、库存和炼厂利润影响",
        timeRange: "未来三个月",
        spaceRange: "全球原油市场",
        industry: "能源/炼化",
        state: "waiting_next_action",
      },
      entities: [
        {
          id: "entity_opec",
          type: "entity",
          label: "OPEC+",
          detail: "供应侧核心主体",
          roundId,
          data: {
            role: "供应侧协调者",
            goal: "维持油价支撑并管理成员国产量纪律",
            influences: ["炼厂", "库存变化"],
            variables: ["减产执行力度", "库存变化"],
            events: ["需求恢复中断"],
          },
        },
        {
          id: "entity_refinery",
          type: "entity",
          label: "炼厂",
          detail: "利润修复或承压主体",
          roundId,
          data: {
            role: "下游加工主体",
            goal: "稳定采购成本并修复炼厂利润",
            affectedBy: ["OPEC+", "需求恢复速度", "库存变化"],
            variables: ["炼厂利润弹性", "需求恢复速度"],
            events: ["需求恢复中断"],
          },
        },
        {
          id: "conclusion_base",
          type: "conclusion",
          label: "库存缓慢下降",
          detail: "基准情景下库存去化改善",
          roundId,
          pathIds: ["path_base"],
          data: {
            variables: ["减产执行力度", "需求恢复速度", "库存变化"],
            assumptions: ["需求温和恢复假设"],
            risks: ["需求不及预期"],
            variableIds: ["var_supply", "var_demand", "var_inventory"],
            evidenceIds: ["evidence_inventory_weekly"],
            hypothesisIds: ["hypothesis_demand_soft"],
            riskIds: ["risk_demand"],
            scenarioIds: ["baseline"],
          },
        },
        {
          id: "conclusion_risk",
          type: "conclusion",
          label: "利润继续承压",
          detail: "需求偏弱时利润修复受阻",
          roundId,
          pathIds: ["path_risk"],
          data: {
            variables: ["需求恢复速度", "炼厂利润弹性"],
            assumptions: ["需求温和恢复假设"],
            risks: ["需求不及预期"],
            variableIds: ["var_demand", "var_margin"],
            evidenceIds: ["evidence_inventory_weekly"],
            hypothesisIds: ["hypothesis_demand_soft"],
            riskIds: ["risk_demand"],
            scenarioIds: ["risk"],
          },
        },
        {
          id: "conclusion_counter",
          type: "conclusion",
          label: "价格支撑减弱",
          detail: "反事实情景下供给压力回升",
          roundId,
          pathIds: ["path_counter"],
        },
        {
          id: "risk_demand",
          type: "risk",
          label: "需求不及预期",
          detail: "需求恢复慢于供给收缩",
          roundId,
          data: {
            probability: 0.42,
            impact: 4,
            controllability: 2,
            triggerSignal: "成品油消费连续两周低于季节性水平",
            affectedVariableIds: ["var_demand", "var_margin"],
            affectedScenarioIds: ["risk"],
            mitigationActionIds: ["action_hedge_margin"],
            affectedPaths: ["风险路径"],
          },
        },
      ],
      variables: [
        {
          id: "var_supply",
          type: "variable",
          label: "减产执行力度",
          detail: "影响供应收缩兑现程度",
          roundId,
          value: "中性",
          defaultValue: "中性",
          valueSchema: { kind: "enum", options: ["偏弱", "中性", "偏强"] },
        },
        {
          id: "var_demand",
          type: "variable",
          label: "需求恢复速度",
          detail: "影响库存和炼厂利润",
          roundId,
          value: "中性",
          defaultValue: "中性",
          valueSchema: { kind: "enum", options: ["偏弱", "中性", "偏强"] },
        },
        {
          id: "var_inventory",
          type: "variable",
          label: "库存变化",
          detail: "影响油价支撑",
          roundId,
          value: "缓慢下降",
          defaultValue: "缓慢下降",
          valueSchema: {
            kind: "enum",
            options: ["累库", "缓慢下降", "快速去库"],
          },
        },
        {
          id: "var_margin",
          type: "variable",
          label: "炼厂利润弹性",
          detail: "衡量利润修复空间",
          roundId,
          value: "小幅修复",
          defaultValue: "小幅修复",
          valueSchema: {
            kind: "enum",
            options: ["承压", "小幅修复", "明显修复"],
          },
        },
      ],
      nodes: [
        {
          id: "hypothesis_demand_soft",
          type: "hypothesis",
          label: "需求温和恢复假设",
          detail: "默认认为未来三个月需求逐步修复，但修复速度不强。",
          roundId,
          data: {
            statement: "未来三个月需求温和恢复",
            branchable: true,
            confidence: 0.7,
            scope: "需求与库存链路",
          },
        },
        {
          id: "event_demand_shock",
          type: "event",
          label: "需求恢复中断",
          detail: "如果终端需求再次转弱，库存去化会放慢。",
          roundId,
          data: {
            condition: "成品油消费低于季节性水平",
            scope: "库存、利润和价格支撑",
            variables: ["需求恢复速度", "库存变化"],
            probability: 0.28,
          },
        },
        {
          id: "evidence_inventory_weekly",
          type: "evidence",
          label: "库存周度数据",
          detail: "库存连续变化用于校验需求和供给假设。",
          roundId,
          evidenceSource: "EIA 周度库存",
          evidenceCredibility: "high",
          data: {
            source: "EIA",
            url: "https://www.eia.gov/petroleum/supply/weekly/",
            updatedAt: "2026-07-01",
            page: 12,
            quoteLocation: "weekly petroleum status report",
            quote: "Commercial crude inventories decreased while product demand softened.",
            citationCount: 2,
            citedByNodeIds: ["inference_inventory_margin", "conclusion_base"],
          },
        },
        {
          id: "inference_inventory_margin",
          type: "inference",
          label: "需求影响库存与利润",
          detail: "需求恢复速度决定库存去化节奏，并影响炼厂利润弹性。",
          roundId,
          data: {
            rationale: "需求转弱会先传导到库存，再影响炼厂利润。",
            confidence: 0.82,
            modelName: "DeepResearch",
            evidenceIds: ["evidence_inventory_weekly"],
            inputNodeIds: ["hypothesis_demand_soft", "event_demand_shock"],
            outputNodeIds: ["risk_demand", "conclusion_base", "conclusion_risk"],
            counterEvidence: "如果裂解价差快速扩大，利润可能先修复。",
          },
        },
        {
          id: "decision_pricing",
          type: "decision",
          label: "是否调整采购节奏",
          detail: "炼厂需要决定是否降低采购强度以控制库存。",
          roundId,
          data: {
            options: [
              {
                id: "decision_keep_purchase",
                label: "维持采购",
                expectedEffect: "保持原采购节奏，库存压力可能上升。",
                scenarioId: "baseline",
              },
              {
                id: "decision_reduce_purchase",
                label: "降低采购",
                expectedEffect: "降低库存暴露，但可能错过利润修复窗口。",
                scenarioId: "pessimistic",
              },
            ],
          },
        },
        {
          id: "action_hedge_margin",
          type: "action",
          label: "提前锁定部分利润",
          detail: "通过套保降低利润波动。",
          roundId,
          data: {
            actionType: "hedge",
            target: "炼厂利润",
            condition: "利润波动超过风险阈值",
            expectedEffect: "降低利润波动并缓释下行风险",
            cost: "套保成本",
            sideEffects: ["限制上行收益", "增加保证金占用"],
          },
        },
      ],
      assumptions: ["未来三个月无极端地缘冲突"],
      scenarios: [
        {
          id: "baseline",
          label: "Baseline",
          status: "selected",
          pathIds: ["path_base"],
          nodeIds: [
            "var_supply",
            "var_demand",
            "hypothesis_demand_soft",
            "inference_inventory_margin",
            "conclusion_base",
          ],
          edgeIds: [
            "edge_supply_base",
            "edge_hypothesis_inference",
            "edge_evidence_inference",
            "edge_inference_base",
          ],
          probability: 0.55,
          summary: "减产执行稳定，需求温和恢复，库存缓慢下降。",
          roundId,
        },
        {
          id: "risk",
          label: "Risk",
          status: "available",
          pathIds: ["path_risk"],
          nodeIds: [
            "var_demand",
            "event_demand_shock",
            "risk_demand",
            "decision_pricing",
            "action_hedge_margin",
            "conclusion_risk",
          ],
          edgeIds: [
            "edge_demand_event",
            "edge_event_inference",
            "edge_inference_risk",
            "edge_risk_decision",
            "edge_decision_action",
            "edge_action_risk_conclusion",
          ],
          probability: 0.3,
          summary: "需求恢复偏弱，库存去化不及预期，利润继续承压。",
          roundId,
        },
        {
          id: "counterfactual",
          label: "Counterfactual",
          status: "available",
          pathIds: ["path_counter"],
          nodeIds: ["var_supply", "conclusion_counter"],
          edgeIds: ["edge_supply_counter"],
          probability: 0.15,
          summary: "减产执行弱化，供给压力回升，价格支撑减弱。",
          roundId,
        },
      ],
      paths: [
        {
          id: "path_base",
          label: "最可能路径",
          probability: 0.55,
          status: "available",
          edgeIds: [
            "edge_supply_base",
            "edge_hypothesis_inference",
            "edge_evidence_inference",
            "edge_inference_base",
          ],
          summary: "减产执行稳定，需求温和恢复，库存缓慢下降。",
          roundId,
        },
        {
          id: "path_risk",
          label: "风险路径",
          probability: 0.3,
          status: "available",
          edgeIds: [
            "edge_demand_event",
            "edge_event_inference",
            "edge_inference_risk",
            "edge_risk_decision",
            "edge_decision_action",
            "edge_action_risk_conclusion",
          ],
          summary: "需求恢复偏弱，库存去化不及预期，利润继续承压。",
          roundId,
        },
        {
          id: "path_counter",
          label: "反事实路径",
          probability: 0.15,
          status: "available",
          edgeIds: ["edge_supply_counter"],
          summary: "减产执行弱化，供给压力回升，价格支撑减弱。",
          roundId,
        },
      ],
      edges: [
        {
          id: "edge_supply_base",
          type: "causal",
          source: "var_supply",
          target: "conclusion_base",
          label: "支撑供给收缩",
          roundId,
        },
        {
          id: "edge_hypothesis_inference",
          type: "causal",
          source: "hypothesis_demand_soft",
          target: "inference_inventory_margin",
          label: "形成需求前提",
          roundId,
        },
        {
          id: "edge_evidence_inference",
          type: "evidence_support",
          source: "evidence_inventory_weekly",
          target: "inference_inventory_margin",
          label: "支撑库存判断",
          roundId,
        },
        {
          id: "edge_inference_base",
          type: "causal",
          source: "inference_inventory_margin",
          target: "conclusion_base",
          label: "推动库存去化",
          roundId,
        },
        {
          id: "edge_demand_event",
          type: "causal",
          source: "var_demand",
          target: "event_demand_shock",
          label: "触发需求冲击",
          roundId,
        },
        {
          id: "edge_event_inference",
          type: "causal",
          source: "event_demand_shock",
          target: "inference_inventory_margin",
          label: "改变库存推理",
          roundId,
        },
        {
          id: "edge_inference_risk",
          type: "causal",
          source: "inference_inventory_margin",
          target: "risk_demand",
          label: "暴露需求风险",
          roundId,
        },
        {
          id: "edge_risk_decision",
          type: "causal",
          source: "risk_demand",
          target: "decision_pricing",
          label: "触发采购决策",
          roundId,
        },
        {
          id: "edge_decision_action",
          type: "causal",
          source: "decision_pricing",
          target: "action_hedge_margin",
          label: "形成缓释行动",
          roundId,
        },
        {
          id: "edge_action_risk_conclusion",
          type: "causal",
          source: "action_hedge_margin",
          target: "conclusion_risk",
          label: "缓释利润承压",
          roundId,
        },
        {
          id: "edge_supply_counter",
          type: "causal",
          source: "var_supply",
          target: "conclusion_counter",
          label: "执行弱化削弱价格支撑",
          roundId,
        },
      ],
    },
  };
}

function summaryPart() {
  return {
    id: "simulation_summary_smoke",
    zone: "summary",
    kind: "simulation_summary",
    roundId: "round_1",
    markdown:
      "## 阶段结论\n\n- [path: path_base] 最可能路径是库存缓慢下降、利润小幅修复。\n- [node: var_demand] 需求恢复速度是后续重算最敏感的变量。",
    conclusionIds: ["path_base", "var_demand"],
    streaming: false,
    completedAt: Date.now(),
  };
}

function errorPart() {
  return {
    id: "simulation_error_smoke",
    zone: "activity",
    kind: "error",
    message: "模拟路径总结生成中断",
    code: "simulation_smoke_error",
    streaming: false,
    completedAt: Date.now(),
  };
}

function nextActionPart() {
  return {
    id: "simulation_next_action_smoke",
    zone: "summary",
    kind: "simulation_next_action",
    nextActions: [
      {
        actionId: "next_action_add_demand_data",
        title: "补充需求数据",
        description: "补充需求恢复速度数据后，重新推理库存和炼厂利润路径。",
        actionType: "add_data",
        targetId: "var_demand",
        basedOnConclusionId: "path_base",
        expectedEffect: "补充需求恢复速度数据后，重新推理库存和炼厂利润路径。",
      },
    ],
    streaming: false,
    completedAt: Date.now(),
  };
}

function deliverablesPart() {
  return {
    id: "simulation_deliverables_smoke",
    zone: "summary",
    kind: "deliverables",
    headline: "本轮推演报告如下：",
    primaryPath: REPORT_PATH,
    workspaceProjectId: SANDBOX_PROJECT_ID,
    items: [
      {
        path: REPORT_PATH,
        label: `${REPORT_PATH} 推演报告`,
        mime: "text/markdown",
        kind: "primary",
        workspaceProjectId: SANDBOX_PROJECT_ID,
      },
    ],
    streaming: false,
    completedAt: Date.now(),
  };
}

function scenarioSnapshot(roundId, labelSuffix = "") {
  const scenario = scenarioPart().scenario;
  return {
    roundId,
    nodes: [
      {
        ...(scenario.prompt ?? {}),
        id: "prompt_user",
        type: "prompt",
        label: "用户原问题",
        detail: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
        roundId,
        status: "parsed",
        data: {
          rawText: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
          sentAt: "2026-07-01 10:00",
          parseStatus: "已解析",
        },
      },
      {
        id: "topic",
        type: "topic",
        label: `${scenario.topic}${labelSuffix}`,
        roundId,
        data: scenario.topicDefinition,
      },
      ...scenario.entities.map((node) => ({ ...node, roundId })),
      ...scenario.variables.map((node) => ({
        ...node,
        roundId,
        value:
          roundId === "round_2" && node.id === "var_demand"
            ? "偏弱"
            : node.value,
      })),
      ...scenario.nodes.map((node) => ({ ...node, roundId })),
    ],
    edges: scenario.edges.map((edge) => ({ ...edge, roundId })),
    paths: scenario.paths.map((path) => ({ ...path, roundId })),
    scenarios: scenario.scenarios.map((item) => ({ ...item, roundId })),
    selections:
      roundId === "round_2"
        ? [
            {
              id: "selection_variable_smoke_ui",
              type: "variable",
              targetId: "var_demand",
              value: "偏弱",
              roundId,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    actions:
      roundId === "round_2"
        ? [
            {
              id: "action_variable_smoke_ui",
              type: "variable_resimulate",
              targetId: "var_demand",
              roundId,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    interventions:
      roundId === "round_2"
        ? [
            {
              id: "intervention_variable_smoke_ui",
              kind: "variable_override",
              sourceNodeId: "var_demand",
              sourceNodeType: "variable",
              roundId,
              impactPreview: {
                affectedNodeIds: [],
                affectedEdgeIds: [],
                affectedPathIds: [],
                affectedScenarioIds: [],
                affectedNodeLabels: ["库存缓慢下降", "利润继续承压"],
                affectedEdgeLabels: ["推动库存去化", "缓释利润承压"],
                affectedPathLabels: ["最可能路径", "风险路径"],
                affectedScenarioLabels: ["Baseline", "Risk"],
                reason: "smoke",
              },
              requiresConfirmation: true,
              createdAt: new Date().toISOString(),
            },
            {
              id: "intervention_risk_id_only_smoke_ui",
              kind: "risk_stress_test",
              sourceNodeId: "risk_demand",
              sourceNodeType: "risk",
              roundId,
              impactPreview: {
                affectedNodeIds: ["decision_pricing"],
                affectedEdgeIds: ["edge_risk_decision"],
                affectedPathIds: ["path_risk"],
                affectedScenarioIds: ["risk"],
                reason: "id_only_smoke",
              },
              requiresConfirmation: true,
              createdAt: new Date().toISOString(),
            },
          ]
        : [],
    provenance: scenario.provenance,
    createdAt: new Date().toISOString(),
  };
}

async function putRoundSnapshot(sessionId, snapshot) {
  const roundsDir = join(
    COMPANION_DATA_DIR,
    "simulation",
    sessionId,
    "rounds",
  );
  await mkdir(roundsDir, { recursive: true });
  await writeFile(
    join(roundsDir, `${snapshot.roundId}.json`),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );
}

async function waitForRoundFixtures(sessionId, expectedCount) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const res = await fetch(
      `${COMPANION_URL}/v1/sessions/${encodeURIComponent(sessionId)}/simulation/rounds`,
    );
    if (res.ok) {
      const payload = await res.json();
      if (Array.isArray(payload.rounds) && payload.rounds.length >= expectedCount) {
        return payload.rounds;
      }
    }
    await sleep(250);
  }
  throw new Error(`round fixtures not visible for ${sessionId}`);
}

async function putMessages(sessionId, parts, projectId = "none") {
  const res = await fetch(
    `${COMPANION_URL}/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        messages: [
          {
            id: "u1",
            role: "user",
            content:
              "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
            status: "complete",
          },
          {
            id: "a1",
            role: "assistant",
            content: "",
            status: "complete",
            runId: "run-simulation-ui-smoke",
            parts,
          },
        ],
      }),
    },
  );
  assert(res.ok, `session fixture write failed (${res.status})`);
}

async function fetchMessages(sessionId) {
  const res = await fetch(
    `${COMPANION_URL}/v1/sessions/${encodeURIComponent(sessionId)}/messages`,
  );
  assert(res.ok, `session messages read failed (${res.status})`);
  const payload = await res.json();
  return Array.isArray(payload.messages) ? payload.messages : [];
}

async function waitForUserMessage(sessionId, predicate) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const messages = await fetchMessages(sessionId);
    const message = [...messages]
      .reverse()
      .find(
        (item) =>
          item &&
          item.role === "user" &&
          typeof item.content === "string" &&
          predicate(item.content),
      );
    if (message) return message.content;
    await sleep(250);
  }
  throw new Error("expected user message was not persisted");
}

async function cleanup() {
  if (process.env.SMOKE_KEEP_DATA === "1") return;
  await Promise.all(
    [
      REQUIREMENTS_SESSION_ID,
      GATED_SESSION_ID,
      CONFIRMED_SESSION_ID,
      SCENARIO_SESSION_ID,
    ].map((sessionId) =>
      Promise.all([
        rm(join(COMPANION_DATA_DIR, "sessions", `${sessionId}.json`), {
          force: true,
        }).catch(() => {}),
        rm(join(COMPANION_DATA_DIR, "simulation", sessionId), {
          recursive: true,
          force: true,
        }).catch(() => {}),
      ]),
    ),
  );
}

async function main() {
  await putMessages(REQUIREMENTS_SESSION_ID, [requirementPart()]);
  await putMessages(GATED_SESSION_ID, [requirementPart(), scenarioPart()]);
  await putMessages(CONFIRMED_SESSION_ID, [
    submittedRequirementPart(),
    requirementSummaryPart(),
  ]);
  await putMessages(SCENARIO_SESSION_ID, [
    scenarioPart(),
    summaryPart(),
    nextActionPart(),
    errorPart(),
    deliverablesPart(),
  ], SANDBOX_PROJECT_ID);
  await putRoundSnapshot(SCENARIO_SESSION_ID, scenarioSnapshot("round_1"));
  await putRoundSnapshot(
    SCENARIO_SESSION_ID,
    scenarioSnapshot("round_2", " · 历史快照"),
  );
  await waitForRoundFixtures(SCENARIO_SESSION_ID, 2);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    const login = await page.request.post(`${WEB_URL}/api/auth/login`, {
      data: { phone: "13800138000", code: "123456", agreed: true },
    });
    assert(login.ok(), `login failed (${login.status()})`);

    let reportWrite;
    let reportWriteError;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      try {
        reportWrite = await page.request.put(`${WEB_URL}/api/workspace/file`, {
          data: {
            projectId: SANDBOX_PROJECT_ID,
            path: REPORT_PATH,
            content: REPORT_CONTENT,
          },
        });
        if (reportWrite.ok()) break;
      } catch (error) {
        reportWriteError = error;
      }
      await sleep(500 * attempt);
    }
    if (!reportWrite) {
      throw reportWriteError ?? new Error("report write request failed");
    }
    if (!reportWrite.ok()) {
      const body = await reportWrite.text().catch(() => "");
      throw new Error(
        `report write failed (${reportWrite.status()}): ${body.slice(0, 500)}`,
      );
    }

    await page.goto(`${WEB_URL}/simulation/new`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForSelector("text=今天要推演什么问题？", {
      timeout: 10_000,
    });
    const newHomePrompt = await page.locator("textarea").count();
    const newHomeCanvas = await page.locator(".react-flow").count();
    const newHomeNodes = await page.locator(".react-flow__node").count();
    const newHomeChatPanel = await page.locator("text=AI 识别结果校对").count();
    const newHomeSuggestion = await page
      .locator("text=推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响路径")
      .count();
    assert(newHomeCanvas === 0, "simulation new page should use ChatHome entry");
    assert(newHomeNodes === 0, "simulation new page should not render canvas nodes");
    assert(newHomePrompt > 0, "simulation new page prompt not visible");
    assert(newHomeSuggestion > 0, "simulation new page suggestions not visible");
    assert(
      newHomeChatPanel === 0,
      "simulation new page should not show old chat review panel",
    );

    await page.goto(`${WEB_URL}/simulation/${REQUIREMENTS_SESSION_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitForAnySelector(page, [
      "text=入口确认节点组",
      "text=请先校对这次推演的关键信息",
      "text=等待你补充或确认",
    ]);
    const pendingCanvas = await page.locator(".react-flow").count();
    const pendingNodes = await page.locator(".react-flow__node").count();
    const pendingSeed = await page
      .locator("text=路径生成中")
      .count();
    const pendingEntryGroup = await page
      .locator("text=入口确认节点组")
      .count();
    const pendingRequirementTitle = await page
      .locator("text=请先校对这次推演的关键信息")
      .count();
    const pendingStatusCard = await page
      .locator("text=等待你补充或确认")
      .count();
    const pendingEntrySubmit = await page
      .locator('button:has-text("确认并生成初始沙盘")')
      .count();
    const oldReviewPanel = await page.locator("text=AI 识别结果校对").count();
    assert(pendingCanvas > 0, "simulation pending canvas not visible");
    assert(
      pendingNodes > 0 || pendingStatusCard > 0,
      "simulation pending should render progressive nodes or pending status",
    );
    assert(
      pendingSeed > 0 || pendingStatusCard > 0,
      "simulation pending path status not visible",
    );
    assert(
      pendingEntryGroup > 0 || pendingRequirementTitle > 0 || pendingStatusCard > 0,
      "simulation pending should show entry confirmation context",
    );
    assert(
      pendingEntrySubmit > 0 || pendingStatusCard > 0,
      "simulation pending should allow submitting entry confirmation or show pending status",
    );
    assert(oldReviewPanel === 0, "simulation pending should not show old review panel");

    await page.goto(`${WEB_URL}/simulation/${GATED_SESSION_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitForAnySelector(page, [
      "text=入口确认节点组",
      "text=请先校对这次推演的关键信息",
      "text=等待你补充或确认",
    ]);
    const gatedEntryGroup = await page.locator("text=入口确认节点组").count();
    const gatedRequirementTitle = await page
      .locator("text=请先校对这次推演的关键信息")
      .count();
    const gatedStatusCard = await page
      .locator("text=等待你补充或确认")
      .count();
    const gatedEntrySubmit = await page
      .locator('button:has-text("确认并生成初始沙盘")')
      .count();
    const gatedFormalCanvas = await page
      .locator("text=画布正在承载本轮 AI 输出")
      .count();
    const gatedScenarioNode = await page.locator("text=风险压力测试").count();
    assert(
      gatedEntryGroup > 0 || gatedRequirementTitle > 0 || gatedStatusCard > 0,
      "simulation gated canvas should keep entry confirmation context visible",
    );
    assert(
      gatedEntrySubmit > 0 || gatedStatusCard > 0,
      "simulation gated canvas should still require entry submission or show pending status",
    );
    assert(
      gatedFormalCanvas === 0,
      "simulation gated canvas should not enter formal scenario before confirmation",
    );
    assert(
      gatedScenarioNode === 0,
      "simulation gated canvas should hide scenario nodes before confirmation",
    );

    await page.goto(`${WEB_URL}/simulation/${CONFIRMED_SESSION_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitForAnySelector(page, [
      "text=入口设定已确认，等待初始沙盘",
      "text=推演需求摘要",
      "text=边界摘要",
      "text=正在进入世界模型",
      "text=已确认",
    ]);
    const confirmedBoundarySummary = await page
      .locator("text=边界摘要")
      .count();
    const confirmedRequirementSummary = await page
      .locator("text=推演需求摘要")
      .count();
    const confirmedState = await page
      .locator("text=入口设定已确认，等待初始沙盘")
      .count();
    const confirmedWorldModelingState = await page
      .locator("text=正在进入世界模型")
      .count();
    const confirmedTopicNode = await page
      .locator("text=OPEC+ 减产影响推演")
      .count();
    const confirmedEntrySubmit = await page
      .locator('button:has-text("确认并生成初始沙盘")')
      .count();
    assert(
      confirmedBoundarySummary > 0 ||
        confirmedState > 0 ||
        confirmedWorldModelingState > 0,
      "simulation confirmed pending should show boundary summary or confirmed status",
    );
    assert(
      confirmedRequirementSummary > 0 || confirmedTopicNode > 0,
      "simulation confirmed pending should render requirement summary or confirmed topic node",
    );
    assert(
      confirmedState > 0 || confirmedWorldModelingState > 0,
      "simulation confirmed pending should show confirmed boundary status",
    );
    assert(
      confirmedEntrySubmit === 0,
      "simulation confirmed pending should not keep editable entry confirmation card",
    );

    const sandboxTreeReady = page
      .waitForResponse(
        (res) =>
          res.url().includes(`/api/projects/${SANDBOX_PROJECT_ID}/tree`) &&
          res.ok(),
        { timeout: 15_000 },
      )
      .catch(() => null);
    await page.goto(`${WEB_URL}/simulation/${SCENARIO_SESSION_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await waitForAnySelector(page, [
      "text=模型结构化推演",
      "text=风险压力测试",
      "text=最可能路径",
    ]);
    await sandboxTreeReady;
    await page.waitForTimeout(750);
    await page.waitForSelector("text=风险压力测试", { timeout: 10_000 });
    const roundButtons = await page.locator("text=推演轮次").count();
    await page.locator('button:has-text("初始判断")').click();
    await page.waitForSelector("text=你正在查看历史轮次", { timeout: 10_000 });
    const historicalNotice = await page
      .locator("text=你正在查看历史轮次")
      .count();
    await page.locator('button:has-text("回到最新")').click();
    await page.waitForSelector("text=风险压力测试", { timeout: 10_000 });
    await clickCanvasLayer(page, "全部");
    await page.waitForSelector("text=OPEC+ 延长减产", { timeout: 10_000 });
    await clickCanvasLayer(page, "问题层");
    await page
      .locator('.react-flow__node:has-text("用户原问题")')
      .first()
      .waitFor({ state: "visible", timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "用户原问题", "原问题操作", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="prompt_user"])',
    });
    const promptControl = await page.locator("text=原问题操作").count();
    const promptReparseAction = await page
      .locator('button:has-text("重新解析")')
      .count();
    const promptEditAction = await page
      .locator('button:has-text("修改原问题")')
      .count();
    const promptCancelAction = await page
      .locator('button:has-text("取消创建")')
      .count();
    await page.locator('button:has-text("重新解析")').first().click();
    const promptReparsePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Prompt ID：prompt_user") &&
        content.includes("原问题：推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响") &&
        content.includes("操作：重新解析") &&
        content.includes("当前状态：parsed") &&
        content.includes("解析状态：已解析") &&
        content.includes("当前 Topic：推演 OPEC+ 延长减产") &&
        content.includes("Prompt→Topic 的双节点关系"),
    );
    await selectCanvasNodeUntilPanel(page, "OPEC+ 延长减产", "问题边界", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-kind="topic"])',
    });
    const topicBoundaryControl = await page.locator("text=问题边界").count();
    const topicConfirmButton = page
      .locator(
        'button:has-text("确认进入世界模型"), button:has-text("确认边界并开始"), button:has-text("确认开始")',
      )
      .first();
    const topicConfirmAction = await topicConfirmButton.count();
    const topicEditAction = await page
      .locator('button:has-text("修改边界")')
      .count();
    const topicAddConditionAction = await page
      .locator('button:has-text("补充条件")')
      .count();
    await topicConfirmButton.click();
    const topicConfirmPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Topic ID：topic") &&
        content.includes("Topic：推演 OPEC+ 延长减产") &&
        content.includes("操作：确认") &&
        content.includes("问题：OPEC+ 延长减产") &&
        content.includes("推演目标：分析未来三个月油价、库存和炼厂利润影响") &&
        content.includes("时间范围：未来三个月") &&
        content.includes("空间范围：全球原油市场") &&
        content.includes("行业：能源/炼化") &&
        content.includes("状态：waiting_next_action") &&
        content.includes("世界模型层：Entity、Variable、Hypothesis") &&
        content.includes("问题边界变化会影响哪些后续节点"),
    );
    await clickCanvasLayer(page, "变量层");
    await page.waitForSelector("text=需求恢复速度", { timeout: 18_000 });
    const layerVariableVisible = await page.locator("text=需求恢复速度").count();
    await clickCanvasLayer(page, "全部");
    await selectCanvasNodeUntilPanel(page, "Risk", "选择情景继续", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="scenario:risk"])',
      timeoutMs: 6_000,
    });
    const scenarioActions = await page.locator("text=选择情景继续").count();
    const scenarioCompareAction = await page.locator("text=对比 Baseline").count();
    const scenarioCounterfactualAction = await page
      .locator("text=生成反事实")
      .count();
    await page.locator('button:has-text("选择情景继续")').first().click();
    await page.waitForSelector("text=情景继续推演", { timeout: 10_000 });
    const scenarioPendingIntervention = await page
      .locator("text=情景继续推演")
      .count();
    const scenarioPendingTarget = await page
      .locator("text=目标：Risk")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const scenarioContinuePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("我选择这个情景继续推演") &&
        content.includes("Scenario ID：risk") &&
        content.includes("Scenario：Risk") &&
        content.includes("概率：30%") &&
        content.includes("Path IDs：path_risk") &&
        content.includes("Baseline Scenario ID：baseline") &&
        content.includes("请基于该情景生成新一轮 Reasoning Graph") &&
        content.includes("情景选择属于硬选择点"),
    );
    await page.locator('button:has-text("对比 Baseline")').first().click();
    const scenarioComparePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("请对比这个情景与 Baseline") &&
        content.includes("Scenario ID：risk") &&
        content.includes("Scenario：Risk") &&
        content.includes("概率：30%") &&
        content.includes("Path IDs：path_risk") &&
        content.includes(
          "Node IDs：var_demand、event_demand_shock、risk_demand、decision_pricing、action_hedge_margin、conclusion_risk",
        ) &&
        content.includes(
          "Edge IDs：edge_demand_event、edge_event_inference、edge_inference_risk、edge_risk_decision、edge_decision_action、edge_action_risk_conclusion",
        ) &&
        content.includes("Baseline Scenario ID：baseline") &&
        content.includes("相对 Baseline 新增节点：需求恢复中断、需求不及预期、是否调整采购节奏、提前锁定部分利润、利润继续承压") &&
        content.includes("相对 Baseline 新增路径：风险路径"),
    );
    await clickCanvasLayer(page, "情景层");
    await page
      .locator('.react-flow__node:has([data-simulation-node-id="path:path_base"])')
      .first()
      .waitFor({ state: "visible", timeout: 18_000 });
    await selectCanvasNodeUntilPanel(page, "最可能路径", "选择这条继续", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="path:path_base"])',
      timeoutMs: 6_000,
    });
    const pathActions = await page.locator("text=选择这条继续").count();
    await page.locator('button:has-text("选择这条继续")').first().click();
    await page.waitForSelector("text=路径继续推演", { timeout: 10_000 });
    const pathPendingIntervention = await page
      .locator("text=路径继续推演")
      .count();
    const pathPendingTarget = await page
      .locator("text=目标：最可能路径")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const pathContinuePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("我选择这条推演路径继续深挖") &&
        content.includes("路径 ID：path_base") &&
        content.includes("路径名称：最可能路径") &&
        content.includes("路径状态：available") &&
        content.includes("Round ID：") &&
        content.includes("概率：55%") &&
        content.includes("路径摘要：减产执行稳定，需求温和恢复，库存缓慢下降。") &&
        content.includes(
          "Edge IDs：edge_supply_base、edge_hypothesis_inference、edge_evidence_inference、edge_inference_base",
        ) &&
        content.includes("Node IDs：var_supply、conclusion_base") &&
        content.includes("Scenario IDs：baseline") &&
        content.includes("路径选择属于硬选择点"),
    );
    await clickCanvasLayer(page, "世界模型");
    await page.waitForSelector("text=OPEC+", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "OPEC+", "主体建模", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="entity_opec"])',
    });
    const entityModelingControl = await page.locator("text=主体建模").count();
    const entityAddVariableAction = await page
      .locator('button:has-text("补充变量")')
      .count();
    const entityAddEventAction = await page
      .locator('button:has-text("补充事件")')
      .count();
    const entityRelationAction = await page
      .locator('button:has-text("分析关系")')
      .count();
    await page.locator('button:has-text("补充变量")').first().click();
    const entityAddVariablePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Entity ID：entity_opec") &&
        content.includes("Entity：OPEC+") &&
        content.includes("操作：补变量") &&
        content.includes("角色：供应侧协调者") &&
        content.includes("利益目标：维持油价支撑并管理成员国产量纪律") &&
        content.includes("影响对象：炼厂、库存变化") &&
        content.includes("关联变量：减产执行力度、库存变化") &&
        content.includes("关联事件：需求恢复中断") &&
        content.includes("补充关键 Variable"),
    );
    await clickCanvasLayer(page, "变量层");
    await page.waitForSelector("text=需求恢复速度", { timeout: 18_000 });
    await page
      .locator('.react-flow__node:has-text("需求恢复速度")')
      .first()
      .click();
    await page.waitForSelector("text=沿此节点展开", { timeout: 10_000 });
    const nodeActions = await page.locator("text=沿此节点展开").count();
    await page.waitForSelector("text=调整变量", { timeout: 10_000 });
    const variableControl = await page.locator("text=调整变量").count();
    const variableInspectAction = await page
      .locator('button:has-text("查看影响")')
      .count();
    const variableLockAction = await page
      .locator('button:has-text("锁定变量")')
      .count();
    const variableResetAction = await page
      .locator('button:has-text("恢复默认")')
      .count();
    const variableRecalculateAction = await page
      .locator('button:has-text("确认重算")')
      .count();
    const interventionPreview = await page
      .locator("text=干预影响预览")
      .count();
    const affectedNodes = await page
      .locator("text=需求恢复中断")
      .count();
    await page.locator('button:has-text("沿此节点展开")').first().click();
    const nodeExpandPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("请沿着这个节点继续展开下一层推演") &&
        content.includes("节点 ID：var_demand") &&
        content.includes("节点类型：变量") &&
        content.includes("节点名称：需求恢复速度") &&
        content.includes("节点说明：影响库存和炼厂利润") &&
        content.includes("预计影响节点：库存缓慢下降、利润继续承压、需求不及预期、需求恢复中断") &&
        content.includes("预计影响边：推动库存去化、触发需求冲击、改变库存推理") &&
        content.includes("预计影响路径：最可能路径、风险路径") &&
        content.includes("预计影响情景：Baseline、Risk") &&
        content.includes("不要发散到全图"),
    );
    await page
      .locator('select[aria-label="调整需求恢复速度"]')
      .selectOption("偏弱");
    await page.locator('button:has-text("确认重算")').first().click();
    await page.waitForSelector("text=待确认干预", { timeout: 10_000 });
    const variablePendingIntervention = await page
      .locator("text=待确认干预")
      .count();
    const variablePendingTarget = await page
      .locator("text=目标：需求恢复速度 → 偏弱")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const variableRecalculatePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("变量 ID：var_demand") &&
        content.includes("变量名称：需求恢复速度") &&
        content.includes("操作：确认重算") &&
        content.includes("当前值：") &&
        content.includes("默认值：中性") &&
        content.includes("目标值：偏弱") &&
        content.includes("变量类型：enum") &&
        content.includes("可选值：偏弱、中性、偏强") &&
        content.includes("锁定状态：否") &&
        content.includes("预计影响情景：Baseline、Risk") &&
        content.includes("确认重算属于硬选择点"),
    );
    await clickCanvasLayer(page, "事件/推理");
    await page.waitForSelector("text=需求恢复中断", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "需求恢复中断", "事件假设", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="event_demand_shock"])',
    });
    const eventAssumptionControl = await page.locator("text=事件假设").count();
    const eventIfThen = await page.locator("text=IF：").count();
    const eventAssumeHappens = await page
      .locator('button:has-text("假设发生")')
      .count();
    const eventAssumeNotHappens = await page
      .locator('button:has-text("假设未发生")')
      .count();
    await page.locator('button:has-text("假设发生")').first().click();
    await page.waitForSelector("text=事件假设确认", { timeout: 10_000 });
    const eventPendingIntervention = await page
      .locator("text=事件假设确认")
      .count();
    const eventPendingTarget = await page
      .locator("text=目标：需求恢复中断 / 发生")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const eventAssumptionPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Event ID：event_demand_shock") &&
        content.includes("假设状态：发生") &&
        content.includes("发生条件：成品油消费低于季节性水平") &&
        content.includes("影响范围：库存、利润和价格支撑") &&
        content.includes("影响变量：需求恢复速度、库存变化") &&
        content.includes("发生概率：28%"),
    );
    await selectCanvasNodeUntilPanel(
      page,
      "需求影响库存与利润",
      "推理复核",
      {
        nodeSelector: '.react-flow__node:has([data-simulation-node-id="inference_inventory_margin"])',
      },
    );
    const inferenceReviewControl = await page.locator("text=推理复核").count();
    const inferenceEvidenceAction = await page
      .locator('button:has-text("查看证据")')
      .count();
    const inferenceRerunAction = await page
      .locator('button:has-text("重新推理")')
      .count();
    const inferenceCounterAction = await page
      .locator('button:has-text("寻找反证")')
      .count();
    const inferenceModelVisible = await page
      .locator("text=模型：DeepResearch")
      .count();
    const inferenceInputVisible = await page
      .locator("text=输入节点：hypothesis_demand_soft、event_demand_shock")
      .count();
    const inferenceOutputVisible = await page
      .locator("text=输出节点：risk_demand、conclusion_base、conclusion_risk")
      .count();
    await page.locator('button:has-text("寻找反证")').first().click();
    await page.waitForSelector("text=推理反证确认", { timeout: 10_000 });
    const inferencePendingIntervention = await page
      .locator("text=推理反证确认")
      .count();
    const inferencePendingTarget = await page
      .locator("text=目标：需求影响库存与利润 / 反证")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const inferenceCounterPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Inference ID：inference_inventory_margin") &&
        content.includes("操作：反证") &&
        content.includes("使用模型：DeepResearch") &&
        content.includes("证据 ID：evidence_inventory_weekly") &&
        content.includes("输入节点：hypothesis_demand_soft、event_demand_shock") &&
        content.includes("输出节点：risk_demand、conclusion_base、conclusion_risk") &&
        content.includes("已有反证线索：如果裂解价差快速扩大，利润可能先修复。"),
    );
    await clickCanvasLayer(page, "证据层");
    await page.waitForSelector("text=库存周度数据", { timeout: 10_000 });
    await page
      .locator('.react-flow__node:has-text("库存周度数据")')
      .first()
      .click();
    await page.waitForSelector("text=证据核验", { timeout: 10_000 });
    const evidenceReviewControl = await page.locator("text=证据核验").count();
    const evidenceVerifyAction = await page
      .locator('button:has-text("核验证据")')
      .count();
    const evidenceLocateAction = await page
      .locator('button:has-text("定位引用")')
      .count();
    const evidenceCounterAction = await page
      .locator('button:has-text("查找反例")')
      .count();
    const evidenceOpenSourceAction = await page
      .locator('button:has-text("打开原文")')
      .count();
    const evidenceReplaceAction = await page
      .locator('button:has-text("替换证据")')
      .count();
    const evidenceSupplementAction = await page
      .locator('button:has-text("补充证据")')
      .count();
    const evidenceUrlVisible = await page
      .locator("text=原文：https://www.eia.gov/petroleum/supply/weekly/")
      .count();
    const evidencePageVisible = await page.locator("text=页码：12").count();
    const evidenceQuoteVisible = await page
      .locator("text=摘录：Commercial crude inventories decreased while product demand softened.")
      .count();
    const evidenceCitedByVisible = await page
      .locator("text=引用节点：inference_inventory_margin、conclusion_base")
      .count();
    await page.locator('button:has-text("替换证据")').click();
    await page.waitForSelector("text=证据更新确认", { timeout: 10_000 });
    const evidencePendingIntervention = await page
      .locator("text=证据更新确认")
      .count();
    const evidencePendingTarget = await page
      .locator("text=目标：库存周度数据 / 替换证据")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const evidenceReplacePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Evidence ID：evidence_inventory_weekly") &&
        content.includes("操作：替换证据") &&
        content.includes("来源：EIA 周度库存") &&
        content.includes("可信度：high") &&
        content.includes("原文链接：https://www.eia.gov/petroleum/supply/weekly/") &&
        content.includes("页码：12") &&
        content.includes("原文摘录：Commercial crude inventories decreased while product demand softened.") &&
        content.includes("引用节点：inference_inventory_margin、conclusion_base"),
    );
    await clickCanvasLayer(page, "事件/推理");
    await page.waitForSelector("text=需求温和恢复假设", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "需求温和恢复假设", "生成分支", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="hypothesis_demand_soft"])',
    });
    const hypothesisBranchControl = await page.locator("text=假设分支").count();
    const hypothesisReplaceAction = await page
      .locator('button:has-text("替换假设")')
      .count();
    const hypothesisLockAction = await page
      .locator('button:has-text("锁定假设")')
      .count();
    const hypothesisDeleteAction = await page
      .locator('button:has-text("删除假设")')
      .count();
    const hypothesisBranchAction = await page.locator("text=生成分支").count();
    const hypothesisConfidenceVisible = await page
      .locator("text=可信度：70%")
      .count();
    const hypothesisBranchableVisible = await page
      .locator("text=可分支：是")
      .count();
    const hypothesisImpactPreview = await page
      .locator("text=预计影响节点")
      .count();
    await page.locator('button:has-text("生成分支")').first().click();
    await page.waitForSelector("text=假设分支确认", { timeout: 10_000 });
    const hypothesisPendingIntervention = await page
      .locator("text=假设分支确认")
      .count();
    const hypothesisPendingTarget = await page
      .locator("text=目标：需求温和恢复假设 / 分支")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const hypothesisBranchPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Hypothesis ID：hypothesis_demand_soft") &&
        content.includes("操作：分支") &&
        content.includes("当前假设：未来三个月需求温和恢复") &&
        content.includes("适用范围：需求与库存链路") &&
        content.includes("当前可信度：70%") &&
        content.includes("可生成分支：是") &&
        content.includes("Scenario 分支"),
    );
    await clickCanvasLayer(page, "风险/决策");
    await page.waitForSelector("text=需求不及预期", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "需求不及预期", "风险处置", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="risk_demand"])',
    });
    const riskTreatmentControl = await page.locator("text=风险处置").count();
    const riskMitigationAction = await page
      .locator('button:has-text("加入缓释措施")')
      .count();
    const riskWarningAction = await page
      .locator('button:has-text("生成预警变量")')
      .count();
    const riskStressAction = await page
      .locator('button:has-text("压力测试")')
      .count();
    const riskAffectedVariablesVisible = await page
      .locator("text=影响变量：var_demand、var_margin")
      .count();
    const riskAffectedScenariosVisible = await page
      .locator("text=影响情景：risk")
      .count();
    const riskMitigationVisible = await page
      .locator("text=缓释动作：action_hedge_margin")
      .count();
    await page.locator('button:has-text("加入缓释措施")').first().click();
    await page.waitForSelector("text=风险处置确认", { timeout: 10_000 });
    const riskPendingIntervention = await page
      .locator("text=风险处置确认")
      .count();
    const riskPendingTarget = await page
      .locator("text=目标：需求不及预期 / 缓释")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const riskMitigationPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Risk ID：risk_demand") &&
        content.includes("操作：缓释") &&
        content.includes("概率：42%") &&
        content.includes("影响等级：4/5") &&
        content.includes("可控程度：2/5") &&
        content.includes("触发信号：成品油消费连续两周低于季节性水平") &&
        content.includes("影响变量：var_demand、var_margin") &&
        content.includes("影响情景：risk") &&
        content.includes("已有缓释动作：action_hedge_margin"),
    );
    await selectCanvasNodeUntilPanel(page, "库存缓慢下降", "结论挑战", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="conclusion_base"])',
    });
    const conclusionChallengeControl = await page
      .locator("text=结论挑战")
      .count();
    const conclusionChallengeAction = await page
      .locator('button:has-text("挑战结论")')
      .count();
    const conclusionRefuteAction = await page
      .locator('button:has-text("要求反驳")')
      .count();
    const conclusionReportAction = await page
      .locator('button:has-text("生成报告")')
      .count();
    const conclusionVariablesVisible = await page
      .locator("text=变量：var_supply、var_demand、var_inventory")
      .count();
    const conclusionEvidenceVisible = await page
      .locator("text=证据：evidence_inventory_weekly")
      .count();
    const conclusionHypothesisVisible = await page
      .locator("text=假设：hypothesis_demand_soft")
      .count();
    const conclusionRiskVisible = await page.locator("text=风险：risk_demand").count();
    const conclusionScenarioVisible = await page
      .locator("text=情景：baseline")
      .count();
    await page.locator('button:has-text("挑战结论")').first().click();
    await page.waitForSelector("text=结论挑战确认", { timeout: 10_000 });
    const conclusionPendingIntervention = await page
      .locator("text=结论挑战确认")
      .count();
    const conclusionPendingTarget = await page
      .locator("text=目标：库存缓慢下降 / 挑战")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const conclusionChallengePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Conclusion ID：conclusion_base") &&
        content.includes("操作：挑战") &&
        content.includes("来源变量：var_supply、var_demand、var_inventory") &&
        content.includes("引用证据：evidence_inventory_weekly") &&
        content.includes("依赖假设：hypothesis_demand_soft") &&
        content.includes("关联风险：risk_demand") &&
        content.includes("关联情景：baseline"),
    );
    await page.waitForSelector("text=是否调整采购节奏", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(
      page,
      "是否调整采购节奏",
      "选择决策分支",
      { nodeSelector: '.react-flow__node:has([data-simulation-node-id="decision_pricing"])' },
    );
    const decisionBranchControl = await page
      .locator("text=选择决策分支")
      .count();
    const decisionCompareAction = await page
      .locator('button:has-text("比较分支")')
      .count();
    const decisionDeferAction = await page
      .locator('button:has-text("暂缓决策")')
      .count();
    const decisionAddVariableAction = await page
      .locator('button:has-text("补充决策变量")')
      .count();
    const decisionBranchOption = await page
      .locator('button:has-text("降低采购")')
      .count();
    await page.locator('button:has-text("降低采购")').click();
    await page.waitForSelector("text=待确认干预", { timeout: 10_000 });
    const decisionPendingIntervention = await page
      .locator("text=待确认干预")
      .count();
    const decisionPendingTarget = await page
      .locator("text=目标：是否调整采购节奏 / 降低采购")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const decisionBranchPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Decision ID：decision_pricing") &&
        content.includes("Branch ID：decision_reduce_purchase") &&
        content.includes("选择分支：降低采购") &&
        content.includes("Scenario ID：pessimistic"),
    );
    await page.waitForSelector("text=提前锁定部分利润", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "提前锁定部分利润", "行动模拟", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="action_hedge_margin"])',
      timeoutMs: 6_000,
    });
    const actionSimulationControl = await page.locator("text=行动模拟").count();
    const actionTypeVisible = await page.locator("text=动作类型：hedge").count();
    const actionConditionVisible = await page
      .locator("text=执行条件：利润波动超过风险阈值")
      .count();
    const actionSideEffectsVisible = await page
      .locator("text=潜在副作用：限制上行收益、增加保证金占用")
      .count();
    const actionExecuteOption = await page
      .locator('button:has-text("模拟执行")')
      .count();
    const actionCompareOption = await page
      .locator('button:has-text("对比不执行")')
      .count();
    const actionEditOption = await page
      .locator('button:has-text("修改行动")')
      .count();
    const actionConditionOption = await page
      .locator('button:has-text("补充条件")')
      .count();
    const actionSideEffectOption = await page
      .locator('button:has-text("评估副作用")')
      .count();
    await page.locator('button:has-text("模拟执行")').click();
    await page.waitForSelector("text=模拟行动执行", { timeout: 10_000 });
    const actionPendingIntervention = await page
      .locator("text=模拟行动执行")
      .count();
    const actionPendingTarget = await page
      .locator("text=目标：提前锁定部分利润")
      .count();
    await page.locator('button:has-text("确认执行")').first().click();
    const actionExecutePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Action ID：action_hedge_margin") &&
        content.includes("Action Type：hedge") &&
        content.includes("行动状态：执行") &&
        content.includes("执行条件：利润波动超过风险阈值") &&
        content.includes("潜在副作用：限制上行收益、增加保证金占用"),
    );
    await clickCanvasLayer(page, "输出层");
    await page.waitForSelector("text=第 1 轮总结", { timeout: 10_000 });
    await selectCanvasNodeUntilPanel(page, "第 1 轮总结", "总结操作", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="summary:simulation_summary_smoke"])',
    });
    const summaryActions = await page.locator("text=总结操作").count();
    const summaryFollowupAction = await page
      .locator('button:has-text("继续追问")')
      .count();
    const summaryReportAction = await page
      .locator('button:has-text("生成报告")')
      .count();
    const summaryNextAction = await page
      .locator('button:has-text("提取 Next Action")')
      .count();
    await page.locator('button:has-text("生成报告")').first().click();
    const summaryReportPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Summary ID：simulation_summary_smoke") &&
        content.includes("Round ID：round_1") &&
        content.includes("操作：报告") &&
        content.includes("关联结论：path_base、var_demand") &&
        content.includes("[path: path_base]") &&
        content.includes("[node: var_demand]"),
    );
    await clickCanvasLayer(page, "全部");
    const nextActionNodes = await page.locator("text=补充需求数据").count();
    await selectCanvasNodeUntilPanel(page, "补充需求数据", "执行动作", {
      nodeSelector:
        '.react-flow__node:has([data-simulation-node-id="next_action:next_action_add_demand_data"])',
    });
    const nextActionButtons = await page.locator("text=执行动作").count();
    const nextActionTypeVisible = await page
      .locator("text=动作类型：add_data")
      .count();
    const nextActionTargetVisible = await page
      .locator("text=目标节点：var_demand")
      .count();
    const nextActionExpectedEffectVisible = await page
      .locator("text=预期效果：补充需求恢复速度数据后，重新推理库存和炼厂利润路径。")
      .count();
    await page.locator('button:has-text("执行动作")').click();
    const nextActionPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Action ID：next_action_add_demand_data") &&
        content.includes("类型：add_data") &&
        content.includes("Target ID：var_demand") &&
        content.includes("预期效果：补充需求恢复速度数据后，重新推理库存和炼厂利润路径。") &&
        content.includes("不要把 Next Action 当成普通建议"),
    );
    await clickCanvasLayer(page, "输出层");
    const reportNode = page
      .locator(`.react-flow__node:has-text("${REPORT_PATH}")`)
      .first();
    await reportNode.waitFor({ state: "visible", timeout: 18_000 });
    await reportNode.click();
    await page.waitForSelector("text=报告操作", { timeout: 12_000 });
    const reportActions = await page.locator("text=报告操作").count();
    const reportUpdateAction = await page
      .locator('button:has-text("更新报告")')
      .count();
    const reportDeckAction = await page
      .locator('button:has-text("生成演示稿")')
      .count();
    const reportSummaryAction = await page
      .locator('button:has-text("提取摘要")')
      .count();
    await page.locator('button:has-text("更新报告")').first().click();
    const reportUpdatePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("Deliverables ID：simulation_deliverables_smoke") &&
        content.includes("Deliverables Zone：summary") &&
        content.includes("Headline：本轮推演报告如下：") &&
        content.includes(`主文件：${REPORT_PATH}`) &&
        content.includes(`Workspace Project：${SANDBOX_PROJECT_ID}`) &&
        content.includes(`全部文件：${REPORT_PATH}`) &&
        content.includes(
          `${REPORT_PATH} kind=primary mime=text/markdown project=${SANDBOX_PROJECT_ID}`,
        ),
    );
    await clickCanvasLayer(page, "全部");
    await selectCanvasNodeUntilPanel(page, "当前轮次 round_2", "版本操作", {
      nodeSelector: '.react-flow__node:has([data-simulation-node-id="history:round_2"])',
    });
    const historyActions = await page.locator("text=版本操作").count();
    const historyCompareAction = await page
      .locator('button:has-text("对比最新")')
      .count();
    const historyLatestAction = await page
      .locator('button:has-text("回到最新")')
      .count();
    const historyContinueAction = await page
      .locator('button:has-text("从此继续")')
      .count();
    const historyInterventionCount = await page.locator("text=干预：2 条").count();
    const historyInterventionVisible = await page
      .locator("text=variable_override → node:var_demand")
      .count();
    const historyIdOnlyInterventionVisible = await page
      .locator("text=risk_stress_test → node:risk_demand")
      .count();
    await page.locator('button:has-text("从此继续")').first().click();
    const historyContinuePersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("请处理这个推演历史版本") &&
        content.includes("History：当前轮次 round_2") &&
        content.includes("Round ID：round_2") &&
        content.includes("操作：从此继续") &&
        content.includes("当前主题：推演 OPEC+ 延长减产") &&
        content.includes("当前画布节点数：") &&
        (content.includes("当前路径状态：3 条推理路径") ||
          content.includes("当前路径状态：3 路径")) &&
        content.includes("本轮干预数：2") &&
        content.includes("最近干预：variable_override → node:var_demand") &&
        content.includes("影响 节点 库存缓慢下降、利润继续承压") &&
        content.includes("边 推动库存去化、缓释利润承压") &&
        content.includes("最近干预：risk_stress_test → node:risk_demand") &&
        content.includes("节点 decision_pricing") &&
        content.includes("边 edge_risk_decision") &&
        content.includes("路径 path_risk") &&
        content.includes("情景 risk") &&
        content.includes("分支起点继续推演") &&
        content.includes("不要覆盖已有轮次"),
    );
    await page
      .locator('.react-flow__node:has-text("推演处理中断")')
      .first()
      .click();
    await page.waitForSelector("text=恢复操作", { timeout: 10_000 });
    const recoveryActions = await page.locator("text=恢复操作").count();
    const recoveryRetryAction = await page
      .locator('button:has-text("重试本轮")')
      .count();
    const recoveryInspectAction = await page
      .locator('button:has-text("查看已保存内容")')
      .count();
    const recoveryRestartAction = await page
      .locator('button:has-text("基于快照重新开始")')
      .count();
    await page.locator('button:has-text("查看已保存内容")').first().click();
    const recoveryInspectPersistedMessage = await waitForUserMessage(
      SCENARIO_SESSION_ID,
      (content) =>
        content.includes("请处理这个推演恢复节点") &&
        content.includes("操作：查看已保存内容") &&
        content.includes("当前已保存的 Prompt、Topic、关键节点、路径、Summary、Report 和缺失部分"),
    );

    const result = {
      pendingCanvas,
      workbench: await page.locator(".simulation-canvas-shell .react-flow").count(),
      canvas: await page.locator(".react-flow").count(),
      nodes: await page.locator(".react-flow__node").count(),
      paths: await page.locator("text=最可能路径").count(),
      roundButtons,
      historicalNotice,
      promptControl,
      promptReparseAction,
      promptEditAction,
      promptCancelAction,
      promptReparsePersistedMessage,
      topicBoundaryControl,
      topicConfirmAction,
      topicEditAction,
      topicAddConditionAction,
      topicConfirmPersistedMessage,
      layerVariableVisible,
      scenarioActions,
      scenarioCompareAction,
      scenarioCounterfactualAction,
      scenarioPendingIntervention,
      scenarioPendingTarget,
      scenarioContinuePersistedMessage,
      scenarioComparePersistedMessage,
      pathActions,
      pathPendingIntervention,
      pathPendingTarget,
      pathContinuePersistedMessage,
      entityModelingControl,
      entityAddVariableAction,
      entityAddEventAction,
      entityRelationAction,
      entityAddVariablePersistedMessage,
      nodeActions,
      variableControl,
      variableInspectAction,
      variableLockAction,
      variableResetAction,
      variableRecalculateAction,
      interventionPreview,
      affectedNodes,
      variablePendingIntervention,
      variablePendingTarget,
      nodeExpandPersistedMessage,
      variableRecalculatePersistedMessage,
      hypothesisBranchControl,
      hypothesisReplaceAction,
      hypothesisLockAction,
      hypothesisDeleteAction,
      hypothesisBranchAction,
      hypothesisConfidenceVisible,
      hypothesisBranchableVisible,
      hypothesisImpactPreview,
      hypothesisPendingIntervention,
      hypothesisPendingTarget,
      hypothesisBranchPersistedMessage,
      eventAssumptionControl,
      eventIfThen,
      eventAssumeHappens,
      eventAssumeNotHappens,
      eventPendingIntervention,
      eventPendingTarget,
      eventAssumptionPersistedMessage,
      inferenceReviewControl,
      inferenceEvidenceAction,
      inferenceRerunAction,
      inferenceCounterAction,
      inferenceModelVisible,
      inferenceInputVisible,
      inferenceOutputVisible,
      inferencePendingIntervention,
      inferencePendingTarget,
      inferenceCounterPersistedMessage,
      evidenceReviewControl,
      evidenceVerifyAction,
      evidenceLocateAction,
      evidenceCounterAction,
      evidenceOpenSourceAction,
      evidenceReplaceAction,
      evidenceSupplementAction,
      evidenceUrlVisible,
      evidencePageVisible,
      evidenceQuoteVisible,
      evidenceCitedByVisible,
      evidencePendingIntervention,
      evidencePendingTarget,
      evidenceReplacePersistedMessage,
      riskTreatmentControl,
      riskMitigationAction,
      riskWarningAction,
      riskStressAction,
      riskAffectedVariablesVisible,
      riskAffectedScenariosVisible,
      riskMitigationVisible,
      riskPendingIntervention,
      riskPendingTarget,
      riskMitigationPersistedMessage,
      conclusionChallengeControl,
      conclusionChallengeAction,
      conclusionRefuteAction,
      conclusionReportAction,
      conclusionVariablesVisible,
      conclusionEvidenceVisible,
      conclusionHypothesisVisible,
      conclusionRiskVisible,
      conclusionScenarioVisible,
      conclusionPendingIntervention,
      conclusionPendingTarget,
      conclusionChallengePersistedMessage,
      decisionBranchControl,
      decisionCompareAction,
      decisionDeferAction,
      decisionAddVariableAction,
      decisionBranchOption,
      decisionPendingIntervention,
      decisionPendingTarget,
      decisionBranchPersistedMessage,
      actionSimulationControl,
      actionTypeVisible,
      actionConditionVisible,
      actionSideEffectsVisible,
      actionExecuteOption,
      actionCompareOption,
      actionEditOption,
      actionConditionOption,
      actionSideEffectOption,
      actionPendingIntervention,
      actionPendingTarget,
      actionExecutePersistedMessage,
      summaryActions,
      summaryFollowupAction,
      summaryReportAction,
      summaryNextAction,
      summaryReportPersistedMessage,
      nextActionNodes,
      nextActionButtons,
      nextActionTypeVisible,
      nextActionTargetVisible,
      nextActionExpectedEffectVisible,
      nextActionPersistedMessage,
      recoveryNodes: await page.locator("text=推演处理中断").count(),
      recoveryActions,
      recoveryRetryAction,
      recoveryInspectAction,
      recoveryRestartAction,
      historyActions,
      historyCompareAction,
      historyLatestAction,
      historyContinueAction,
      historyInterventionCount,
      historyInterventionVisible,
      historyIdOnlyInterventionVisible,
      historyContinuePersistedMessage,
      recoveryInspectPersistedMessage,
      reportDeliverables: await page
        .locator(`text=${REPORT_PATH}`)
        .count(),
      reportActions,
      reportUpdateAction,
      reportDeckAction,
      reportSummaryAction,
      reportUpdatePersistedMessage,
    };
    assert(result.workbench > 0, "simulation workbench not visible");
    assert(result.canvas > 0, "React Flow canvas not visible");
    assert(result.nodes >= 10, `expected at least 10 nodes, got ${result.nodes}`);
    assert(result.paths > 0, "path selector not visible");
    assert(result.roundButtons > 0, "round selector not visible");
    assert(result.historicalNotice > 0, "historical round notice not visible");
    assert(result.promptControl > 0, "prompt control not visible");
    assert(result.promptReparseAction > 0, "prompt reparse action not visible");
    assert(result.promptEditAction > 0, "prompt edit action not visible");
    assert(result.promptCancelAction > 0, "prompt cancel action not visible");
    assert(
      result.promptReparsePersistedMessage.includes("Prompt ID：prompt_user"),
      "prompt reparse persisted message missing prompt id",
    );
    assert(
      result.promptReparsePersistedMessage.includes("Prompt→Topic 的双节点关系"),
      "prompt reparse persisted message missing double-node relationship",
    );
    assert(result.topicBoundaryControl > 0, "topic boundary control not visible");
    assert(result.topicConfirmAction > 0, "topic confirm action not visible");
    assert(result.topicEditAction > 0, "topic edit action not visible");
    assert(result.topicAddConditionAction > 0, "topic add condition action not visible");
    assert(
      result.topicConfirmPersistedMessage.includes("Topic ID：topic"),
      "topic confirm persisted message missing topic id",
    );
    assert(
      result.topicConfirmPersistedMessage.includes("世界模型层：Entity、Variable、Hypothesis"),
      "topic confirm persisted message missing world model instruction",
    );
    assert(result.layerVariableVisible > 0, "variable layer filter did not reveal variable node");
    assert(result.scenarioActions > 0, "scenario continuation action not visible");
    assert(result.scenarioCompareAction > 0, "scenario compare action not visible");
    assert(result.scenarioCounterfactualAction > 0, "scenario counterfactual action not visible");
    assert(result.scenarioPendingIntervention > 0, "scenario pending intervention not visible");
    assert(result.scenarioPendingTarget > 0, "scenario pending target not visible");
    assert(
      result.scenarioComparePersistedMessage.includes("Path IDs：path_risk"),
      "scenario compare persisted message missing path ids",
    );
    assert(
      result.scenarioComparePersistedMessage.includes("Node IDs：var_demand、event_demand_shock、risk_demand"),
      "scenario compare persisted message missing node ids",
    );
    assert(
      result.scenarioComparePersistedMessage.includes("Edge IDs：edge_demand_event、edge_event_inference"),
      "scenario compare persisted message missing edge ids",
    );
    assert(
      result.scenarioComparePersistedMessage.includes("Baseline Scenario ID：baseline"),
      "scenario compare persisted message missing baseline id",
    );
    assert(
      result.scenarioComparePersistedMessage.includes("相对 Baseline 新增路径：风险路径"),
      "scenario compare persisted message missing path diff",
    );
    assert(
      result.scenarioContinuePersistedMessage.includes("情景选择属于硬选择点"),
      "scenario continue persisted message missing hard selection instruction",
    );
    assert(
      result.scenarioContinuePersistedMessage.includes("请基于该情景生成新一轮 Reasoning Graph"),
      "scenario continue persisted message missing new graph instruction",
    );
    assert(result.pathActions > 0, "path continuation action not visible");
    assert(result.pathPendingIntervention > 0, "path pending intervention not visible");
    assert(result.pathPendingTarget > 0, "path pending target not visible");
    assert(
      result.pathContinuePersistedMessage.includes("路径 ID：path_base"),
      "path continue persisted message missing path id",
    );
    assert(
      result.pathContinuePersistedMessage.includes("Scenario IDs：baseline"),
      "path continue persisted message missing scenario ids",
    );
    assert(
      result.pathContinuePersistedMessage.includes("路径选择属于硬选择点"),
      "path continue persisted message missing hard selection instruction",
    );
    assert(result.entityModelingControl > 0, "entity modeling control not visible");
    assert(result.entityAddVariableAction > 0, "entity add variable action not visible");
    assert(result.entityAddEventAction > 0, "entity add event action not visible");
    assert(result.entityRelationAction > 0, "entity relation action not visible");
    assert(
      result.entityAddVariablePersistedMessage.includes("Entity ID：entity_opec"),
      "entity add variable persisted message missing entity id",
    );
    assert(
      result.entityAddVariablePersistedMessage.includes("关联变量：减产执行力度、库存变化"),
      "entity add variable persisted message missing variables",
    );
    assert(
      result.entityAddVariablePersistedMessage.includes("关联事件：需求恢复中断"),
      "entity add variable persisted message missing events",
    );
    assert(result.nodeActions > 0, "node continuation action not visible");
    assert(result.variableControl > 0, "variable control not visible");
    assert(result.variableInspectAction > 0, "variable inspect action not visible");
    assert(result.variableLockAction > 0, "variable lock action not visible");
    assert(result.variableResetAction > 0, "variable reset action not visible");
    assert(result.variableRecalculateAction > 0, "variable recalculate action not visible");
    assert(result.interventionPreview > 0, "intervention impact preview not visible");
    assert(result.affectedNodes > 0, "affected downstream node not visible");
    assert(result.variablePendingIntervention > 0, "variable pending intervention not visible");
    assert(result.variablePendingTarget > 0, "variable pending target not visible");
    assert(
      result.nodeExpandPersistedMessage.includes("节点 ID：var_demand"),
      "node expand persisted message missing node id",
    );
    assert(
      result.nodeExpandPersistedMessage.includes("预计影响情景：Baseline、Risk"),
      "node expand persisted message missing affected scenarios",
    );
    assert(
      result.nodeExpandPersistedMessage.includes("不要发散到全图"),
      "node expand persisted message missing scoped expansion instruction",
    );
    assert(
      result.variableRecalculatePersistedMessage.includes("变量 ID：var_demand"),
      "variable recalculate persisted message missing variable id",
    );
    assert(
      result.variableRecalculatePersistedMessage.includes("目标值：偏弱"),
      "variable recalculate persisted message missing target value",
    );
    assert(
      result.variableRecalculatePersistedMessage.includes("变量类型：enum"),
      "variable recalculate persisted message missing schema kind",
    );
    assert(
      result.variableRecalculatePersistedMessage.includes("可选值：偏弱、中性、偏强"),
      "variable recalculate persisted message missing schema options",
    );
    assert(
      result.variableRecalculatePersistedMessage.includes("预计影响情景：Baseline、Risk"),
      "variable recalculate persisted message missing affected scenarios",
    );
    assert(result.hypothesisBranchControl > 0, "hypothesis branch control not visible");
    assert(result.hypothesisReplaceAction > 0, "hypothesis replace action not visible");
    assert(result.hypothesisLockAction > 0, "hypothesis lock action not visible");
    assert(result.hypothesisDeleteAction > 0, "hypothesis delete action not visible");
    assert(result.hypothesisBranchAction > 0, "hypothesis branch action not visible");
    assert(result.hypothesisConfidenceVisible > 0, "hypothesis confidence not visible");
    assert(result.hypothesisBranchableVisible > 0, "hypothesis branchable state not visible");
    assert(result.hypothesisImpactPreview > 0, "hypothesis impact preview not visible");
    assert(result.hypothesisPendingIntervention > 0, "hypothesis pending intervention not visible");
    assert(result.hypothesisPendingTarget > 0, "hypothesis pending target not visible");
    assert(
      result.hypothesisBranchPersistedMessage.includes("Hypothesis ID：hypothesis_demand_soft"),
      "hypothesis branch persisted message missing hypothesis id",
    );
    assert(
      result.hypothesisBranchPersistedMessage.includes("当前可信度：70%"),
      "hypothesis branch persisted message missing confidence",
    );
    assert(result.eventAssumptionControl > 0, "event assumption control not visible");
    assert(result.eventIfThen > 0, "event IF/THEN preview not visible");
    assert(result.eventAssumeHappens > 0, "event assume happens action not visible");
    assert(result.eventAssumeNotHappens > 0, "event assume not happens action not visible");
    assert(result.eventPendingIntervention > 0, "event pending intervention not visible");
    assert(result.eventPendingTarget > 0, "event pending target not visible");
    assert(
      result.eventAssumptionPersistedMessage.includes("Event ID：event_demand_shock"),
      "event assumption persisted message missing event id",
    );
    assert(
      result.eventAssumptionPersistedMessage.includes("发生概率：28%"),
      "event assumption persisted message missing probability",
    );
    assert(result.inferenceReviewControl > 0, "inference review control not visible");
    assert(result.inferenceEvidenceAction > 0, "inference evidence action not visible");
    assert(result.inferenceRerunAction > 0, "inference rerun action not visible");
    assert(result.inferenceCounterAction > 0, "inference counter action not visible");
    assert(result.inferenceModelVisible > 0, "inference model not visible");
    assert(result.inferenceInputVisible > 0, "inference input nodes not visible");
    assert(result.inferenceOutputVisible > 0, "inference output nodes not visible");
    assert(result.inferencePendingIntervention > 0, "inference pending intervention not visible");
    assert(result.inferencePendingTarget > 0, "inference pending target not visible");
    assert(
      result.inferenceCounterPersistedMessage.includes("使用模型：DeepResearch"),
      "inference counter persisted message missing model",
    );
    assert(
      result.inferenceCounterPersistedMessage.includes("已有反证线索"),
      "inference counter persisted message missing counter evidence",
    );
    assert(result.evidenceReviewControl > 0, "evidence review control not visible");
    assert(result.evidenceVerifyAction > 0, "evidence verify action not visible");
    assert(result.evidenceLocateAction > 0, "evidence locate action not visible");
    assert(result.evidenceCounterAction > 0, "evidence counter action not visible");
    assert(result.evidenceOpenSourceAction > 0, "evidence open source action not visible");
    assert(result.evidenceReplaceAction > 0, "evidence replace action not visible");
    assert(result.evidenceSupplementAction > 0, "evidence supplement action not visible");
    assert(result.evidenceUrlVisible > 0, "evidence source url not visible");
    assert(result.evidencePageVisible > 0, "evidence page not visible");
    assert(result.evidenceQuoteVisible > 0, "evidence quote not visible");
    assert(result.evidenceCitedByVisible > 0, "evidence cited-by nodes not visible");
    assert(result.evidencePendingIntervention > 0, "evidence pending intervention not visible");
    assert(result.evidencePendingTarget > 0, "evidence pending target not visible");
    assert(
      result.evidenceReplacePersistedMessage.includes("原文链接：https://www.eia.gov/petroleum/supply/weekly/"),
      "evidence replace persisted message missing source url",
    );
    assert(
      result.evidenceReplacePersistedMessage.includes("引用节点：inference_inventory_margin、conclusion_base"),
      "evidence replace persisted message missing cited nodes",
    );
    assert(result.riskTreatmentControl > 0, "risk treatment control not visible");
    assert(result.riskMitigationAction > 0, "risk mitigation action not visible");
    assert(result.riskWarningAction > 0, "risk warning action not visible");
    assert(result.riskStressAction > 0, "risk stress action not visible");
    assert(result.riskAffectedVariablesVisible > 0, "risk affected variables not visible");
    assert(result.riskAffectedScenariosVisible > 0, "risk affected scenarios not visible");
    assert(result.riskMitigationVisible > 0, "risk mitigation action ids not visible");
    assert(result.riskPendingIntervention > 0, "risk pending intervention not visible");
    assert(result.riskPendingTarget > 0, "risk pending target not visible");
    assert(
      result.riskMitigationPersistedMessage.includes("已有缓释动作：action_hedge_margin"),
      "risk mitigation persisted message missing mitigation action id",
    );
    assert(
      result.riskMitigationPersistedMessage.includes("影响情景：risk"),
      "risk mitigation persisted message missing affected scenario",
    );
    assert(result.conclusionChallengeControl > 0, "conclusion challenge control not visible");
    assert(result.conclusionChallengeAction > 0, "conclusion challenge action not visible");
    assert(result.conclusionRefuteAction > 0, "conclusion refute action not visible");
    assert(result.conclusionReportAction > 0, "conclusion report action not visible");
    assert(result.conclusionVariablesVisible > 0, "conclusion variable ids not visible");
    assert(result.conclusionEvidenceVisible > 0, "conclusion evidence ids not visible");
    assert(result.conclusionHypothesisVisible > 0, "conclusion hypothesis ids not visible");
    assert(result.conclusionRiskVisible > 0, "conclusion risk ids not visible");
    assert(result.conclusionScenarioVisible > 0, "conclusion scenario ids not visible");
    assert(result.conclusionPendingIntervention > 0, "conclusion pending intervention not visible");
    assert(result.conclusionPendingTarget > 0, "conclusion pending target not visible");
    assert(
      result.conclusionChallengePersistedMessage.includes("来源变量：var_supply、var_demand、var_inventory"),
      "conclusion challenge persisted message missing variable ids",
    );
    assert(
      result.conclusionChallengePersistedMessage.includes("引用证据：evidence_inventory_weekly"),
      "conclusion challenge persisted message missing evidence ids",
    );
    assert(
      result.conclusionChallengePersistedMessage.includes("依赖假设：hypothesis_demand_soft"),
      "conclusion challenge persisted message missing hypothesis ids",
    );
    assert(
      result.conclusionChallengePersistedMessage.includes("关联风险：risk_demand"),
      "conclusion challenge persisted message missing risk ids",
    );
    assert(
      result.conclusionChallengePersistedMessage.includes("关联情景：baseline"),
      "conclusion challenge persisted message missing scenario ids",
    );
    assert(result.decisionBranchControl > 0, "decision branch control not visible");
    assert(result.decisionCompareAction > 0, "decision compare action not visible");
    assert(result.decisionDeferAction > 0, "decision defer action not visible");
    assert(result.decisionAddVariableAction > 0, "decision add variable action not visible");
    assert(result.decisionBranchOption > 0, "decision branch option not visible");
    assert(result.decisionPendingIntervention > 0, "decision pending intervention not visible");
    assert(result.decisionPendingTarget > 0, "decision pending target not visible");
    assert(
      result.decisionBranchPersistedMessage.includes("Branch ID：decision_reduce_purchase"),
      "decision branch persisted message missing branch id",
    );
    assert(
      result.decisionBranchPersistedMessage.includes("Scenario ID：pessimistic"),
      "decision branch persisted message missing scenario id",
    );
    assert(result.actionSimulationControl > 0, "action simulation control not visible");
    assert(result.actionTypeVisible > 0, "action type not visible");
    assert(result.actionConditionVisible > 0, "action condition not visible");
    assert(result.actionSideEffectsVisible > 0, "action side effects not visible");
    assert(result.actionExecuteOption > 0, "action execute option not visible");
    assert(result.actionCompareOption > 0, "action compare option not visible");
    assert(result.actionEditOption > 0, "action edit option not visible");
    assert(result.actionConditionOption > 0, "action condition option not visible");
    assert(result.actionSideEffectOption > 0, "action side effect option not visible");
    assert(result.actionPendingIntervention > 0, "action pending intervention not visible");
    assert(result.actionPendingTarget > 0, "action pending target not visible");
    assert(
      result.actionExecutePersistedMessage.includes("Action Type：hedge"),
      "action execute persisted message missing action type",
    );
    assert(
      result.actionExecutePersistedMessage.includes("执行条件：利润波动超过风险阈值"),
      "action execute persisted message missing condition",
    );
    assert(result.summaryActions > 0, "summary actions control not visible");
    assert(result.summaryFollowupAction > 0, "summary followup action not visible");
    assert(result.summaryReportAction > 0, "summary report action not visible");
    assert(result.summaryNextAction > 0, "summary next action extraction not visible");
    assert(
      result.summaryReportPersistedMessage.includes("Summary ID：simulation_summary_smoke"),
      "summary report persisted message missing summary id",
    );
    assert(
      result.summaryReportPersistedMessage.includes("Round ID：round_1"),
      "summary report persisted message missing round id",
    );
    assert(
      result.summaryReportPersistedMessage.includes("关联结论：path_base、var_demand"),
      "summary report persisted message missing conclusion ids",
    );
    assert(
      result.summaryReportPersistedMessage.includes("[node: var_demand]"),
      "summary report persisted message missing graph reference token",
    );
    assert(result.nextActionNodes > 0, "next action node not visible");
    assert(result.nextActionButtons > 0, "next action execute button not visible");
    assert(result.nextActionTypeVisible > 0, "next action type not visible");
    assert(result.nextActionTargetVisible > 0, "next action target not visible");
    assert(
      result.nextActionExpectedEffectVisible > 0,
      "next action expected effect not visible",
    );
    assert(
      result.nextActionPersistedMessage.includes("Action ID：next_action_add_demand_data"),
      "next action persisted message missing action id",
    );
    assert(
      result.nextActionPersistedMessage.includes("Target ID：var_demand"),
      "next action persisted message missing target id",
    );
    assert(result.recoveryNodes > 0, "simulation recovery node not visible");
    assert(result.recoveryActions > 0, "recovery actions control not visible");
    assert(result.recoveryRetryAction > 0, "recovery retry action not visible");
    assert(result.recoveryInspectAction > 0, "recovery inspect action not visible");
    assert(result.recoveryRestartAction > 0, "recovery restart action not visible");
    assert(result.historyActions > 0, "history actions control not visible");
    assert(result.historyCompareAction > 0, "history compare action not visible");
    assert(result.historyLatestAction > 0, "history latest action not visible");
    assert(result.historyContinueAction > 0, "history continue action not visible");
    assert(result.historyInterventionCount > 0, "history intervention count not visible");
    assert(
      result.historyInterventionVisible > 0,
      "history intervention detail not visible",
    );
    assert(
      result.historyContinuePersistedMessage.includes("Round ID：round_2"),
      "history continue persisted message missing round id",
    );
    assert(
      result.historyContinuePersistedMessage.includes("本轮干预数：2"),
      "history continue persisted message missing intervention count",
    );
    assert(
      result.historyContinuePersistedMessage.includes("最近干预：variable_override → node:var_demand"),
      "history continue persisted message missing recent intervention",
    );
    assert(
      result.historyContinuePersistedMessage.includes("影响 节点 库存缓慢下降、利润继续承压"),
      "history continue persisted message missing intervention impact preview",
    );
    assert(
      result.historyContinuePersistedMessage.includes("边 推动库存去化、缓释利润承压"),
      "history continue persisted message missing intervention edge impact preview",
    );
    assert(
      result.historyIdOnlyInterventionVisible > 0,
      "history id-only intervention detail not visible",
    );
    assert(
      result.historyContinuePersistedMessage.includes("最近干预：risk_stress_test → node:risk_demand") &&
        result.historyContinuePersistedMessage.includes("节点 decision_pricing") &&
        result.historyContinuePersistedMessage.includes("边 edge_risk_decision") &&
        result.historyContinuePersistedMessage.includes("路径 path_risk") &&
        result.historyContinuePersistedMessage.includes("情景 risk"),
      "history continue persisted message missing id-only impact preview",
    );
    assert(
      result.historyContinuePersistedMessage.includes("分支起点继续推演"),
      "history continue persisted message missing branch instruction",
    );
    assert(
      result.historyContinuePersistedMessage.includes("不要覆盖已有轮次"),
      "history continue persisted message missing history preservation instruction",
    );
    assert(
      result.recoveryInspectPersistedMessage.includes("Prompt、Topic、关键节点、路径、Summary、Report"),
      "recovery inspect persisted message missing snapshot inventory instruction",
    );
    assert(
      result.reportDeliverables > 0,
      "simulation report deliverable not visible",
    );
    assert(result.reportActions > 0, "report actions control not visible");
    assert(result.reportUpdateAction > 0, "report update action not visible");
    assert(result.reportDeckAction > 0, "report deck action not visible");
    assert(result.reportSummaryAction > 0, "report summary action not visible");
    assert(
      result.reportUpdatePersistedMessage.includes("Deliverables ID：simulation_deliverables_smoke"),
      "report update persisted message missing deliverables id",
    );
    assert(
      result.reportUpdatePersistedMessage.includes(`主文件：${REPORT_PATH}`),
      "report update persisted message missing primary path",
    );
    assert(
      result.reportUpdatePersistedMessage.includes(`Workspace Project：${SANDBOX_PROJECT_ID}`),
      "report update persisted message missing workspace project id",
    );
    assert(
      result.reportUpdatePersistedMessage.includes(
        `${REPORT_PATH} kind=primary mime=text/markdown project=${SANDBOX_PROJECT_ID}`,
      ),
      "report update persisted message missing file detail",
    );

    await page.locator(`text=${REPORT_PATH}`).first().click();
    await page
      .locator(".chat-deliverable-row button", { hasText: REPORT_PATH })
      .first()
      .click();
    await page.waitForSelector("text=报告文件已打开验证", { timeout: 10_000 });

    result.reportPreview = await page
      .locator("text=报告文件已打开验证")
      .count();
    assert(result.reportPreview > 0, "simulation report preview not visible");
    console.log(
      JSON.stringify(
        {
          ok: true,
          sessions: {
            requirements: REQUIREMENTS_SESSION_ID,
            confirmed: CONFIRMED_SESSION_ID,
            scenario: SCENARIO_SESSION_ID,
          },
          result,
          newHome: {
            canvas: newHomeCanvas,
            nodes: newHomeNodes,
            prompt: newHomePrompt,
          },
          pending: {
            canvas: pendingCanvas,
            nodes: pendingNodes,
            seed: pendingSeed,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close().catch(() => {});
    await cleanup();
  }
}

main().catch(async (err) => {
  await cleanup();
  console.error(err);
  process.exit(1);
});

import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonFence(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

type SmokeNode = {
  id: string;
  type: string;
  label: string;
  roundId: string;
  [key: string]: unknown;
};

type SmokeScenario = {
  prompt?: SmokeNode;
  topic: string | SmokeNode;
  nodes?: SmokeNode[];
  entities: SmokeNode[];
  variables: SmokeNode[];
};

function smokeSnapshotNodes(scenario: SmokeScenario, roundId: string): SmokeNode[] {
  const topicNode =
    typeof scenario.topic === "string"
      ? {
          id: "topic",
          type: "topic",
          label: scenario.topic,
          roundId,
        }
      : scenario.topic;
  const nodes = new Map<string, SmokeNode>();
  for (const node of [
    scenario.prompt,
    topicNode,
    ...(scenario.nodes ?? []),
    ...scenario.entities,
    ...scenario.variables,
  ]) {
    if (node) nodes.set(node.id, { ...nodes.get(node.id), ...node });
  }
  return [...nodes.values()];
}

async function main() {
  const dataDir = await mkdtemp(join(tmpdir(), "xiaochuang-simulation-p0-"));
  process.env.COMPANION_DATA_DIR = dataDir;

  const reducer = await import("../web/src/lib/chat-parts-reducer.js");
  const mockAiUiFlow = await import("../web/src/lib/mock-ai-ui-flow.js");
  const requirementsParts = await import(
    "../companion/src/runs/requirements-parts.js"
  );
  const snapshotStore = await import("../companion/src/simulation/snapshot.js");
  const sessionRuntime = await import("../companion/src/sessions/runtime.js");
  const runManager = await import("../companion/src/runs/manager.js");
  const moduleRegistry = await import("../web/src/lib/module-registry.js");
  const contracts = await import("../packages/contracts/src/index.js");
  const simulationEntryState = await import(
    "../companion/src/runs/simulation-entry-state.js"
  );
  const scenarioFallback = await import(
    "../companion/src/simulation/scenario-fallback.js"
  );
  const simulationDigest = await import("../companion/src/simulation/digest.js");
  const reportFallback = await import(
    "../companion/src/simulation/report-fallback.js"
  );
  const simulationActions = await import(
    "../companion/src/simulation/actions.js"
  );

  const simulationRequirementsPart =
    requirementsParts.extractRequirementsPartFromAssistantMarkdown({
      moduleId: "simulation",
      processSkill: "skill-simulation-base",
      assistantMarkdown: jsonFence({
        kind: "simulation_requirements",
        title: "请先校对这次推演的关键信息",
        questions: [
          {
            id: "topic",
            label: "推演主题",
            type: "text",
            required: true,
            value: "美国提高关税对中国纺织出口未来一年的影响",
          },
          {
            id: "tariff_assumption",
            label: "关税加征基准假设",
            type: "select",
            required: true,
            value: "在现有关税基础上再加征 10-25 个百分点",
            options: ["维持不变", "再加征 10-25 个百分点"],
          },
          {
            id: "key_variables",
            label: "最关心的变量",
            type: "multiselect",
            value: ["订单量", "产业链转移速度"],
            options: ["订单量", "产业链转移速度", "利润率"],
          },
        ],
      }),
    });
  assert(
    simulationRequirementsPart?.kind === "simulation_requirements",
    "simulation requirements with select/multiselect values should parse",
  );
  assert(
    simulationRequirementsPart.questions[0]?.placeholder ===
      "美国提高关税对中国纺织出口未来一年的影响",
    "simulation requirements value should remain visible as field context",
  );
  assert(
    simulationRequirementsPart.answers?.topic ===
      "美国提高关税对中国纺织出口未来一年的影响",
    "simulation requirements value should become editable default text",
  );
  assert(
    simulationRequirementsPart.selectedOptions?.tariff_assumption?.[0] ===
      "再加征 10-25 个百分点" &&
      simulationRequirementsPart.selectedOptions?.key_variables?.includes("订单量") &&
      simulationRequirementsPart.selectedOptions?.key_variables?.includes(
        "产业链转移速度",
      ),
    "simulation requirements select defaults should become selected options",
  );
  assert(
    simulationRequirementsPart.questions[1]?.type === "single_select" &&
      simulationRequirementsPart.questions[2]?.type === "multi_select",
    "simulation requirements select aliases should normalize",
  );
  const simulationSkills = moduleRegistry.resolveSkills({
    moduleId: "simulation",
    binding: {},
  });
  assert(
    simulationSkills.processSkill === "skill-simulation-base",
    "simulation process skill should remain skill-simulation-base",
  );
  assert(
    simulationSkills.supportSkillSlugs.includes("skill-world-model"),
    "simulation world-model stage should inject skill-world-model",
  );
  assert(
    contracts.checkNodeTransition("topic", "action").reason ===
      "disallowed_shortcut" &&
      contracts.isConnectionAllowed("topic", "action") === false,
    "simulation grammar should reject disallowed shortcuts",
  );

  const scenarioBlock = jsonFence({
    kind: "simulation_scenario",
    title: "初始沙盘",
    scenario: {
      topic: "OPEC+ 减产影响推演",
      entities: [
        {
          id: "entity_opec",
          type: "entity",
          label: "OPEC+",
          detail: "供应侧关键主体",
          roundId: "round_1",
        },
      ],
      variables: [
        {
          id: "var_demand",
          type: "variable",
          label: "需求恢复速度",
          detail: "影响库存和炼厂利润",
          roundId: "round_1",
          value: "中性",
          defaultValue: "中性",
          valueSchema: {
            kind: "enum",
            options: ["偏弱", "中性", "偏强"],
          },
          data: {
            worldModel: {
              waveId: "wave_1_skeleton",
              waveIndex: 1,
              waveType: "skeleton",
              waveTitle: "搭建核心变量骨架",
              analysisQuestion: "最先需要观察哪些核心变量？",
              upstreamNodeIds: ["entity_opec"],
              rationale: "需求恢复速度决定库存去化与炼厂利润的下游分叉。",
              confidence: 0.72,
              uncertainty: ["缺少最新月度需求数据"],
            },
          },
        },
      ],
      assumptions: ["未来三个月无极端地缘冲突"],
      paths: [
        {
          id: "path_base",
          label: "最可能路径",
          status: "available",
          edgeIds: ["edge_1"],
          summary: "需求温和恢复，库存缓慢下降。",
          roundId: "round_1",
        },
      ],
      edges: [
        {
          id: "edge_1",
          type: "causal",
          source: "var_demand",
          target: "path_base",
          label: "影响库存去化",
          roundId: "round_1",
        },
      ],
    },
  });
  const followupBlocks = [
    jsonFence({
      kind: "simulation_node",
      node: {
        id: "risk_inventory",
        type: "risk",
        label: "库存超预期累积",
        detail: "需求偏弱时的主要风险节点",
        roundId: "round_2",
        pathIds: ["path_base"],
      },
    }),
    jsonFence({
      kind: "simulation_edge",
      edge: {
        id: "edge_risk_inventory",
        type: "causal",
        source: "var_demand",
        target: "risk_inventory",
        label: "需求偏弱会放大库存风险",
        roundId: "round_2",
      },
    }),
    jsonFence({
      kind: "simulation_path",
      path: {
        id: "path_risk",
        label: "风险路径",
        status: "available",
        edgeIds: ["edge_risk_inventory"],
        summary: "需求不及预期，库存超预期累积。",
        roundId: "round_2",
      },
    }),
    jsonFence({
      kind: "simulation_summary",
      roundId: "round_1",
      markdown: "## 阶段结论\n\n- [path: path_base] 库存缓慢下降。",
      conclusionIds: ["path_base"],
    }),
    jsonFence({
      kind: "simulation_suggestion",
      suggestions: [
        {
          suggestionId: "suggestion_1",
          title: "调整需求假设重算",
          description: "将需求恢复速度改为偏弱，观察库存路径变化。",
          basedOnConclusionId: "path_base",
        },
      ],
    }),
    jsonFence({
      kind: "simulation_next_action",
      nextActions: [
        {
          actionId: "next_action_1",
          title: "补充需求数据",
          description: "补充需求侧数据后重新推理库存和利润路径。",
          actionType: "add_data",
          targetId: "var_demand",
          basedOnConclusionId: "path_base",
        },
      ],
    }),
  ].join("\n\n");

  const scenario =
    requirementsParts.extractSimulationScenarioPartFromAssistantMarkdown({
      assistantMarkdown: `${scenarioBlock}\n\n${followupBlocks}`,
    });
  assert(scenario?.part.kind === "simulation_scenario", "scenario part missing");
  assert(
    scenario.part.scenario.paths[0]?.id === "path_base",
    "scenario path not parsed",
  );
  const parsedDemandVariable = scenario.part.scenario.variables.find(
    (node) => node.id === "var_demand",
  );
  assert(
    parsedDemandVariable?.data?.confidence === 0.72 &&
      parsedDemandVariable.data.rationale ===
        "需求恢复速度决定库存去化与炼厂利润的下游分叉。" &&
      Array.isArray(parsedDemandVariable.data.upstreamNodeIds) &&
      parsedDemandVariable.data.upstreamNodeIds.includes("entity_opec") &&
      typeof parsedDemandVariable.data.worldModel === "object",
    "simulation worldModel metadata should be mirrored and preserved on parse",
  );
  const preservedUpstreamScenario =
    contracts.mergeSimulationScenarioPreservingUpstream(
      scenario.part.scenario,
      {
        topic: scenario.part.scenario.topic,
        entities: [],
        variables: [
          {
            id: "var_new",
            type: "variable",
            label: "新增变量",
            roundId: "round_1",
            status: "draft",
          },
        ],
        paths: [],
        edges: [],
      },
    );
  assert(
    preservedUpstreamScenario.prompt?.id === scenario.part.scenario.prompt?.id &&
      preservedUpstreamScenario.entities.some((node) => node.id === "entity_opec") &&
      preservedUpstreamScenario.variables.some((node) => node.id === "var_new"),
    "simulation scenario merge should preserve upstream while adding deltas",
  );

  const followups =
    requirementsParts.extractSimulationFollowupPartsFromAssistantMarkdown({
      assistantMarkdown: scenario.cleanedMarkdown,
    });
  assert(followups?.parts.length === 3, "followup parts missing");
  assert(
    followups.parts.map((part) => part.kind).join(",") ===
      "simulation_summary,simulation_suggestion,simulation_next_action",
    "followup kind order changed",
  );
  const nextActionPart = followups.parts.find(
    (part) => part.kind === "simulation_next_action",
  );
  assert(
    nextActionPart?.nextActions?.[0]?.actionType === "add_data" &&
      nextActionPart.nextActions[0].targetId === "var_demand",
    "simulation next action not parsed",
  );
  const deltas =
    requirementsParts.extractSimulationDeltaPartsFromAssistantMarkdown({
      assistantMarkdown: scenario.cleanedMarkdown,
    });
  assert(deltas?.parts.length === 3, "simulation delta parts missing");
  assert(
    deltas.parts.map((part) => part.kind).join(",") ===
      "simulation_node,simulation_edge,simulation_path",
    "simulation delta kind order changed",
  );
  let reducerState = reducer.reduceAppendPart(
    reducer.initAssistantPartsState(),
    scenario.part,
  );
  for (const part of deltas.parts) {
    reducerState = reducer.reduceAppendPart(reducerState, part);
  }
  const mergedScenario = reducerState.parts.find(
    (part: { kind?: string }) => part.kind === "simulation_scenario",
  ) as typeof scenario.part | undefined;
  assert(
    mergedScenario?.scenario.nodes?.some(
      (node) => node.id === "risk_inventory",
    ),
    "simulation node delta not merged into scenario nodes",
  );
  assert(
    !mergedScenario?.scenario.entities.some(
      (node) => node.id === "risk_inventory",
    ),
    "non-entity simulation node delta should not be merged into entities",
  );
  assert(
    mergedScenario?.scenario.edges.some(
      (edge) => edge.id === "edge_risk_inventory",
    ),
    "simulation edge delta not merged into scenario",
  );
  assert(
    mergedScenario?.scenario.paths.some((path) => path.id === "path_risk"),
    "simulation path delta not merged into scenario",
  );
  assert(
    reducerState.parts.filter(
      (part: { kind?: string }) =>
        part.kind === "simulation_node" ||
        part.kind === "simulation_edge" ||
        part.kind === "simulation_path",
    ).length === 0,
    "simulation deltas should not render as standalone parts after merge",
  );
  const mockFirstTurn = mockAiUiFlow.buildMockAiUiFlow({
    moduleId: "simulation",
    lastUserText: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
  });
  assert(
    mockFirstTurn === null,
    "simulation mock first turn should be disabled",
  );
  const mockContinuation = mockAiUiFlow.buildMockAiUiFlow({
    moduleId: "simulation",
    lastUserText:
      "我补充的信息如下，请继续完成刚才的任务：\n时间范围：未来三个月\n关键主体：OPEC+、炼厂\n关键变量：供应变化、需求恢复、库存变化",
  });
  assert(
    mockContinuation === null,
    "simulation mock continuation should be disabled",
  );
  let analysisProgressState = reducer.initAssistantPartsState();
  analysisProgressState = reducer.reduceToolProgress(analysisProgressState, {
    tool: "simulation_topic_analysis",
    status: "pending",
    message: "等待生成问题定义确认卡片",
    callId: "simulation_topic_analysis:prepare_confirmation",
  });
  analysisProgressState = reducer.reduceToolProgress(analysisProgressState, {
    tool: "simulation_topic_analysis",
    status: "success",
    message: "已生成问题定义确认卡片，等待用户确认",
    callId: "simulation_topic_analysis:prepare_confirmation",
  });
  const analysisToolParts = analysisProgressState.parts.filter(
    (part: { kind?: string; tool?: string }) =>
      part.kind === "tool" && part.tool === "simulation_topic_analysis",
  ) as Array<{ status?: string }>;
  assert(
    analysisToolParts.length === 1 &&
      analysisToolParts[0]?.status === "success",
    "simulation topic analysis progress should update by callId without duplicate nodes",
  );
  const pendingFallbackScenarioPart =
    scenarioFallback.buildSimulationScenarioFallback({
      userText: "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
      assistantText: "自然语言推演结果",
      roundId: "round_1",
    });
  const fallbackScenarioPart =
    scenarioFallback.buildSimulationScenarioFallback({
      userText: [
        "请基于这个问题定义节点继续推演：",
        "Topic ID：topic_definition",
        "Topic：OPEC+ 减产影响推演",
        "操作：确认",
        "问题：推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
        "推演目标：分析油价、库存和炼厂利润影响",
        "时间范围：未来三个月",
        "空间范围：全球原油市场",
        "行业：能源",
      ].join("\n"),
      assistantText: "自然语言推演结果",
      roundId: "round_1",
    });
  const entryQuestions = runManager.buildSimulationEntryQuestions(
    "推演 OPEC+ 延长减产对未来三个月油价、库存和炼厂利润的影响",
  );
  assert(
    entryQuestions.map((question) => question.id).join(",") ===
      "topic,goal,time_range,spatial_range,industry,key_variables,default_assumptions",
    "simulation entry fallback questions changed",
  );
  const naturalLanguageEntryDecision =
    simulationEntryState.resolveSimulationEntryDecision({
      req: {
        moduleId: "simulation",
        processSkill: "skill-simulation-base",
      } as never,
      runId: "smoke-run",
      initialUserText:
        "把当前项目拆成最可能、风险、反事实三条路径，并给出每条路径的关键触发条件",
      requirementsCardEmitted: false,
    });
  assert(
    naturalLanguageEntryDecision.action === "emit_boundary_fallback" &&
      naturalLanguageEntryDecision.shouldBlockWorldModel &&
      naturalLanguageEntryDecision.part.kind === "simulation_requirements",
    "initial simulation entry should fallback to a boundary requirements card",
  );
  const emittedCardEntryDecision =
    simulationEntryState.resolveSimulationEntryDecision({
      req: {
        moduleId: "simulation",
        processSkill: "skill-simulation-base",
      } as never,
      runId: "smoke-run",
      initialUserText:
        "把当前项目拆成最可能、风险、反事实三条路径，并给出每条路径的关键触发条件",
      requirementsCardEmitted: true,
    });
  assert(
    emittedCardEntryDecision.action === "wait_for_boundary_confirmation" &&
      emittedCardEntryDecision.shouldBlockWorldModel,
    "initial simulation entry should block world model after requirements card",
  );
  const confirmedEntryDecision =
    simulationEntryState.resolveSimulationEntryDecision({
      req: {
        moduleId: "simulation",
        processSkill: "skill-simulation-base",
      } as never,
      runId: "smoke-run",
      initialUserText: [
        "请基于这个问题定义节点继续推演：",
        "Topic ID：topic_definition",
        "操作：确认",
      ].join("\n"),
      requirementsCardEmitted: false,
    });
  assert(
    confirmedEntryDecision.action === "allow" &&
      !confirmedEntryDecision.shouldBlockWorldModel,
    "confirmed simulation topic should allow world model generation",
  );
  assert(
    pendingFallbackScenarioPart.kind === "simulation_scenario",
    "simulation pending fallback scenario kind mismatch",
  );
  assert(
    pendingFallbackScenarioPart.scenario.provenance?.source === "fallback" &&
      pendingFallbackScenarioPart.scenario.provenance?.label === "问题层临时沙盘",
    "simulation pending fallback should be a question-layer fallback",
  );
  assert(
    pendingFallbackScenarioPart.scenario.paths.length === 0 &&
      pendingFallbackScenarioPart.scenario.variables.length === 0 &&
      pendingFallbackScenarioPart.scenario.entities.length === 0,
    "simulation pending fallback should wait for topic confirmation",
  );
  assert(
    typeof pendingFallbackScenarioPart.scenario.topic !== "string" &&
      pendingFallbackScenarioPart.scenario.topic.data?.state ===
        "waiting_boundary_confirmation",
    "simulation pending fallback topic should wait for boundary confirmation",
  );
  assert(
    fallbackScenarioPart.kind === "simulation_scenario",
    "simulation confirmed fallback scenario kind mismatch",
  );
  assert(
    fallbackScenarioPart.scenario.provenance?.source === "fallback",
    "simulation confirmed fallback scenario should be marked as fallback",
  );
  assert(
    fallbackScenarioPart.scenario.paths.length === 0 &&
      fallbackScenarioPart.scenario.variables.length === 0 &&
      fallbackScenarioPart.scenario.entities.length === 0,
    "simulation confirmed fallback should keep a minimal shell before world-model wave",
  );
  assert(
    fallbackScenarioPart.scenario.stageState?.current === "entity" &&
      fallbackScenarioPart.scenario.stageState?.waveId === "wave_1_skeleton" &&
      fallbackScenarioPart.scenario.stageState.completed.includes("question"),
    "simulation confirmed fallback should advance to the entity wave checkpoint",
  );
  assert(
    fallbackScenarioPart.scenario.edges.length === 1 &&
      fallbackScenarioPart.scenario.edges[0]?.source === "prompt_root" &&
      fallbackScenarioPart.scenario.edges[0]?.target === "topic_definition",
    "simulation fallback should only preserve the prompt-to-topic upstream edge",
  );
  const fallbackTopic =
    typeof fallbackScenarioPart.scenario.topic === "string"
      ? null
      : fallbackScenarioPart.scenario.topic;
  assert(
    fallbackTopic?.data?.confidence === 0.5 &&
      Array.isArray(fallbackTopic.data.upstreamNodeIds) &&
      fallbackTopic.data.upstreamNodeIds.includes("prompt_root"),
    "simulation fallback topic should mirror worldModel metadata for immediate UI use",
  );
  const fallbackNodeTypes = new Set([
    fallbackScenarioPart.scenario.prompt?.type,
    typeof fallbackScenarioPart.scenario.topic === "string"
      ? undefined
      : fallbackScenarioPart.scenario.topic.type,
    ...(fallbackScenarioPart.scenario.nodes ?? []).map((node) => node.type),
    ...fallbackScenarioPart.scenario.entities.map((node) => node.type),
    ...fallbackScenarioPart.scenario.variables.map((node) => node.type),
  ].filter(Boolean));
  for (const type of ["prompt", "topic"]) {
    assert(
      fallbackNodeTypes.has(type),
      `simulation fallback should preserve ${type} nodes`,
    );
  }

  const roundOneSnapshotNodes = [
    {
      id: "prompt_root",
      type: "prompt",
      label: "用户原问题",
      detail: "推演 OPEC+ 减产影响",
      roundId: "round_1",
      status: "confirmed",
      locked: true,
      data: { rawText: "推演 OPEC+ 减产影响" },
    },
    {
      id: "topic_definition",
      type: "topic",
      label: "OPEC+ 减产影响推演",
      detail: "问题：OPEC+ 减产影响推演",
      roundId: "round_1",
      status: "confirmed",
      locked: true,
    },
    ...smokeSnapshotNodes(scenario.part.scenario, "round_1").filter(
      (node) => node.type !== "topic",
    ),
  ];
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-session",
    snapshot: {
      roundId: "round_1",
      promptNodeId: "prompt_root",
      topicNodeId: "topic_definition",
      nodes: roundOneSnapshotNodes,
      edges: scenario.part.scenario.edges,
      paths: scenario.part.scenario.paths,
      selections: [],
      actions: [],
      createdAt: new Date().toISOString(),
    },
  });
  const rounds = await snapshotStore.listCanvasSnapshots("smoke-session");
  assert(rounds[0]?.roundId === "round_1", "round snapshot not listed");
  assert(rounds[0]?.label === "初始判断", "round snapshot label missing");
  const loaded = await snapshotStore.loadCanvasSnapshot({
    sessionId: "smoke-session",
    roundId: "round_1",
  });
  assert(loaded?.nodes.some((node) => node.id === "var_demand"), "snapshot node missing");
  const loadedDemandVariable = loaded?.nodes.find(
    (node) => node.id === "var_demand",
  );
  assert(
    loadedDemandVariable?.data?.confidence === 0.72 &&
      Array.isArray(loadedDemandVariable.data.upstreamNodeIds) &&
      loadedDemandVariable.data.upstreamNodeIds.includes("entity_opec"),
    "snapshot load should preserve mirrored worldModel metadata",
  );
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-worldmodel-normalize",
    snapshot: {
      roundId: "round_1",
      nodes: [
        {
          id: "topic_definition",
          type: "topic",
          label: "旧快照问题",
          roundId: "round_1",
          data: {
            worldModel: {
              confidence: 0.61,
              rationale: "旧快照仅含嵌套 worldModel。",
              upstreamNodeIds: ["prompt_root"],
            },
          },
        },
      ],
      edges: [],
      paths: [],
      selections: [],
      actions: [],
      createdAt: new Date().toISOString(),
    },
  });
  const normalizedLegacySnapshot = await snapshotStore.loadCanvasSnapshot({
    sessionId: "smoke-worldmodel-normalize",
    roundId: "round_1",
  });
  assert(
    normalizedLegacySnapshot?.nodes[0]?.data?.confidence === 0.61 &&
      normalizedLegacySnapshot.nodes[0].data.rationale ===
        "旧快照仅含嵌套 worldModel。",
    "snapshot normalize should mirror legacy nested worldModel metadata",
  );
  const digest = simulationDigest.buildCanvasDigest({
    snapshot: loaded,
    topic: "OPEC+ 减产影响推演",
  });
  assert(
    digest?.includes("节点索引：") &&
      digest.includes("var_demand=需求恢复速度") &&
      digest.includes("声明依赖：var_demand<-entity_opec") &&
      digest.includes("关系索引：edge_1:var_demand->path_base") &&
      digest.includes("路径索引：path_base=最可能路径"),
    "canvas digest should expose stable node/edge/path/dependency indexes",
  );
  const nodeActionFallbackScenarioPart =
    scenarioFallback.buildSimulationScenarioFallback({
      userText: [
        "我补充的信息如下，请继续完成刚才的任务：",
        "Entity ID：entity_opec",
        "Entity：OPEC+",
        "操作：补变量",
      ].join("\n"),
      assistantText: "",
      roundId: "round_1",
    });
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-session",
    snapshot: {
      roundId: "round_1",
      promptNodeId: nodeActionFallbackScenarioPart.scenario.prompt?.id,
      topicNodeId:
        typeof nodeActionFallbackScenarioPart.scenario.topic === "string"
          ? undefined
          : nodeActionFallbackScenarioPart.scenario.topic.id,
      nodes: smokeSnapshotNodes(
        nodeActionFallbackScenarioPart.scenario,
        "round_1",
      ),
      edges: nodeActionFallbackScenarioPart.scenario.edges,
      scenarios: nodeActionFallbackScenarioPart.scenario.scenarios,
      paths: nodeActionFallbackScenarioPart.scenario.paths,
      selections: [],
      actions: [
        {
          id: "action_node_fallback",
          type: "node_intervention",
          targetId: "entity_opec",
          roundId: "round_1",
          createdAt: new Date().toISOString(),
        },
      ],
      interventions: [
        {
          id: "intervention_node_fallback",
          kind: "entity_update",
          sourceNodeId: "entity_opec",
          sourceNodeType: "entity",
          roundId: "round_1",
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
        },
      ],
      stageState: nodeActionFallbackScenarioPart.scenario.stageState,
      provenance: nodeActionFallbackScenarioPart.scenario.provenance,
      createdAt: new Date().toISOString(),
    },
  });
  const preservedAfterNodeFallback = await snapshotStore.loadCanvasSnapshot({
    sessionId: "smoke-session",
    roundId: "round_1",
  });
  assert(
    preservedAfterNodeFallback?.nodes.some((node) => node.id === "entity_opec") &&
      preservedAfterNodeFallback.nodes.some((node) => node.id === "var_demand"),
    "node-action fallback must not replace the existing world model snapshot",
  );
  assert(
    preservedAfterNodeFallback?.nodes.find((node) => node.id === "topic_definition")
      ?.label === "OPEC+ 减产影响推演",
    "node-action fallback must not rewrite the confirmed topic node",
  );
  assert(
    preservedAfterNodeFallback?.actions.some(
      (action) => action.id === "action_node_fallback",
    ),
    "node-action fallback should still append action trace",
  );
  assert(
    /\[(path|node):\s*[^\]\s]+\]/.test(
      (followups.parts[0] as { markdown?: string }).markdown ?? "",
    ),
    "report trace token convention missing",
  );
  const reportDir = await mkdtemp(join(tmpdir(), "xiaochuang-simulation-report-"));
  const report = await reportFallback.ensureSimulationReportFallback({
    cwd: reportDir,
    scenario: fallbackScenarioPart.scenario,
    snapshot: {
      roundId: "round_2",
      nodes: smokeSnapshotNodes(fallbackScenarioPart.scenario, "round_2"),
      edges: fallbackScenarioPart.scenario.edges,
      scenarios: fallbackScenarioPart.scenario.scenarios,
      paths: fallbackScenarioPart.scenario.paths,
      selections: [
        {
          id: "selection_path_smoke",
          type: "path",
          targetId: "path_risk",
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "selection_variable_smoke",
          type: "variable",
          targetId: "var_demand",
          value: "偏弱",
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "selection_scenario_smoke",
          type: "scenario",
          targetId: "counterfactual",
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
      ],
      actions: [
        {
          id: "action_path_smoke",
          type: "path_deepen",
          targetId: "path_risk",
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "action_variable_smoke",
          type: "variable_resimulate",
          targetId: "var_demand",
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
        {
          id: "action_report_smoke",
          type: "node_intervention",
          targetId: "simulation_deliverables_smoke",
          payload: {
            interventionKind: "report_update",
            sourceNodeType: "report",
          },
          roundId: "round_2",
          createdAt: new Date().toISOString(),
        },
      ],
      interventions: [
        {
          id: "intervention_variable_smoke",
          kind: "variable_override",
          sourceNodeId: "var_demand_response",
          sourceNodeType: "variable",
          roundId: "round_2",
          payload: { nextValue: "偏弱" },
          impactPreview: {
            affectedNodeIds: [],
            affectedEdgeIds: [],
            affectedPathIds: [],
            affectedScenarioIds: [],
            affectedNodeLabels: ["风险结论", "关键不确定性"],
            affectedPathLabels: ["风险路径"],
            affectedScenarioLabels: ["Pessimistic"],
            reason: "smoke",
          },
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
        },
        {
          id: "intervention_report_smoke",
          kind: "report_update",
          sourceNodeId: "simulation_deliverables_smoke",
          sourceNodeType: "report",
          roundId: "round_2",
          payload: { operation: "更新" },
          impactPreview: {
            affectedNodeIds: ["risk_demand"],
            affectedEdgeIds: ["edge_risk_decision"],
            affectedPathIds: ["path_risk"],
            affectedScenarioIds: ["risk"],
            reason: "id_only_smoke",
          },
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    },
  });
  assert(
    report?.relativePaths[0] === "simulation-report.md",
    "simulation report fallback should write markdown deliverable",
  );
  const reportMarkdown = await readFile(
    join(reportDir, "simulation-report.md"),
    "utf8",
  );
  assert(
    reportMarkdown.includes("[path: path_base]") &&
      reportMarkdown.includes("[node: var_demand]"),
    "simulation report fallback missing trace tokens",
  );
  assert(
    reportMarkdown.includes("已选择路径：[path: path_risk]") &&
      reportMarkdown.includes("已选择情景：[scenario: counterfactual]") &&
      reportMarkdown.includes("已调整变量：[node: var_demand]") &&
      reportMarkdown.includes("本轮动作：基于 [node: var_demand] 的新假设重算路径") &&
      reportMarkdown.includes(
        "本轮动作：report_update 作用于 [report: simulation_deliverables_smoke]",
      ),
    "simulation report fallback missing action trace lines",
  );
  assert(
    reportMarkdown.includes("干预：variable_override → [node: var_demand_response]") &&
      reportMarkdown.includes("干预：report_update → [report: simulation_deliverables_smoke]") &&
      reportMarkdown.includes("影响节点：风险结论、关键不确定性") &&
      reportMarkdown.includes("影响路径：风险路径") &&
      reportMarkdown.includes("影响情景：Pessimistic") &&
      reportMarkdown.includes("影响节点：risk_demand") &&
      reportMarkdown.includes("影响边：edge_risk_decision") &&
      reportMarkdown.includes("影响路径：path_risk") &&
      reportMarkdown.includes("影响情景：risk"),
    "simulation report fallback missing intervention trace lines",
  );
  assert(
    reportMarkdown.includes("## 推理链与干预节点") &&
      reportMarkdown.includes("当前报告未检测到推理、证据、风险、决策或行动节点。"),
    "simulation report fallback should not invent reasoning graph nodes",
  );
  await reportFallback.ensureSimulationReportFallback({
    cwd: reportDir,
    scenario: fallbackScenarioPart.scenario,
    snapshot: {
      roundId: "round_3",
      nodes: smokeSnapshotNodes(fallbackScenarioPart.scenario, "round_3"),
      edges: fallbackScenarioPart.scenario.edges,
      paths: fallbackScenarioPart.scenario.paths,
      selections: [
        {
          id: "selection_variable_smoke_updated",
          type: "variable",
          targetId: "var_demand",
          value: "偏强",
          roundId: "round_3",
          createdAt: new Date().toISOString(),
        },
      ],
      actions: [
        {
          id: "action_variable_smoke_updated",
          type: "variable_resimulate",
          targetId: "var_demand",
          roundId: "round_3",
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    },
  });
  const updatedReportMarkdown = await readFile(
    join(reportDir, "simulation-report.md"),
    "utf8",
  );
  assert(
    updatedReportMarkdown.includes("偏强"),
    "simulation fallback report should refresh fallback-owned report",
  );
  await rm(reportDir, { recursive: true, force: true });

  const pathTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我选择这条推演路径继续深挖：\n路径 ID：path_risk\n路径名称：风险路径",
    roundId: "round_2",
  });
  assert(
    pathTrace.selections[0]?.type === "path" &&
      pathTrace.selections[0].targetId === "path_risk" &&
      pathTrace.actions[0]?.type === "path_deepen" &&
      pathTrace.interventions[0]?.kind === "path_continue" &&
      pathTrace.interventions[0]?.pathId === "path_risk",
    "simulation path action trace missing",
  );
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-session",
    snapshot: {
      roundId: "round_2",
      nodes: smokeSnapshotNodes(scenario.part.scenario, "round_2"),
      edges: scenario.part.scenario.edges,
      paths: scenario.part.scenario.paths,
      selections: pathTrace.selections,
      actions: pathTrace.actions,
      interventions: pathTrace.interventions,
      createdAt: new Date().toISOString(),
    },
  });
  const loadedPathRound = await snapshotStore.loadCanvasSnapshot({
    sessionId: "smoke-session",
    roundId: "round_2",
  });
  assert(
    loadedPathRound?.interventions?.[0]?.kind === "path_continue",
    "path round snapshot should persist interventions",
  );
  const labeledRounds = await snapshotStore.listCanvasSnapshots("smoke-session");
  assert(
    labeledRounds.some(
      (round: { roundId: string; label?: string }) =>
        round.roundId === "round_2" && round.label === "深挖路径",
    ),
    "path round label missing",
  );
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-label-session",
    snapshot: {
      roundId: "round_3",
      nodes: smokeSnapshotNodes(fallbackScenarioPart.scenario, "round_3"),
      edges: fallbackScenarioPart.scenario.edges,
      scenarios: fallbackScenarioPart.scenario.scenarios,
      paths: fallbackScenarioPart.scenario.paths,
      selections: [
        {
          id: "selection_counterfactual_label_smoke",
          type: "scenario",
          targetId: "counterfactual",
          roundId: "round_3",
          createdAt: new Date().toISOString(),
        },
      ],
      actions: [],
      interventions: [
        {
          id: "intervention_counterfactual_label_smoke",
          kind: "scenario_counterfactual",
          sourceNodeId: "counterfactual",
          sourceNodeType: "scenario",
          scenarioId: "counterfactual",
          roundId: "round_3",
          payload: { source: "smoke" },
          impactPreview: {
            affectedNodeIds: [],
            affectedEdgeIds: [],
            affectedPathIds: ["path_counterfactual"],
            affectedScenarioIds: ["counterfactual"],
          },
          requiresConfirmation: true,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    },
  });
  await snapshotStore.saveCanvasSnapshot({
    sessionId: "smoke-label-session",
    snapshot: {
      roundId: "round_4",
      nodes: smokeSnapshotNodes(fallbackScenarioPart.scenario, "round_4"),
      edges: fallbackScenarioPart.scenario.edges,
      paths: fallbackScenarioPart.scenario.paths,
      selections: [],
      actions: [
        {
          id: "action_report_label_smoke",
          type: "node_intervention",
          targetId: "simulation_deliverables_smoke",
          payload: {
            interventionKind: "report_update",
            sourceNodeType: "report",
          },
          roundId: "round_4",
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    },
  });
  const interventionLabeledRounds = await snapshotStore.listCanvasSnapshots(
    "smoke-label-session",
  );
  assert(
    interventionLabeledRounds.some(
      (round: { roundId: string; label?: string }) =>
        round.roundId === "round_3" && round.label === "生成反事实",
    ),
    "scenario intervention round label missing",
  );
  assert(
    interventionLabeledRounds.some(
      (round: { roundId: string; label?: string }) =>
        round.roundId === "round_4" && round.label === "更新报告",
    ),
    "node intervention action round label missing",
  );
  const variableTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "请基于变量调整生成新一轮推演：\n变量 ID：var_demand\n变量名称：需求恢复速度\n新假设：偏弱\n预计影响节点：库存缓慢下降、利润继续承压\n预计影响边：推动库存去化\n预计影响路径：最可能路径、风险路径\n预计影响情景：Baseline、Risk",
    roundId: "round_3",
  });
  assert(
      variableTrace.selections[0]?.type === "variable" &&
      variableTrace.selections[0].targetId === "var_demand" &&
      variableTrace.selections[0].value === "偏弱" &&
      variableTrace.actions[0]?.type === "variable_resimulate" &&
      variableTrace.interventions[0]?.kind === "variable_override" &&
      variableTrace.interventions[0]?.sourceNodeId === "var_demand" &&
      variableTrace.interventions[0]?.impactPreview?.affectedNodeLabels?.includes(
        "库存缓慢下降",
      ) &&
      variableTrace.interventions[0]?.impactPreview?.affectedScenarioLabels?.includes(
        "Risk",
      ),
    "simulation variable action trace missing",
  );
  const bindingTrace = simulationActions.inferSimulationActionTrace({
    userText: "文案可以变化，但 binding 应保留变量意图",
    roundId: "round_4",
    binding: {
      scope: "variable",
      targetId: "var_supply",
      variableOverrides: { var_supply: "偏强" },
    },
  });
  assert(
    bindingTrace.selections[0]?.type === "variable" &&
      bindingTrace.selections[0].targetId === "var_supply" &&
      bindingTrace.selections[0].value === "偏强" &&
      bindingTrace.interventions[0]?.kind === "variable_override" &&
      bindingTrace.interventions[0]?.sourceNodeId === "var_supply",
    "simulation binding action trace missing",
  );
  const nodeBindingTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "节点名称：需求不及预期\n预计影响节点：是否调整采购节奏\n预计影响边：触发采购决策",
    roundId: "round_node_binding",
    binding: {
      scope: "node",
      targetId: "risk_demand",
    },
  });
  assert(
    nodeBindingTrace.actions[0]?.type === "node_intervention" &&
      nodeBindingTrace.interventions[0]?.kind === "node_expand" &&
      nodeBindingTrace.interventions[0]?.sourceNodeType === "risk" &&
      nodeBindingTrace.interventions[0]?.sourceNodeId === "risk_demand" &&
      nodeBindingTrace.interventions[0]?.impactPreview?.affectedEdgeLabels?.includes(
        "触发采购决策",
      ),
    "simulation node binding trace missing intervention",
  );
  const counterfactualBindingTrace = simulationActions.inferSimulationActionTrace({
    userText: "请生成反事实路径",
    roundId: "round_counterfactual_binding",
    binding: {
      scope: "counterfactual",
      targetId: "risk",
    },
  });
  assert(
    counterfactualBindingTrace.selections[0]?.type === "scenario" &&
      counterfactualBindingTrace.selections[0].targetId === "risk" &&
      counterfactualBindingTrace.interventions[0]?.kind === "scenario_counterfactual" &&
      counterfactualBindingTrace.interventions[0]?.sourceNodeType === "scenario",
    "simulation counterfactual binding trace missing intervention",
  );
  const resimulateBindingTrace = simulationActions.inferSimulationActionTrace({
    userText: "请基于当前情景重新推演",
    roundId: "round_resimulate_binding",
    binding: {
      scope: "resimulate",
      targetId: "baseline",
    },
  });
  assert(
    resimulateBindingTrace.selections[0]?.type === "scenario" &&
      resimulateBindingTrace.selections[0].targetId === "baseline" &&
      resimulateBindingTrace.interventions[0]?.kind === "scenario_continue" &&
      resimulateBindingTrace.interventions[0]?.payload?.scope === "resimulate",
    "simulation resimulate binding trace missing intervention",
  );
  const entryTrace = simulationActions.inferSimulationActionTrace({
    userText: "推演主题：OPEC+ 减产影响推演\n关键变量：需求恢复速度",
    roundId: "round_1",
  });
  assert(
    entryTrace.selections[0]?.type === "entry" &&
      entryTrace.actions[0]?.type === "entry_confirm" &&
      entryTrace.interventions[0]?.kind === "topic_confirm" &&
      entryTrace.interventions[0]?.sourceNodeType === "topic",
    "simulation entry action trace missing intervention",
  );
  const nodeExpandTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请沿着这个节点继续展开下一层推演：\n节点 ID：var_demand\n节点类型：变量\n节点名称：需求恢复速度\n节点说明：影响库存和炼厂利润\n预计影响节点：库存缓慢下降、利润继续承压\n预计影响边：推动库存去化\n预计影响路径：最可能路径、风险路径\n预计影响情景：Baseline、Risk",
    roundId: "round_node_expand",
  });
  assert(
    nodeExpandTrace.actions[0]?.type === "node_intervention" &&
      nodeExpandTrace.interventions[0]?.kind === "node_expand" &&
      nodeExpandTrace.interventions[0]?.sourceNodeType === "variable" &&
      nodeExpandTrace.interventions[0]?.sourceNodeId === "var_demand" &&
      nodeExpandTrace.interventions[0]?.payload?.nodeName === "需求恢复速度" &&
      nodeExpandTrace.interventions[0]?.impactPreview?.affectedNodeLabels?.includes(
        "库存缓慢下降",
      ),
    "simulation generic node expand trace missing intervention",
  );
  const riskTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请基于这个风险节点生成新一轮推演：\nRisk ID：risk_demand\nRisk：需求不及预期\n操作：缓释\n预计影响节点：利润继续承压、是否调整采购节奏\n预计影响路径：风险路径\n预计影响情景：Risk",
    roundId: "round_5",
  });
  assert(
    riskTrace.selections.length === 0 &&
      riskTrace.actions[0]?.type === "node_intervention" &&
      riskTrace.interventions[0]?.kind === "risk_mitigate" &&
      riskTrace.interventions[0]?.sourceNodeType === "risk" &&
      riskTrace.interventions[0]?.sourceNodeId === "risk_demand" &&
      riskTrace.interventions[0]?.impactPreview?.affectedPathLabels?.includes(
        "风险路径",
      ),
    "simulation risk structured trace missing intervention",
  );
  const scenarioTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n我选择这个情景继续推演：\nScenario ID：risk\nScenario：Risk",
    roundId: "round_6",
  });
  assert(
    scenarioTrace.interventions[0]?.kind === "scenario_continue" &&
      scenarioTrace.interventions[0]?.sourceNodeType === "scenario" &&
      scenarioTrace.interventions[0]?.scenarioId === "risk",
    "simulation scenario structured trace missing intervention",
  );
  const scenarioCompareTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请对比这个情景与 Baseline：\nScenario ID：risk\nScenario：Risk",
    roundId: "round_7",
  });
  assert(
    scenarioCompareTrace.interventions[0]?.kind === "scenario_compare",
    "simulation scenario compare trace missing intervention",
  );
  const nextActionTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请执行这条推演下一步动作：\nAction ID：next_action_add_demand_data\n动作：补充需求数据\n类型：add_data",
    roundId: "round_8",
  });
  assert(
    nextActionTrace.interventions[0]?.kind === "next_action_execute" &&
      nextActionTrace.interventions[0]?.sourceNodeType === "next_action" &&
      nextActionTrace.interventions[0]?.sourceNodeId === "next_action_add_demand_data",
    "simulation next action structured trace missing intervention",
  );
  const summaryTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请基于这个推演总结继续：\nSummary ID：simulation_summary_smoke\nRound ID：round_1\n操作：报告\n关联结论：path_base、var_demand",
    roundId: "round_9",
  });
  assert(
    summaryTrace.actions[0]?.type === "node_intervention" &&
      summaryTrace.interventions[0]?.kind === "summary_continue" &&
      summaryTrace.interventions[0]?.sourceNodeType === "summary" &&
      summaryTrace.interventions[0]?.sourceNodeId === "simulation_summary_smoke",
    "simulation summary structured trace missing intervention",
  );
  const reportTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请基于这个推演报告继续：\nDeliverables ID：simulation_deliverables_smoke\nDeliverables Zone：summary\nReport：simulation-report-smoke.md\n操作：更新\n主文件：simulation-report-smoke.md\nWorkspace Project：sandbox-default",
    roundId: "round_10",
  });
  assert(
    reportTrace.interventions[0]?.kind === "report_update" &&
      reportTrace.interventions[0]?.sourceNodeType === "report" &&
      reportTrace.interventions[0]?.sourceNodeId === "simulation_deliverables_smoke" &&
      reportTrace.interventions[0]?.payload?.primaryPath ===
        "simulation-report-smoke.md",
    "simulation report structured trace missing intervention",
  );
  const historyTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请处理这个推演历史版本：\nHistory：当前轮次 round_2\nRound ID：round_2\n操作：从此继续\n本轮干预数：1\n最近干预：variable_override → node:var_demand",
    roundId: "round_11",
  });
  assert(
    historyTrace.interventions[0]?.kind === "history_restore" &&
      historyTrace.interventions[0]?.sourceNodeType === "history" &&
      historyTrace.interventions[0]?.sourceNodeId === "round_2",
    "simulation history structured trace missing intervention",
  );
  const recoveryTrace = simulationActions.inferSimulationActionTrace({
    userText:
      "我补充的信息如下，请继续完成刚才的任务：\n\n请处理这个推演恢复节点：\n主题：OPEC+ 延长减产\n操作：查看已保存内容\n错误：模拟路径总结生成中断\n错误代码：simulation_smoke_error\n已保存节点：18\n路径状态：3 路径",
    roundId: "round_12",
  });
  assert(
    recoveryTrace.interventions[0]?.kind === "recovery_retry" &&
      recoveryTrace.interventions[0]?.sourceNodeType === "recovery" &&
      recoveryTrace.interventions[0]?.sourceNodeId === "simulation_smoke_error" &&
      recoveryTrace.interventions[0]?.payload?.savedNodeCount === "18",
    "simulation recovery structured trace missing intervention",
  );

  await sessionRuntime.patchSessionRuntime("smoke-session", {
    simulationMeta: {
      topic: "OPEC+ 减产影响推演",
      currentRoundId: "round_1",
      roundIds: ["round_1"],
    },
  });
  const priorRuntime = await sessionRuntime.loadSessionRuntime("smoke-session");
  const acceptedMeta = await runManager.resolveSimulationRunMetaForAccepted({
    sessionId: "smoke-session",
    priorRuntime,
    topic: "继续深挖风险路径",
  });
  assert(
    acceptedMeta.currentRoundId === "round_2",
    "simulation accepted run should advance when prior snapshot exists",
  );
  assert(
    acceptedMeta.previousRoundId === "round_1",
    "simulation accepted run should preserve previous round",
  );
  assert(
    acceptedMeta.roundIds.join(",") === "round_1,round_2",
    "simulation accepted run should append round id",
  );
  await sessionRuntime.patchSessionRuntime("empty-session", {
    simulationMeta: {
      topic: "尚未生成沙盘",
      currentRoundId: "round_1",
      roundIds: ["round_1"],
    },
  });
  const emptyRuntime = await sessionRuntime.loadSessionRuntime("empty-session");
  const emptyAcceptedMeta = await runManager.resolveSimulationRunMetaForAccepted({
    sessionId: "empty-session",
    priorRuntime: emptyRuntime,
    topic: "补充入口条件",
  });
  assert(
    emptyAcceptedMeta.currentRoundId === "round_1",
    "simulation accepted run should keep round_1 before first snapshot",
  );
  await runManager.advanceSimulationRound("smoke-session");
  const runtime = await sessionRuntime.loadSessionRuntime("smoke-session");
  assert(
    runtime?.simulationMeta?.currentRoundId === "round_2",
    "simulation round did not advance",
  );
  assert(
    runtime.simulationMeta.previousRoundId === "round_1",
    "previous round not preserved",
  );

  await rm(dataDir, { recursive: true, force: true });
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "simulation_scenario_parse",
          "simulation_requirements_parse",
          "simulation_world_model_skill_injection",
          "simulation_world_model_metadata_normalize",
          "simulation_grammar_shortcut_guard",
          "simulation_preserve_upstream_merge",
          "simulation_delta_parse",
          "simulation_delta_reducer_merge",
          "simulation_mock_ai_ui_flow",
          "simulation_direct_canvas_entry",
          "simulation_scenario_fallback",
          "simulation_followup_parse",
          "round_snapshot_rw",
          "round_snapshot_world_model_normalize",
          "round_snapshot_labels",
          "canvas_digest_indexes",
          "report_trace_token",
          "simulation_report_fallback_file",
          "simulation_report_action_trace",
          "simulation_report_fallback_refresh",
          "simulation_action_trace",
          "simulation_node_expand_intervention_trace",
          "simulation_output_recovery_intervention_trace",
          "simulation_binding_scope_trace",
          "simulation_accepted_round_meta",
          "simulation_round_advance",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

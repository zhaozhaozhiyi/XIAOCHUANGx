import {
  normalizeSimulationNodeWorldModelData,
  type ChatPart,
  type SimulationStageState,
} from "@jlc/contracts";

type SimulationScenarioPart = Extract<ChatPart, { kind: "simulation_scenario" }>;
type SimulationScenario = SimulationScenarioPart["scenario"];

function safeTopic(userText: string, assistantText: string): string {
  const structuredText = [userText, assistantText]
    .join("\n")
    .match(/^(?:问题|原问题)：(.+)$/m)?.[1];
  const text = (structuredText || userText || assistantText || "未命名推演").trim();
  return text.replace(/\s+/g, " ").slice(0, 120) || "未命名推演";
}

function partId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isTopicConfirmationText(text: string): boolean {
  return (
    text.includes("操作：确认") ||
    text.includes("我确认这个问题定义") ||
    text.includes("确认这个问题定义") ||
    text.includes("确认边界并开始") ||
    text.includes("确认进入世界模型") ||
    text.includes("确认开始")
  );
}

export function buildSimulationScenarioFallback(input: {
  userText: string;
  assistantText: string;
  roundId: string;
}): SimulationScenarioPart {
  const topic = safeTopic(input.userText, input.assistantText);
  const roundId = input.roundId || "round_1";
  const topicConfirmed = isTopicConfirmationText(input.userText);
  const now = new Date().toISOString();
  const stageState: SimulationStageState = topicConfirmed
    ? {
        current: "entity",
        status: "awaiting_confirmation",
        completed: ["question"],
        awaitingConfirmation: true,
        waveId: "wave_1_skeleton",
        message: "问题边界已确认；下一步只生成主体/骨架 wave。",
      }
    : {
        current: "question",
        status: "awaiting_confirmation",
        completed: [],
        awaitingConfirmation: true,
        message: "请先确认问题边界；确认前不生成下游世界模型。",
      };
  const promptNode: NonNullable<SimulationScenario["prompt"]> = {
    id: "prompt_root",
    type: "prompt",
    label: "用户原问题",
    detail: input.userText || topic,
    roundId,
    stage: "question",
    status: "confirmed",
    locked: true,
    data: {
      rawText: input.userText || topic,
    },
  };
  const topicNode = normalizeSimulationNodeWorldModelData({
    id: "topic_definition",
    type: "topic",
    label: topic,
    detail: [
      `问题：${topic}`,
      "推演目标：待确认",
      "时间范围：待确认",
      "空间范围：待确认",
      "行业：待确认",
      topicConfirmed ? "状态：正在进入世界模型" : "状态：待确认问题边界",
    ].join("\n"),
    roundId,
    stage: "question",
    status: topicConfirmed ? "confirmed" : "active",
    locked: topicConfirmed,
    data: {
      problem: topic,
      state: topicConfirmed ? "modeling_world" : "waiting_boundary_confirmation",
      worldModel: {
        waveId: "wave_0_question",
        waveTitle: "问题边界",
        upstreamNodeIds: ["prompt_root"],
        rationale: "fallback 只固定问题层，等待后续 world-model wave 生成。",
        confidence: 0.5,
        analysisQuestion: "用户要推演的核心问题是什么？",
      },
    },
  } satisfies NonNullable<SimulationScenario["nodes"]>[number]);
  const scenario: SimulationScenario = {
    prompt: promptNode,
    topic: topicNode,
    topicDefinition: {
      problem: topic,
      state: topicConfirmed ? "modeling_world" : "waiting_boundary_confirmation",
    },
    provenance: {
      source: "fallback",
      label: topicConfirmed ? "建模入口临时沙盘" : "问题层临时沙盘",
      reason: "模型本轮未输出结构化沙盘，fallback 仅初始化可继续的最小 shell。",
      warning: topicConfirmed
        ? "世界模型内容需要按 skill-world-model 的 wave delta 继续生成。"
        : "确认问题定义前不会生成主体、变量、假设、风险或路径。",
      generatedAt: now,
    },
    entities: [],
    variables: [],
    assumptions: [
      topicConfirmed
        ? "等待下一轮生成主体/骨架 wave。"
        : "等待用户确认问题定义后再生成世界模型。",
    ],
    nodes: [],
    scenarios: [],
    paths: [],
    edges: [
      {
        id: "edge_prompt_topic",
        type: "temporal",
        source: "prompt_root",
        target: "topic_definition",
        label: "原问题被解析为待确认的问题定义",
        roundId,
      },
    ],
    stageState,
    roundId,
  };

  return {
    id: partId(topicConfirmed ? "simulation_scenario_shell" : "simulation_scenario"),
    kind: "simulation_scenario",
    zone: "summary",
    title: topicConfirmed ? "建模入口" : "问题层",
    scenario,
    streaming: false,
    completedAt: Date.now(),
  };
}

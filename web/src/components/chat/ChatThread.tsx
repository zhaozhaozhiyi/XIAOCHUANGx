"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatAgentModelPicker } from "./ChatAgentModelPicker";
import { ChatComposer } from "./ChatComposer";
import { ChatTurnList } from "./ChatTurnList";
import { ChatTopBar } from "./ChatTopBar";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import { SimulationStartCanvas } from "@/components/simulation/SimulationStartCanvas";
import {
  selectSimulationTopicAnalysisActivity,
  type SimulationTopicAnalysisActivity,
} from "@/lib/simulation-topic-analysis-activity";
import { ChatHomeTaskSuggestions } from "./ChatHomeTaskSuggestions";
import { PinnedTodoBar } from "./PinnedTodoBar";
import { useChatAgentSelection } from "./useChatAgentSelection";
import { buildChatScrollContentKey } from "@/lib/chat-scroll";
import { useChatScrollPin } from "./useChatScrollPin";
import { useChatSend } from "./useChatSend";
import { useSettings } from "@/components/settings/SettingsContext";
import { consumePendingSession } from "@/lib/chat";
import type { ActivityCollapse } from "@/lib/chat-parts";
import {
  applyRunRecordToMessage,
  loadSessionMessagesHybrid,
  saveSessionMessagesHybrid,
} from "@/lib/chat-session-sync";
import {
  latestTodoPartFromMessages,
  todoPartKey,
} from "@/lib/chat-timeline";
import {
  getChatSession,
  isSessionStarted,
  markSessionRead,
  PLATFORM_DEFAULT_GROUP_ID,
  setSessionRunStatus,
  upsertChatSession,
} from "@/lib/chat-history";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import {
  getResearchProject,
  getSessionProjectId,
  isPlatformDefaultProject,
  isUsingLocalProject,
  NO_PROJECT_ID,
  projectWorkLabel,
  setSessionProjectId,
} from "@/lib/research-projects";
import {
  MODULE_CHAT_SURFACES,
  readStoredModuleSkillTemplateId,
  type ChatSurfaceModuleId,
} from "@/lib/module-chat-config";
import type { ChatModeId } from "@/lib/navigation";
import { normalizeChatMode } from "@/lib/navigation";
import {
  fetchRunEvents,
  fetchRunRecord,
  fetchSimulationRounds,
  fetchSimulationSnapshot,
} from "@/lib/companion/runtime";
import { applyRunEventsToMessage } from "@/lib/chat-run-events";
import {
  selectAssistantDeliverablesPart,
  selectAssistantDisplayContent,
} from "@/lib/chat-message-selectors";
import { useChatSessionOptional } from "@/contexts/ChatSessionContext";
import { ChevronDown } from "lucide-react";
import type { ChatMessage } from "@/lib/chat";
import type {
  CanvasSnapshot,
  ChatPart,
  OutlineCommitPayload,
  RequirementsPart,
  SimulationNode,
} from "@/lib/chat-parts";
import type { ChatComposerSendPayload } from "@/components/chat/ChatComposer";
import { selectionToApiConfig } from "@/lib/byok/model-providers";
import { getChatHomeSuggestions } from "@/lib/chat-home-suggestions";
import { mergeSimulationDeltasIntoScenarioPreservingUpstream } from "@jlc/contracts";

function normalizeThreadProjectId(projectId?: string | null): string {
  if (!projectId || projectId === PLATFORM_DEFAULT_GROUP_ID) return NO_PROJECT_ID;
  return projectId;
}

function resolveThreadProjectId(sessionId: string): string {
  const persistedProjectId = normalizeThreadProjectId(getSessionProjectId(sessionId));
  if (persistedProjectId !== NO_PROJECT_ID) return persistedProjectId;
  return normalizeThreadProjectId(getChatSession(sessionId)?.projectId);
}

function simulationRoundLabel(roundId: string, label?: string): string {
  if (label) return label;
  const match = /round_(\d+)/.exec(roundId);
  if (match?.[1] === "1") return "初始判断";
  if (match?.[1]) return `第 ${match[1]} 轮推演`;
  return roundId;
}

type SimulationScenarioPart = Extract<ChatPart, { kind: "simulation_scenario" }>;
type SimulationScenario = SimulationScenarioPart["scenario"];
type SimulationNodePart = Extract<ChatPart, { kind: "simulation_node" }>;
type SimulationEdgePart = Extract<ChatPart, { kind: "simulation_edge" }>;
type SimulationPathPart = Extract<ChatPart, { kind: "simulation_path" }>;
type SimulationDeltaPart =
  | SimulationNodePart
  | SimulationEdgePart
  | SimulationPathPart;
type SimulationRequirementsPart = RequirementsPart & {
  kind: "simulation_requirements";
};
type SimulationRequirementSummaryPart = Extract<
  ChatPart,
  { kind: "simulation_requirement_summary" }
>;
type SimulationSummaryPart = Extract<ChatPart, { kind: "simulation_summary" }>;
type SimulationSuggestionPart = Extract<
  ChatPart,
  { kind: "simulation_suggestion" | "simulation_next_action" }
>;
type SimulationErrorPart = Extract<ChatPart, { kind: "error" }>;
type SimulationDeliverablesPart = Extract<ChatPart, { kind: "deliverables" }>;

type SimulationPendingSignal = {
  status: string;
  detail?: string;
};

type SimulationAnalysisStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error";
  detail?: string;
};

function simulationTopicText(topic: SimulationScenario["topic"]): string {
  if (typeof topic === "string") return topic;
  const problem = topic.data?.problem;
  return typeof problem === "string" && problem.trim()
    ? problem
    : topic.label || "未命名推演";
}

function firstSimulationUserText(messages: ChatMessage[]): string {
  const message = messages.find(
    (item) => item.role === "user" && item.content.trim(),
  );
  return message ? normalizeSimulationText(message.content, 180) : "新建推演";
}

function hasConfirmedSimulationTopic(messages: ChatMessage[]): boolean {
  return messages.some((message) => {
    if (
      message.role === "assistant" &&
      message.parts?.some(
        (part) =>
          part.kind === "simulation_requirement_summary" ||
          (part.kind === "simulation_requirements" && part.submitted),
      )
    ) {
      return true;
    }
    if (message.role !== "user") return false;
    const content = message.content;
    return (
      content.includes("操作：确认") ||
      content.includes("我确认这个问题定义") ||
      content.includes("用户已确认该问题定义") ||
      content.includes("确认这个问题定义") ||
      content.includes("确认边界并开始") ||
      content.includes("确认进入世界模型") ||
      content.includes("确认开始")
    );
  });
}

function confirmedTopicState(state: unknown): string {
  return state === "understanding" ||
    state === "waiting_boundary_confirmation" ||
    typeof state !== "string" ||
    !state.trim()
    ? "modeling_world"
    : state;
}

function scenarioRoundId(scenario: SimulationScenario): string {
  return (
    scenario.roundId ??
    scenario.prompt?.roundId ??
    (typeof scenario.topic === "string" ? undefined : scenario.topic.roundId) ??
    scenario.entities[0]?.roundId ??
    scenario.variables[0]?.roundId ??
    scenario.nodes?.[0]?.roundId ??
    "round_1"
  );
}

function mergeSimulationDeltasIntoScenario(
  scenario: SimulationScenario,
  deltas: SimulationDeltaPart[],
): SimulationScenario {
  return mergeSimulationDeltasIntoScenarioPreservingUpstream(scenario, deltas);
}

function hydrateSimulationQuestionLayer(
  part: SimulationScenarioPart,
  messages: ChatMessage[],
): SimulationScenarioPart {
  const scenario = part.scenario;
  const nodes = scenario.nodes ?? [];
  const promptFromNodes = nodes.find((node) => node.type === "prompt");
  const topicFromNodes = nodes.find((node) => node.type === "topic");
  const promptText = firstSimulationUserText(messages);
  const requirementsPart = latestSimulationRequirements(messages)?.part ?? null;
  const confirmedTopicDefinition = requirementsPart
    ? topicDefinitionFromRequirements(requirementsPart, promptText)
    : {};
  const topicConfirmed = hasConfirmedSimulationTopic(messages);
  const roundId = scenarioRoundId(scenario);
  const promptBase = scenario.prompt ??
    promptFromNodes ?? {
      id: "prompt_root",
      type: "prompt" as const,
      roundId,
      label: "用户原问题",
    };
  const prompt = {
    ...promptBase,
    id: promptBase.id || "prompt_root",
    type: "prompt" as const,
    label: "用户原问题",
    detail: promptText,
    status: "confirmed" as const,
    data: {
      ...(promptBase.data ?? {}),
      rawText: promptText,
    },
  };
  const topic =
    typeof scenario.topic === "string"
      ? topicFromNodes ?? {
          id: "topic_definition",
          type: "topic" as const,
          label:
            typeof confirmedTopicDefinition.problem === "string"
              ? confirmedTopicDefinition.problem
              : scenario.topic,
          detail: scenario.topic,
          roundId,
          status: topicConfirmed ? ("confirmed" as const) : ("active" as const),
          data: {
            ...(scenario.topicDefinition ?? {}),
            ...confirmedTopicDefinition,
            problem:
              typeof confirmedTopicDefinition.problem === "string"
                ? confirmedTopicDefinition.problem
                : scenario.topic,
            state: topicConfirmed ? "modeling_world" : "waiting_boundary_confirmation",
          },
        }
      : {
          ...scenario.topic,
          id: scenario.topic.id || "topic_definition",
          type: "topic" as const,
          status: topicConfirmed ? "confirmed" : (scenario.topic.status ?? "active"),
          data: {
            ...(scenario.topicDefinition ?? {}),
            ...(scenario.topic.data ?? {}),
            ...confirmedTopicDefinition,
            state: topicConfirmed
              ? confirmedTopicState(
                  scenario.topic.data?.state ?? scenario.topicDefinition?.state,
                )
              : "waiting_boundary_confirmation",
          },
        };

  return {
    ...part,
    scenario: {
      ...scenario,
      prompt,
      topic,
      nodes: nodes.filter((node) => node.id !== prompt.id && node.id !== topic.id),
    },
  };
}

function scenarioFromSnapshot(
  fallbackTopic: string,
  snapshot: CanvasSnapshot,
): SimulationScenario {
  const promptNode = snapshot.nodes.find((node) => node.type === "prompt");
  const topicNode = snapshot.nodes.find((node) => node.type === "topic");
  return {
    prompt: promptNode,
    topic: topicNode ?? fallbackTopic,
    nodes: snapshot.nodes,
    entities: snapshot.nodes.filter((node) => node.type === "entity"),
    variables: snapshot.nodes.filter((node) => node.type === "variable"),
    assumptions: [],
    scenarios: snapshot.scenarios,
    paths: snapshot.paths,
    edges: snapshot.edges,
    interventions: snapshot.interventions,
    stageState: snapshot.stageState,
    roundId: snapshot.roundId,
  };
}

function selectSimulationWorkbench(messages: ChatMessage[]): {
  scenario: SimulationScenarioPart;
  summaries: SimulationSummaryPart[];
  suggestions: SimulationSuggestionPart[];
  errors: SimulationErrorPart[];
  deliverables: SimulationDeliverablesPart[];
  runId?: string;
} | null {
  let scenario: SimulationScenarioPart | null = null;
  let runId: string | undefined;
  let latestRequirementsPosition:
    | { messageIndex: number; partIndex: number }
    | null = null;
  let latestSummaryPosition:
    | { messageIndex: number; partIndex: number }
    | null = null;
  const scenarioCandidates: Array<{
    part: SimulationScenarioPart;
    runId?: string;
    position: { messageIndex: number; partIndex: number };
  }> = [];
  const deltaCandidates: Array<{
    part: SimulationDeltaPart;
    position: { messageIndex: number; partIndex: number };
  }> = [];
  const summaries: SimulationSummaryPart[] = [];
  const suggestions: SimulationSuggestionPart[] = [];
  const errors: SimulationErrorPart[] = [];
  const deliverables: SimulationDeliverablesPart[] = [];

  const isAfter = (
    left: { messageIndex: number; partIndex: number },
    right: { messageIndex: number; partIndex: number },
  ) =>
    left.messageIndex > right.messageIndex ||
    (left.messageIndex === right.messageIndex && left.partIndex > right.partIndex);

  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (message.role !== "assistant" || !message.parts) continue;
    for (let partIndex = 0; partIndex < message.parts.length; partIndex += 1) {
      const part = message.parts[partIndex];
      const position = { messageIndex, partIndex };
      if (part.kind === "simulation_scenario") {
        scenarioCandidates.push({ part, runId: message.runId, position });
      } else if (
        part.kind === "simulation_node" ||
        part.kind === "simulation_edge" ||
        part.kind === "simulation_path"
      ) {
        deltaCandidates.push({ part, position });
      } else if (part.kind === "simulation_requirements") {
        latestRequirementsPosition = position;
      } else if (part.kind === "simulation_requirement_summary") {
        latestSummaryPosition = position;
      } else if (part.kind === "simulation_summary") {
        summaries.push(part);
      } else if (
        part.kind === "simulation_suggestion" ||
        part.kind === "simulation_next_action"
      ) {
        suggestions.push(part);
      } else if (part.kind === "error") {
        errors.push(part);
      } else if (part.kind === "deliverables") {
        deliverables.push(part);
      }
    }
  }

  const latestRequirementsResolved =
    latestRequirementsPosition == null ||
    (latestSummaryPosition != null &&
      isAfter(latestSummaryPosition, latestRequirementsPosition));
  for (const candidate of scenarioCandidates) {
    const allowedByEntryGate =
      latestRequirementsPosition == null ||
      (latestRequirementsResolved &&
        latestSummaryPosition != null &&
        isAfter(candidate.position, latestSummaryPosition));
    if (!allowedByEntryGate) continue;
    const deltasForCandidate = deltaCandidates
      .filter(
        (delta) =>
          latestSummaryPosition == null ||
          isAfter(delta.position, latestSummaryPosition),
      )
      .map((delta) => delta.part);
    scenario = hydrateSimulationQuestionLayer(
      {
        ...candidate.part,
        scenario: mergeSimulationDeltasIntoScenario(
          candidate.part.scenario,
          deltasForCandidate,
        ),
      },
      messages,
    );
    runId = candidate.runId;
  }

  if (!scenario) return null;
  return {
    scenario,
    summaries: summaries.slice(-2),
    suggestions: suggestions.slice(-1),
    errors: errors.slice(-1),
    deliverables: deliverables.slice(-1),
    runId,
  };
}

function latestSimulationRequirements(
  messages: ChatMessage[],
): { part: SimulationRequirementsPart; runId?: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant" || !message.parts) continue;
    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j];
      if (part?.kind === "simulation_requirements") {
        return { part: part as SimulationRequirementsPart, runId: message.runId };
      }
    }
  }
  return null;
}

function latestSimulationRequirementSummary(
  messages: ChatMessage[],
): { part: SimulationRequirementSummaryPart; runId?: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant" || !message.parts) continue;
    for (let j = message.parts.length - 1; j >= 0; j -= 1) {
      const part = message.parts[j];
      if (part?.kind === "simulation_requirement_summary") {
        return {
          part: part as SimulationRequirementSummaryPart,
          runId: message.runId,
        };
      }
    }
  }
  return null;
}

function normalizeSimulationText(text: string, max = 150): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeAnalysisStepStatus(
  status: unknown,
): SimulationAnalysisStep["status"] {
  if (status === "pending" || status === "success" || status === "error") {
    return status;
  }
  return "running";
}

function simulationAnalysisStepsFromMessages(
  messages: ChatMessage[],
  signal?: SimulationPendingSignal | null,
  options?: { includeFallback?: boolean },
): SimulationAnalysisStep[] {
  const stepsById = new Map<string, SimulationAnalysisStep>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) continue;
    for (const part of message.parts) {
      if (part.kind !== "tool" || part.tool !== "simulation_topic_analysis") {
        continue;
      }
      const id = part.callId ?? part.id;
      const previous = stepsById.get(id);
      stepsById.set(id, {
        id,
        label: part.message ?? "正在分析问题定义",
        status: normalizeAnalysisStepStatus(part.status),
        ...(!part.message && previous ? { label: previous.label } : {}),
      });
    }
  }
  const steps = [...stepsById.values()];
  if (steps.length > 0) return steps.slice(-4);
  if (options?.includeFallback === false) return [];
  if (signal?.detail || signal?.status) {
    return [
      {
        id: "simulation_topic_analysis:waiting",
        label: signal.detail ?? signal.status,
        status: "running",
      },
    ];
  }
  return [
    {
      id: "simulation_topic_analysis:waiting",
      label: "等待 Companion 返回问题定义分析进度",
      status: "pending",
    },
  ];
}

function firstRequirementQuestionValue(
  part: SimulationRequirementsPart,
  match: (question: SimulationRequirementsPart["questions"][number]) => boolean,
): string | undefined {
  const question = part.questions.find(match);
  if (!question) return undefined;
  const answer = part.answers?.[question.id]?.trim();
  if (answer) return answer;
  const selected = part.selectedOptions?.[question.id]?.filter(Boolean).join(" / ");
  if (selected) return selected;
  return question.placeholder?.trim();
}

function topicDefinitionFromRequirements(
  part: SimulationRequirementsPart | null | undefined,
  promptText: string,
): Record<string, unknown> {
  if (!part) return { problem: promptText };
  const matches = (question: SimulationRequirementsPart["questions"][number]) =>
    `${question.id} ${question.label}`.toLowerCase();
  const problem =
    firstRequirementQuestionValue(
      part,
      (question) =>
        /topic|problem|question|主题|问题/.test(matches(question)),
    ) ?? promptText;
  const goal = firstRequirementQuestionValue(part, (question) =>
    /goal|objective|target|purpose|目标|目的|方向/.test(matches(question)),
  );
  const timeRange = firstRequirementQuestionValue(part, (question) =>
    /time|period|range|时间|周期/.test(matches(question)),
  );
  const spaceRange = firstRequirementQuestionValue(part, (question) =>
    /space|region|geo|market|country|area|空间|区域|国家|市场/.test(
      matches(question),
    ),
  );
  const industry = firstRequirementQuestionValue(part, (question) =>
    /industry|sector|object|行业|对象|品类/.test(matches(question)),
  );
  const variables = firstRequirementQuestionValue(part, (question) =>
    /variable|factor|assumption|变量|因素|假设/.test(matches(question)),
  );
  return {
    problem,
    ...(goal ? { goal } : {}),
    ...(timeRange ? { timeRange } : {}),
    ...(spaceRange ? { spaceRange } : {}),
    ...(industry ? { industry } : {}),
    ...(variables ? { variables } : {}),
  };
}

function collectStandaloneSimulationDeltas(
  messages: ChatMessage[],
): SimulationDeltaPart[] {
  const deltas: SimulationDeltaPart[] = [];
  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) continue;
    for (const part of message.parts) {
      if (
        part.kind === "simulation_node" ||
        part.kind === "simulation_edge" ||
        part.kind === "simulation_path"
      ) {
        deltas.push(part);
      }
    }
  }
  return deltas;
}

function buildProgressiveSimulationScenario(
  messages: ChatMessage[],
  options?: {
    requirementsPart?: SimulationRequirementsPart | null;
    requirementSummaryPart?: SimulationRequirementSummaryPart | null;
    signal?: SimulationPendingSignal | null;
  },
): SimulationScenario | null {
  if (!messages.some((message) => message.role === "user")) return null;
  const promptText = firstSimulationUserText(messages);
  const requirementsPart = options?.requirementsPart ?? null;
  const requirementConfirmed = Boolean(options?.requirementSummaryPart);
  const topicDefinition = topicDefinitionFromRequirements(
    requirementsPart,
    promptText,
  );
  const topicProblem =
    typeof topicDefinition.problem === "string" && topicDefinition.problem.trim()
      ? topicDefinition.problem
      : promptText;
  const topicState =
    requirementConfirmed ? "modeling_world"
    : requirementsPart ? "waiting_boundary_confirmation"
    : "understanding";
  const analysisSteps = requirementConfirmed
    ? []
    : simulationAnalysisStepsFromMessages(messages, options?.signal, {
        includeFallback: !requirementsPart,
      });
  const edges: SimulationScenario["edges"] = [];
  const promptNode: NonNullable<SimulationScenario["prompt"]> = {
    id: "prompt_root",
    type: "prompt",
    label: "用户原问题",
    detail: promptText,
    roundId: "round_1",
    stage: "question",
    status: "confirmed",
    locked: true,
    data: {
      rawText: promptText,
    },
  };
  const topicNode: SimulationNode = {
    id: "topic_definition",
    type: "topic",
    label: topicProblem,
    detail: [
      `问题：${topicProblem}`,
      `推演目标：${
        typeof topicDefinition.goal === "string"
          ? topicDefinition.goal
          : requirementsPart
            ? "待确认"
            : "正在识别"
      }`,
      `时间范围：${
        typeof topicDefinition.timeRange === "string"
          ? topicDefinition.timeRange
          : "待确认"
      }`,
      `空间范围：${
        typeof topicDefinition.spaceRange === "string"
          ? topicDefinition.spaceRange
          : "待确认"
      }`,
      `行业：${
        typeof topicDefinition.industry === "string"
          ? topicDefinition.industry
          : "待确认"
      }`,
      `状态：${requirementsPart ? "待用户确认" : "正在理解问题"}`,
    ].join("\n"),
    roundId: "round_1",
    stage: "question",
    status: requirementConfirmed ? "confirmed" : "active",
    locked: requirementConfirmed,
    data: {
      ...topicDefinition,
      state: topicState,
      ...(analysisSteps.length > 0 ? { analysisSteps } : {}),
    },
  };
  edges.push({
    id: "edge_prompt_topic",
    type: "temporal",
    source: promptNode.id,
    target: topicNode.id,
    roundId: "round_1",
  });

  return mergeSimulationDeltasIntoScenario({
    prompt: promptNode,
    topic: topicNode,
    topicDefinition: {
      problem: topicProblem,
      ...(typeof topicDefinition.goal === "string"
        ? { goal: topicDefinition.goal }
        : {}),
      ...(typeof topicDefinition.timeRange === "string"
        ? { timeRange: topicDefinition.timeRange }
        : {}),
      ...(typeof topicDefinition.spaceRange === "string"
        ? { spaceRange: topicDefinition.spaceRange }
        : {}),
      ...(typeof topicDefinition.industry === "string"
        ? { industry: topicDefinition.industry }
        : {}),
      state: topicState,
    },
    stageState: requirementConfirmed
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
        },
    provenance: {
      source: "progressive_preview",
      label: "问题层临时预览",
      reason: requirementConfirmed
        ? "正式沙盘生成前，画布会保留已到达的增量节点。"
        : "问题定义确认前，画布只固定展示 Prompt 和 Topic。",
      warning: requirementConfirmed
        ? "后续 simulation_scenario、simulation_node、simulation_edge 会继续增量补充。"
        : "世界模型节点会等待问题定义确认后再出现。",
      generatedAt: new Date().toISOString(),
    },
    nodes: [],
    entities: [],
    variables: [],
    assumptions: [
      requirementConfirmed
        ? "正式沙盘生成前保留已生成节点，后续节点会继续增量追加。"
        : "问题定义确认前仅展示问题层，避免临时节点误导推演状态。",
    ],
    paths: [],
    edges,
  }, collectStandaloneSimulationDeltas(messages));
}

function latestSimulationPendingSignal(
  messages: ChatMessage[],
): SimulationPendingSignal | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    const content = selectAssistantDisplayContent(message);
    if (content) {
      return {
        status:
          message.status === "error"
            ? "推演生成遇到问题"
            : message.status === "cancelled"
              ? "推演已停止"
              : message.status === "complete"
                ? "推演回复已生成，正在整理画布"
                : "AI 正在响应",
        detail: content.replace(/\s+/g, " ").slice(0, 180),
      };
    }
    const parts = message.parts ?? [];
    for (let j = parts.length - 1; j >= 0; j -= 1) {
      const part = parts[j];
      if (part.kind === "status" && part.label.trim()) {
        return {
          status:
            message.status === "error" ? "推演生成遇到问题" : part.label.trim(),
        };
      }
      if (part.kind === "tool" && part.message?.trim()) {
        return {
          status: part.status === "running" ? "正在执行" : "执行进度",
          detail: part.message.trim().slice(0, 180),
        };
      }
      if (part.kind === "tool_batch") {
        const item = [...part.items]
          .reverse()
          .find((entry) => entry.message?.trim());
        if (item?.message) {
          return {
            status: part.streaming ? "正在执行" : "执行进度",
            detail: item.message.trim().slice(0, 180),
          };
        }
      }
    }
  }
  return null;
}

function SimulationWorkbench({
  sessionId,
  state,
  isReplying,
  bottomRef,
  onContinueAsMessage,
  embedded = false,
}: {
  sessionId: string;
  state: NonNullable<ReturnType<typeof selectSimulationWorkbench>>;
  isReplying: boolean;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  onContinueAsMessage: (answer: string) => void;
  embedded?: boolean;
}) {
  const [rounds, setRounds] = useState<
    Array<{ roundId: string; createdAt?: string; label?: string }>
  >([]);
  const [activeRoundId, setActiveRoundId] = useState("round_1");
  const [activeSnapshot, setActiveSnapshot] = useState<CanvasSnapshot | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);
  const visibleRounds = rounds.length > 0 ? rounds : [{ roundId: "round_1" }];
  const activeRound = visibleRounds.find((round) => round.roundId === activeRoundId);
  const latestRound = visibleRounds.at(-1);
  const latestRoundId = latestRound?.roundId ?? "round_1";
  const isHistorical = activeRoundId !== latestRoundId;
  const scenario = useMemo(
    () =>
      activeSnapshot
        ? scenarioFromSnapshot(
            simulationTopicText(state.scenario.scenario.topic),
            activeSnapshot,
          )
        : state.scenario.scenario,
    [activeSnapshot, state.scenario.scenario],
  );

  useEffect(() => {
    let cancelled = false;
    const retryDelay = (attempt: number) =>
      new Promise((resolve) => setTimeout(resolve, attempt * 350));
    const loadLatestSnapshot = async (roundId: string) => {
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          const snapshotRes = await fetchSimulationSnapshot({ sessionId, roundId });
          if (!cancelled) setActiveSnapshot(snapshotRes.snapshot);
          return;
        } catch {
          if (attempt === 4) {
            if (!cancelled) setActiveSnapshot(null);
            return;
          }
          await retryDelay(attempt);
        }
      }
    };
    const loadRounds = async () => {
      for (let attempt = 1; attempt <= 6; attempt += 1) {
        try {
          const res = await fetchSimulationRounds(sessionId);
          if (cancelled) return;
          if (res.rounds.length === 0 && attempt < 6) {
            await retryDelay(attempt);
            continue;
          }
          setRounds(res.rounds);
          const latest = res.rounds.at(-1);
          if (latest) {
            setActiveRoundId(latest.roundId);
            if (latest.roundId !== "round_1") {
              void loadLatestSnapshot(latest.roundId);
            } else {
              setActiveSnapshot(null);
            }
          }
          return;
        } catch {
          if (attempt === 6) {
            if (!cancelled) setRounds([]);
            return;
          }
          await retryDelay(attempt);
        }
      }
    };
    void loadRounds();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const selectRound = async (roundId: string) => {
    setActiveRoundId(roundId);
    setRoundError(null);
    if (roundId === "round_1" && rounds.length <= 1) {
      setActiveSnapshot(null);
      return;
    }
    try {
      const res = await fetchSimulationSnapshot({ sessionId, roundId });
      setActiveSnapshot(res.snapshot);
    } catch (err) {
      setRoundError(err instanceof Error ? err.message : "轮次快照读取失败");
      if (roundId === "round_1") setActiveSnapshot(null);
    }
  };

  return (
    <div
      className={
        embedded
          ? "flex h-full min-h-0 flex-col"
          : "mx-auto flex h-full w-full max-w-[1480px] flex-col px-4 pb-36 pt-4"
      }
    >
      {visibleRounds.length > 1 || roundError ? (
        <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          {visibleRounds.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--fg-tertiary)]">推演轮次</span>
              {visibleRounds.map((round) => {
                const selected = activeRoundId === round.roundId;
                return (
                  <button
                    key={round.roundId}
                    type="button"
                    onClick={() => void selectRound(round.roundId)}
                    className={[
                      "rounded-[var(--radius-md)] border px-2.5 py-1 text-xs transition-colors",
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg)]"
                        : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg-secondary)] hover:border-[var(--accent)]",
                    ].join(" ")}
                  >
                    {simulationRoundLabel(round.roundId, round.label)}
                  </button>
                );
              })}
            </div>
          ) : null}
          {isHistorical ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--warn)]/25 bg-[var(--activity-chip-wait-bg)] px-3 py-2 text-xs text-[var(--activity-chip-wait-fg)]">
              <span>
                你正在查看历史轮次：{simulationRoundLabel(activeRoundId, activeRound?.label)}。新的选择或重算会生成新一轮推演，旧版本仍可回看。
              </span>
              <button
                type="button"
                onClick={() => void selectRound(latestRoundId)}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                回到最新
              </button>
            </div>
          ) : null}
          {roundError ? (
            <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-3 py-2 text-xs text-[var(--danger-muted)]">
              {roundError}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        <SimulationCanvas
          embedded={embedded}
          scenario={scenario}
          isReplying={isReplying}
          summaries={state.summaries}
          suggestions={state.suggestions}
          deliverables={state.deliverables}
          errors={state.errors}
          onContinueAsMessage={onContinueAsMessage}
        />
      </div>
      <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
    </div>
  );
}

function SimulationPendingWorkbench({
  title,
  isReplying,
  signal,
  scenario,
  requirementsPart,
  requirementSummaryPart,
  bottomRef,
  onContinueAsMessage,
  onRequirementsSubmitted,
  onRequirementsDraftChange,
  topicAnalysisActivity = null,
  embedded = false,
}: {
  title: string;
  isReplying: boolean;
  signal?: SimulationPendingSignal | null;
  scenario?: SimulationScenario | null;
  requirementsPart?: SimulationRequirementsPart | null;
  requirementSummaryPart?: SimulationRequirementSummaryPart | null;
  topicAnalysisActivity?: SimulationTopicAnalysisActivity | null;
  bottomRef?: React.RefObject<HTMLDivElement | null>;
  onContinueAsMessage: (answer: string) => void;
  onRequirementsSubmitted: (partId: string, answer: string) => void;
  onRequirementsDraftChange: (
    partId: string,
    patch: {
      selectedOptions?: Record<string, string[]>;
      answers?: Record<string, string>;
    },
  ) => void;
  embedded?: boolean;
}) {
  const showRequirementsCard = Boolean(
    requirementsPart && !requirementSummaryPart,
  );
  const status = requirementSummaryPart
    ? isReplying
      ? "入口设定已确认，AI 正在生成初始沙盘"
      : "入口设定已确认，等待初始沙盘"
    : signal?.status ?? (isReplying ? "AI 正在把回复拆成节点" : "等待你补充或确认");
  const description = requirementSummaryPart
    ? "问题层已完成 Prompt 与 Topic 对齐，接下来会从 Topic 开始搭建世界模型、变量与首批情景路径。"
    : signal?.detail ??
      "起点已建立，后续回复会按主体、变量、路径、依据和结论拆成依赖节点。";

  return (
    <div
      className={
        embedded
          ? "relative flex h-full min-h-0 flex-col"
          : "relative flex h-full min-h-[calc(100vh-5rem)] flex-col pb-36"
      }
    >
      {scenario ? (
        <div className="min-h-0 flex-1">
          <SimulationCanvas
            embedded={embedded}
            scenario={scenario}
            isReplying={isReplying}
            entryRequirementsPart={
              showRequirementsCard ? requirementsPart ?? undefined : undefined
            }
            requirementSummaryPart={requirementSummaryPart ?? undefined}
            onRequirementsSubmitted={onRequirementsSubmitted}
            onRequirementsDraftChange={onRequirementsDraftChange}
            onContinueAsMessage={onContinueAsMessage}
            topicAnalysisActivity={topicAnalysisActivity}
          />
        </div>
      ) : (
        <SimulationStartCanvas
          status={{
            status,
            title,
            description,
          }}
        />
      )}
      <div ref={bottomRef} className="h-1 shrink-0" aria-hidden />
    </div>
  );
}

export function ChatThread({
  id,
  surfaceModuleId = "chat",
}: {
  id: string;
  surfaceModuleId?: ChatSurfaceModuleId;
}) {
  const surface = MODULE_CHAT_SURFACES[surfaceModuleId];
  const { settings } = useSettings();
  const { executionSource, agentId, agentModel, selectAgentModel } =
    useChatAgentSelection();
  const { messages, sendMessage, isReplying, stopReply, bottomRef, setMessages } =
    useChatSend(id, [], surfaceModuleId);
  const [hydrated, setHydrated] = useState(false);
  const pendingHandled = useRef(false);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [dismissedTodoKey, setDismissedTodoKey] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<ChatModeId>(
    surfaceModuleId === "chat" ? "auto" : "deep",
  );
  const initialMessagesLoaded = useRef(false);

  const pinnedTodo = useMemo(
    () => latestTodoPartFromMessages(messages),
    [messages],
  );
  const pinnedTodoKey = pinnedTodo ? todoPartKey(pinnedTodo) : null;
  const showPinnedTodo =
    pinnedTodo != null && pinnedTodoKey !== dismissedTodoKey;
  const deliverablesKey = useMemo(
    () =>
      messages
        .flatMap((message) => {
          if (message.role !== "assistant") return [];
          const part = selectAssistantDeliverablesPart(message);
          if (!part) return [];
          return part.items.map(
            (item) =>
              `${part.id}:${part.workspaceProjectId ?? ""}:${
                item.workspaceProjectId ?? ""
              }:${part.completedAt ?? ""}:${item.path}`,
          );
        })
        .join("|"),
    [messages],
  );
  const simulationWorkbench = useMemo(
    () =>
      surfaceModuleId === "simulation"
        ? selectSimulationWorkbench(messages)
        : null,
    [messages, surfaceModuleId],
  );
  const simulationPendingSignal = useMemo(
    () =>
      surfaceModuleId === "simulation"
        ? latestSimulationPendingSignal(messages)
        : null,
    [messages, surfaceModuleId],
  );
  const simulationRequirements = useMemo(
    () =>
      surfaceModuleId === "simulation"
        ? latestSimulationRequirements(messages)
        : null,
    [messages, surfaceModuleId],
  );
  const simulationRequirementSummary = useMemo(
    () =>
      surfaceModuleId === "simulation"
        ? latestSimulationRequirementSummary(messages)
        : null,
    [messages, surfaceModuleId],
  );
  const simulationTopicAnalysisActivity = useMemo(
    () =>
      surfaceModuleId === "simulation" && !simulationWorkbench
        ? selectSimulationTopicAnalysisActivity(messages)
        : null,
    [messages, simulationWorkbench, surfaceModuleId],
  );
  const progressiveSimulationScenario = useMemo(
    () =>
      surfaceModuleId === "simulation" && !simulationWorkbench
        ? buildProgressiveSimulationScenario(messages, {
            requirementsPart: simulationRequirements?.part ?? null,
            requirementSummaryPart: simulationRequirementSummary?.part ?? null,
            signal: simulationPendingSignal,
          })
        : null,
    [
      messages,
      simulationPendingSignal,
      simulationRequirements,
      simulationRequirementSummary?.part,
      simulationWorkbench,
      surfaceModuleId,
    ],
  );
  const simulationSuggestions = useMemo(
    () =>
      surfaceModuleId === "simulation"
        ? getChatHomeSuggestions("simulation")
        : null,
    [surfaceModuleId],
  );

  const scrollContentKey = useMemo(
    () => buildChatScrollContentKey(messages),
    [messages],
  );
  const {
    showJumpToBottom,
    scrollToBottom,
    beginUserDisclosure,
    markPinned,
  } = useChatScrollPin(scrollRootRef, {
    active: hydrated,
    resetKey: id,
    messageCount: messages.length,
    isReplying,
    contentKey: scrollContentKey,
  });
  const handleActivityCollapseChange = useCallback(
    (messageId: string, collapse: ActivityCollapse) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, activityCollapse: collapse } : message,
        ),
      );
    },
    [setMessages],
  );

  const [sessionProjectId, setSessionProjectIdLocal] = useState(() =>
    resolveThreadProjectId(id),
  );

  useEffect(() => {
    const onProjectUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId: string; projectId: string }>)
        .detail;
      if (detail?.sessionId === id) {
        setSessionProjectIdLocal(detail.projectId);
      }
    };
    window.addEventListener("jlc-session-project-updated", onProjectUpdate);
    return () =>
      window.removeEventListener("jlc-session-project-updated", onProjectUpdate);
  }, [id]);
  const { setWorkspaceProject } = useWorkspaceProject();
  const workspace = useWorkspaceOptional();
  const chatSession = useChatSessionOptional();
  const publishSessionRef = useRef(chatSession?.publishSession);
  const lastRefreshedDeliverablesKey = useRef("");
  const lastSimulationDeliverablesRefreshKey = useRef("");

  useEffect(() => {
    publishSessionRef.current = chatSession?.publishSession;
  }, [chatSession?.publishSession]);

  useEffect(() => {
    publishSessionRef.current?.(id, messages);
  }, [id, messages]);

  useEffect(() => {
    let cancelled = false;
    const indexedProjectId = resolveThreadProjectId(id);
    void loadSessionMessagesHybrid(id).then((loaded) => {
      if (cancelled) return;
      const loadedProjectId = normalizeThreadProjectId(loaded.projectId);
      const nextProjectId =
        loadedProjectId !== NO_PROJECT_ID
          ? loadedProjectId
          : indexedProjectId;
      if (nextProjectId !== NO_PROJECT_ID) {
        setSessionProjectId(id, nextProjectId);
        setSessionProjectIdLocal(nextProjectId);
        const existingSession = getChatSession(id);
        upsertChatSession({
          id,
          projectId: nextProjectId,
          surfaceModuleId,
          title: existingSession?.title,
          createdAt: existingSession?.createdAt,
          updatedAt: existingSession?.updatedAt,
          runStatus: existingSession?.runStatus,
          lastReadAt: existingSession?.lastReadAt,
        });
      } else {
        setSessionProjectIdLocal(NO_PROJECT_ID);
      }
      if (loaded.messages.length > 0) setMessages(loaded.messages);
      initialMessagesLoaded.current = true;
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, setMessages, surfaceModuleId]);

  useEffect(() => {
    const p = getResearchProject(sessionProjectId);
    const label =
      p ?
        isPlatformDefaultProject(sessionProjectId) ?
          p.pathSummary
        : projectWorkLabel(p)
      : "默认工作文件夹（XIAOCHUANG）";
    setWorkspaceProject(sessionProjectId, label);
  }, [sessionProjectId, setWorkspaceProject]);

  const showProjectPicker =
    surfaceModuleId !== "simulation" &&
    !isSessionStarted(id) &&
    messages.length === 0;

  let hasInflightAssistant = false;
  let inflightRunId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (
      message?.role === "assistant" &&
      (message.status === "loading" || message.status === "streaming")
    ) {
      hasInflightAssistant = true;
      inflightRunId = message.runId;
      break;
    }
  }

  const composerGenerating = isReplying || hasInflightAssistant;

  const handleStop = useCallback(() => {
    stopReply(inflightRunId);
  }, [inflightRunId, stopReply]);

  const handleSend = useCallback(
    async (payload: ChatComposerSendPayload) => {
      markPinned();
      setDismissedTodoKey(null);
      setLastMode(normalizeChatMode(payload.mode) ?? "auto");
      const effectiveExecutionSource =
        surfaceModuleId === "simulation" ? "cli" : payload.executionSource;

      // 从新的配置系统构建 API 配置
      const apiProvider =
        effectiveExecutionSource === "api"
          ? selectionToApiConfig(
              settings.modelProviders,
              settings.activeApiSelection,
            )
          : settings.apiProvider;

      await sendMessage(payload.text, {
        executionSource: effectiveExecutionSource,
        mode: surfaceModuleId === "chat" ? payload.mode : "deep",
        surfaceModuleId,
        writingTemplateId: payload.writingTemplateId,
        pptTemplateId: payload.pptTemplateId,
        videoTemplateId: payload.videoTemplateId,
        agentId: payload.agentId,
        agentModel: payload.agentModel,
        apiProvider,
        projectId: payload.projectId,
        attachments: payload.attachments,
      });
    },
    [
      markPinned,
      sendMessage,
      surfaceModuleId,
      settings.modelProviders,
      settings.activeApiSelection,
      settings.apiProvider,
    ],
  );

  const handleSimulationSuggestion = useCallback(
    (label: string) => {
      void handleSend({
        text: label,
        mode: "deep",
        executionSource,
        agentId,
        agentModel,
        projectId: sessionProjectId ?? NO_PROJECT_ID,
      });
    },
    [
      handleSend,
      executionSource,
      agentId,
      agentModel,
      sessionProjectId,
    ],
  );

  const handleClarificationSubmitted = useCallback(
    (partId: string, answer: string) => {
      setSessionRunStatus(id, "running");
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (part.id !== partId || part.kind !== "clarification") {
              return part;
            }
            changed = true;
            return {
              ...part,
              submitted: true,
              answer,
              streaming: false,
              completedAt: Date.now(),
            };
          });
          return changed
            ? {
                ...message,
                parts,
                status: "complete" as const,
              }
            : message;
        }),
      );
    },
    [id, setMessages],
  );

  const handleClarificationDraftChange = useCallback(
    (
      partId: string,
      patch: {
        selectedOptions?: Record<string, string[]>;
        draft?: string;
      },
    ) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (part.id !== partId || part.kind !== "clarification") {
              return part;
            }
            changed = true;
            return {
              ...part,
              ...patch,
            };
          });
          return changed ? { ...message, parts } : message;
        }),
      );
    },
    [setMessages],
  );

  const handleClarificationContinue = useCallback(
    (answer: string) => {
      markPinned();
      const effectiveExecutionSource =
        surfaceModuleId === "simulation" ? "cli" : executionSource;

      // 从新的配置系统构建 API 配置
      const apiProvider =
        effectiveExecutionSource === "api"
          ? selectionToApiConfig(
              settings.modelProviders,
              settings.activeApiSelection,
            )
          : settings.apiProvider;

      sendMessage(`我补充的信息如下，请继续完成刚才的任务：\n\n${answer}`, {
        executionSource: effectiveExecutionSource,
        mode: surfaceModuleId === "chat" ? lastMode : "deep",
        surfaceModuleId,
        writingTemplateId:
          surface.skillPicker === "writing"
            ? (readStoredModuleSkillTemplateId("writing", id) ?? undefined)
            : undefined,
        pptTemplateId:
          surface.skillPicker === "ppt"
            ? (readStoredModuleSkillTemplateId("ppt", id) ?? undefined)
            : undefined,
        videoTemplateId:
          surface.skillPicker === "video"
            ? (readStoredModuleSkillTemplateId("video", id) ?? undefined)
            : undefined,
        agentId,
        agentModel,
        apiProvider,
        projectId: sessionProjectId ?? NO_PROJECT_ID,
      });
    },
    [
      markPinned,
      sendMessage,
      executionSource,
      id,
      lastMode,
      surface.skillPicker,
      surfaceModuleId,
      agentId,
      agentModel,
      settings.modelProviders,
      settings.activeApiSelection,
      settings.apiProvider,
      sessionProjectId,
    ],
  );

  const handleRequirementsSubmitted = useCallback(
    (partId: string, answer: string) => {
      setSessionRunStatus(id, "running");
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (
              part.id !== partId ||
              (part.kind !== "writing_requirements" &&
                part.kind !== "ppt_requirements" &&
                part.kind !== "3d_requirements" &&
                part.kind !== "video_requirements" &&
                part.kind !== "simulation_requirements")
            ) {
              return part;
            }
            changed = true;
            return {
              ...part,
              submitted: true,
              answer,
              streaming: false,
              completedAt: Date.now(),
            };
          });
          return changed
            ? {
                ...message,
                parts,
                status: "complete" as const,
              }
            : message;
        }),
      );
    },
    [id, setMessages],
  );

  const handleRequirementsDraftChange = useCallback(
    (
      partId: string,
      patch: {
        selectedOptions?: Record<string, string[]>;
        answers?: Record<string, string>;
      },
    ) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (
              part.id !== partId ||
              (part.kind !== "writing_requirements" &&
                part.kind !== "ppt_requirements" &&
                part.kind !== "3d_requirements" &&
                part.kind !== "video_requirements" &&
                part.kind !== "simulation_requirements")
            ) {
              return part;
            }
            changed = true;
            return {
              ...part,
              ...patch,
            };
          });
          return changed ? { ...message, parts } : message;
        }),
      );
    },
    [setMessages],
  );

  const handleOutlineCommitted = useCallback(
    (partId: string, patch: OutlineCommitPayload) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant" || !message.parts) return message;
          let changed = false;
          const parts = message.parts.map((part) => {
            if (
              part.id !== partId ||
              (part.kind !== "writing_outline" &&
                part.kind !== "ppt_outline" &&
                part.kind !== "3d_outline" &&
                part.kind !== "video_outline")
            ) {
              return part;
            }
            changed = true;
            if (part.kind === "writing_outline" && patch.kind === "writing_outline") {
              return {
                ...part,
                outline: patch.outline,
                markdown: patch.markdown,
                completedAt: Date.now(),
              };
            }
            if (part.kind === "ppt_outline" && patch.kind === "ppt_outline") {
              return {
                ...part,
                coverTitle: patch.coverTitle,
                outline: patch.outline,
                markdown: patch.markdown,
                completedAt: Date.now(),
              };
            }
            if (part.kind === "3d_outline" && patch.kind === "3d_outline") {
              return {
                ...part,
                outline: patch.outline,
                markdown: patch.markdown,
                completedAt: Date.now(),
              };
            }
            if (part.kind === "video_outline" && patch.kind === "video_outline") {
              return {
                ...part,
                outline: patch.outline,
                markdown: patch.markdown,
                completedAt: Date.now(),
              };
            }
            return {
              ...part,
              completedAt: Date.now(),
            };
          });
          return changed ? { ...message, parts } : message;
        }),
      );
    },
    [setMessages],
  );

  const stored = getChatSession(id);
  const title =
    messages.find((m) => m.role === "user")?.content.slice(0, 40) ??
    stored?.title ??
    surface.threadTitleFallback;

  const project = isUsingLocalProject(sessionProjectId)
    ? getResearchProject(sessionProjectId)
    : undefined;
  const projectDisplayLabel =
    project ?
      isPlatformDefaultProject(sessionProjectId) ?
        project.pathSummary
      : project.name
    : null;

  useEffect(() => {
    if (!hydrated || pendingHandled.current) return;
    const pending = consumePendingSession(id);
    if (pending) {
      pendingHandled.current = true;
      markPinned();
      const effectiveExecutionSource =
        surfaceModuleId === "simulation" ? "cli" : pending.executionSource;

      // 从新的配置系统构建 API 配置
      const apiProvider =
        effectiveExecutionSource === "api"
          ? selectionToApiConfig(
              settings.modelProviders,
              settings.activeApiSelection,
            )
          : settings.apiProvider;

      sendMessage(pending.text, {
        executionSource: effectiveExecutionSource,
        mode: surfaceModuleId === "chat" ? pending.mode : "deep",
        surfaceModuleId,
        writingTemplateId:
          pending.writingTemplateId ??
          (surface.skillPicker === "writing"
            ? (readStoredModuleSkillTemplateId("writing", id) ?? undefined)
            : undefined),
        pptTemplateId:
          pending.pptTemplateId ??
          (surface.skillPicker === "ppt"
            ? (readStoredModuleSkillTemplateId("ppt", id) ?? undefined)
            : undefined),
        videoTemplateId:
          pending.videoTemplateId ??
          (surface.skillPicker === "video"
            ? (readStoredModuleSkillTemplateId("video", id) ?? undefined)
            : undefined),
        agentId: pending.agentId,
        agentModel: pending.agentModel,
        apiProvider,
        projectId: pending.projectId ?? sessionProjectId ?? NO_PROJECT_ID,
        attachments: pending.attachments,
      });
    }
  }, [
    hydrated,
    id,
    markPinned,
    sendMessage,
    surface.skillPicker,
    surfaceModuleId,
    sessionProjectId,
    settings.modelProviders,
    settings.activeApiSelection,
    settings.apiProvider,
  ]);

  useEffect(() => {
    if (!hydrated || messages.length === 0) return;
    const t = window.setTimeout(() => {
      void saveSessionMessagesHybrid(id, messages, sessionProjectId);
    }, 400);
    return () => window.clearTimeout(t);
  }, [hydrated, id, messages, sessionProjectId]);

  useEffect(() => {
    if (!hydrated || !deliverablesKey || !workspace) return;
    if (deliverablesKey === lastRefreshedDeliverablesKey.current) return;
    lastRefreshedDeliverablesKey.current = deliverablesKey;
    workspace.refreshTree();
  }, [deliverablesKey, hydrated, workspace]);

  useEffect(() => {
    if (
      surfaceModuleId !== "simulation" ||
      !hydrated ||
      !deliverablesKey ||
      !workspace
    ) {
      return;
    }
    if (deliverablesKey === lastSimulationDeliverablesRefreshKey.current) return;
    lastSimulationDeliverablesRefreshKey.current = deliverablesKey;
    workspace.refreshTree();
  }, [deliverablesKey, hydrated, surfaceModuleId, workspace]);

  useEffect(() => {
    if (!hydrated || isReplying) return;
    const restorableRunIds = messages
      .filter(
        (message) =>
          message.role === "assistant" &&
          !!message.runId &&
          ((message.status === "loading" || message.status === "streaming") ||
            !message.parts?.length),
      )
      .map((message) => message.runId!)
      .filter((runId, index, list) => list.indexOf(runId) === index);

    if (restorableRunIds.length === 0) return;
    const hasInflight = messages.some(
      (message) =>
        message.role === "assistant" &&
        !!message.runId &&
        (message.status === "loading" || message.status === "streaming"),
    );
    if (hasInflight) setSessionRunStatus(id, "running");
    let cancelled = false;

    const poll = async () => {
      const records = await Promise.all(
        restorableRunIds.map(async (runId) => {
          try {
            return await fetchRunRecord(runId);
          } catch {
            return null;
          }
        }),
      );
      const eventResults = await Promise.all(
        restorableRunIds.map(async (runId) => {
          try {
            return [runId, await fetchRunEvents(runId)] as const;
          } catch {
            return [runId, null] as const;
          }
        }),
      );
      if (cancelled) return;
      const byRunId = new Map(
        records
          .filter((record): record is NonNullable<typeof record> => record != null)
          .map((record) => [record.runId, record]),
      );
      const eventsByRunId = new Map(eventResults);
      if (byRunId.size === 0) return;

      setMessages((prev) =>
        prev.map((message) => {
          if (!message.runId || !byRunId.has(message.runId)) return message;
          const events = eventsByRunId.get(message.runId);
          if (events?.items?.length) {
            return applyRunEventsToMessage(
              message,
              events.items,
              byRunId.get(message.runId)!,
            );
          }
          return applyRunRecordToMessage(message, byRunId.get(message.runId)!);
        }),
      );

      const stillRunning = [...byRunId.values()].some(
        (record) =>
          record.status === "accepted" ||
          record.status === "queued" ||
          record.status === "starting" ||
          record.status === "running",
      );
      const waitingUser = [...byRunId.values()].some(
        (record) => record.status === "waiting_user",
      );
      if (waitingUser) setSessionRunStatus(id, "waiting_user");
      else if (hasInflight && !stillRunning) setSessionRunStatus(id, "idle");
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hydrated, id, isReplying, messages, setMessages]);

  useEffect(() => {
    markSessionRead(id);
  }, [id]);

  useEffect(() => {
    if (!isReplying) {
      markSessionRead(id);
    }
  }, [id, isReplying]);

  if (!hydrated) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-sm text-[var(--fg-tertiary)]">
        <span className="inline-flex gap-1" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--accent)] [animation-delay:300ms]" />
        </span>
        加载会话…
      </div>
    );
  }

  if (surfaceModuleId === "simulation") {
    const simulationTitle =
      messages.length === 0 ? surface.newSessionLabel : title;

    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ChatTopBar
          left={
            <ChatAgentModelPicker
              executionSource={executionSource}
              agentId={agentId}
              agentModel={agentModel}
              onChange={selectAgentModel}
            />
          }
          center={
            <span className="line-clamp-1 text-sm text-[var(--fg-secondary)]">
              {simulationTitle}
            </span>
          }
        />

        <div className="simulation-canvas-shell relative min-h-0 flex-1 overflow-hidden bg-[var(--surface)]">
          <div className="absolute inset-0 overflow-hidden">
            {messages.length === 0 ? (
              <SimulationStartCanvas />
            ) : simulationWorkbench ? (
              <SimulationWorkbench
                embedded
                sessionId={id}
                state={simulationWorkbench}
                isReplying={composerGenerating}
                bottomRef={bottomRef}
                onContinueAsMessage={handleClarificationContinue}
              />
            ) : (
              <SimulationPendingWorkbench
                embedded
                title={title}
                isReplying={composerGenerating}
                signal={simulationPendingSignal}
                scenario={progressiveSimulationScenario}
                requirementsPart={simulationRequirements?.part ?? null}
                requirementSummaryPart={simulationRequirementSummary?.part ?? null}
                topicAnalysisActivity={simulationTopicAnalysisActivity}
                bottomRef={bottomRef}
                onContinueAsMessage={handleClarificationContinue}
                onRequirementsSubmitted={handleRequirementsSubmitted}
                onRequirementsDraftChange={handleRequirementsDraftChange}
              />
            )}
          </div>

          <footer className="chat-composer-dock chat-composer-dock--canvas pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
            <div className="pointer-events-auto mx-auto flex w-full max-w-4xl flex-col items-center gap-3">
              {messages.length === 0 && simulationSuggestions ? (
                <div className="w-full max-w-[var(--chat-message-max)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-whisper)]">
                  <ChatHomeTaskSuggestions
                    group={simulationSuggestions}
                    onSelect={handleSimulationSuggestion}
                  />
                </div>
              ) : null}
              <div className="w-full max-w-[var(--chat-message-max)]">
                <ChatComposer
                sessionId={id}
                executionSource={executionSource}
                agentId={agentId}
                agentModel={agentModel}
                showProjectPicker={false}
                showModePicker={false}
                skillPickerModule={surface.skillPicker}
                newSessionHref={surface.newSessionHref}
                defaultMode="deep"
                placeholder={
                  messages.length === 0
                    ? "输入推演问题… 发送后会在画布上建立起点节点"
                    : "继续向画布下指令… 输入 @ 提及当前项目文件"
                }
                onSend={handleSend}
                generating={composerGenerating}
                onStop={handleStop}
              />
              </div>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatTopBar
        left={
          <ChatAgentModelPicker
            executionSource={executionSource}
            agentId={agentId}
            agentModel={agentModel}
            onChange={selectAgentModel}
          />
        }
        center={
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <h1 className="font-display line-clamp-1 w-full text-center text-sm text-[var(--fg)]">
              {title}
            </h1>
            {projectDisplayLabel && (
              <span className="line-clamp-1 max-w-full text-center text-[11px] text-[var(--fg-tertiary)]">
                {projectDisplayLabel}
              </span>
            )}
          </div>
        }
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRootRef}
          className="chat-scroll-root min-h-0 flex-1 overflow-y-auto"
        >
          {messages.length === 0 ? (
            <div className="chat-scroll-content mx-auto w-full max-w-[var(--chat-message-max)]">
              <p className="text-center text-sm text-[var(--fg-tertiary)]">
                {showProjectPicker
                  ? "选择项目并发送第一条消息开始对话"
                  : "发送第一条消息开始对话"}
              </p>
            </div>
          ) : (
            <ChatTurnList
              messages={messages}
              sessionId={id}
              scrollRootRef={scrollRootRef}
              bottomRef={bottomRef}
              thinkingGapMinMs={lastMode === "deep" ? 3_000 : 8_000}
              onActivityCollapseChange={handleActivityCollapseChange}
              onDisclosureIntent={beginUserDisclosure}
              onClarificationSubmitted={handleClarificationSubmitted}
              onClarificationContinue={handleClarificationContinue}
              onClarificationDraftChange={handleClarificationDraftChange}
              onRequirementsSubmitted={handleRequirementsSubmitted}
              onRequirementsContinue={handleClarificationContinue}
              onRequirementsDraftChange={handleRequirementsDraftChange}
              onOutlineCommitted={handleOutlineCommitted}
            />
          )}
        </div>

        {showJumpToBottom ? (
          <button
            type="button"
            className="pointer-events-auto absolute bottom-40 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--fg-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
            onClick={() => scrollToBottom(isReplying ? "auto" : "smooth")}
            aria-label="回到底部"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            回到底部
          </button>
        ) : null}

        <footer className="chat-composer-dock pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="pointer-events-auto mx-auto w-full max-w-[var(--chat-message-max)]">
            {showPinnedTodo ? (
              <PinnedTodoBar
                part={pinnedTodo}
                onDismiss={() => setDismissedTodoKey(pinnedTodoKey)}
              />
            ) : null}
            <ChatComposer
              sessionId={id}
              executionSource={executionSource}
              agentId={agentId}
              agentModel={agentModel}
              showProjectPicker={showProjectPicker}
              showModePicker={false}
              skillPickerModule={surface.skillPicker}
              newSessionHref={surface.newSessionHref}
              defaultMode={surfaceModuleId === "chat" ? "auto" : "deep"}
              placeholder={
                showProjectPicker
                  ? "输入问题… 输入 @ 提及当前项目内文件"
                  : "继续提问… 输入 @ 提及当前项目文件"
              }
              onSend={handleSend}
              generating={composerGenerating}
              onStop={handleStop}
            />
          </div>
        </footer>
      </div>
    </div>
  );
}

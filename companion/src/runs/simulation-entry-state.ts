import type { CreateRunRequest } from "../types.js";
import { buildRequirementsPart } from "./requirements-parts.js";

export type SimulationEntryQuestion = {
  id: string;
  question: string;
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
  options?: Array<{ label: string; description?: string }>;
};

export type SimulationRequirementsPart = {
  id: string;
  zone: "summary";
  kind: "simulation_requirements";
  runId: string;
  toolUseId: string;
  title: string;
  description?: string;
  questions: Array<{
    id: string;
    label: string;
    type: SimulationEntryQuestion["type"];
    required?: boolean;
    description?: string;
    placeholder?: string;
    options?: SimulationEntryQuestion["options"];
  }>;
  answers?: Record<string, string>;
  selectedOptions?: Record<string, string[]>;
  streaming: false;
  completedAt: number;
};

export type SimulationEntryDecision =
  | {
      action: "allow";
      reason: "not_simulation" | "boundary_confirmed";
      shouldBlockWorldModel: false;
    }
  | {
      action: "wait_for_boundary_confirmation";
      reason: "initial_boundary_required";
      shouldBlockWorldModel: true;
    }
  | {
      action: "emit_boundary_fallback";
      reason: "missing_structured_boundary";
      shouldBlockWorldModel: true;
      part: SimulationRequirementsPart;
    };

export function isSubmittedRequirementFollowup(content: string): boolean {
  return content.trim().startsWith("我补充的信息如下，请继续完成刚才的任务：");
}

function isSimulationBoundaryConfirmationText(userText: string): boolean {
  return (
    userText.includes("请基于这个问题定义节点继续推演：") ||
    userText.includes("Topic ID：") ||
    userText.includes("操作：确认") ||
    userText.includes("确认进入世界模型") ||
    userText.includes("确认这个问题定义")
  );
}

export function isInitialSimulationTopicDefinitionRun(
  req: CreateRunRequest,
  userText: string,
): boolean {
  if (req.moduleId !== "simulation") return false;
  if (isSubmittedRequirementFollowup(userText)) return false;
  return !isSimulationBoundaryConfirmationText(userText);
}

export function buildSimulationEntryQuestions(
  topic: string,
): SimulationEntryQuestion[] {
  const shortTopic = topic.trim().replace(/\s+/g, " ").slice(0, 120);
  return [
    {
      id: "topic",
      question: "问题",
      label: "问题",
      type: "text",
      required: true,
      placeholder: shortTopic || "例如：OPEC+ 延长减产的影响推演",
      description: "AI 对用户原问题的结构化理解。",
    },
    {
      id: "goal",
      question: "推演目标",
      label: "推演目标",
      type: "text",
      required: true,
      placeholder: shortTopic ? `分析${shortTopic}` : "例如：分析未来一年出口影响",
      description: "确认这次推演到底要回答什么。",
    },
    {
      id: "time_range",
      question: "推演时间范围",
      label: "推演时间范围",
      type: "text",
      required: true,
      placeholder: "例如：未来三个月",
      description: "时间范围会影响变量滞后和路径节奏。",
    },
    {
      id: "spatial_range",
      question: "空间范围",
      label: "空间范围",
      type: "text",
      required: true,
      placeholder: "例如：中国 / 中美双边 / 全球产业链",
      description: "空间边界会决定后续主体和证据范围。",
    },
    {
      id: "industry",
      question: "行业 / 对象",
      label: "行业 / 对象",
      type: "text",
      required: true,
      placeholder: "例如：纺织出口、家电、半导体、原油",
      description: "行业或对象会成为世界模型的起点。",
    },
    {
      id: "key_variables",
      question: "关键变量",
      label: "关键变量",
      type: "textarea",
      required: false,
      placeholder: "例如：供给变化、需求恢复、库存变化、炼厂利润",
      description: "P0 默认展示 3-5 个最重要变量。",
    },
    {
      id: "default_assumptions",
      question: "默认假设",
      label: "默认假设",
      type: "textarea",
      required: false,
      placeholder: "例如：政策持续一年、没有突发战争、需求不发生深度衰退",
      description: "默认假设可以被用户修改，确认后才会进入世界模型。",
    },
  ];
}

function buildSimulationBoundaryFallbackPart(input: {
  runId: string;
  moduleId: string;
  processSkill?: string | null;
  initialUserText: string;
}): SimulationRequirementsPart | null {
  const part = buildRequirementsPart({
    runId: input.runId,
    toolUseId: `simulation_boundary_fallback:${input.runId}`,
    moduleId: input.moduleId,
    processSkill: input.processSkill,
    rawInput: {
      kind: "simulation_requirements",
      title: "请先校对这次推演的关键信息",
      description:
        "我会先确认推演边界、主体、变量和默认假设，再生成初始沙盘。",
    },
    questions: buildSimulationEntryQuestions(input.initialUserText),
  });
  return part ? (part as unknown as SimulationRequirementsPart) : null;
}

export function resolveSimulationEntryDecision(input: {
  req: CreateRunRequest;
  runId: string;
  initialUserText: string;
  requirementsCardEmitted: boolean;
}): SimulationEntryDecision {
  if (!isInitialSimulationTopicDefinitionRun(input.req, input.initialUserText)) {
    return {
      action: "allow",
      reason:
        input.req.moduleId === "simulation"
          ? "boundary_confirmed"
          : "not_simulation",
      shouldBlockWorldModel: false,
    };
  }

  if (input.requirementsCardEmitted) {
    return {
      action: "wait_for_boundary_confirmation",
      reason: "initial_boundary_required",
      shouldBlockWorldModel: true,
    };
  }

  const part = buildSimulationBoundaryFallbackPart({
    runId: input.runId,
    moduleId: input.req.moduleId,
    processSkill: input.req.processSkill,
    initialUserText: input.initialUserText,
  });

  if (part) {
    return {
      action: "emit_boundary_fallback",
      reason: "missing_structured_boundary",
      shouldBlockWorldModel: true,
      part,
    };
  }

  return {
    action: "wait_for_boundary_confirmation",
    reason: "initial_boundary_required",
    shouldBlockWorldModel: true,
  };
}

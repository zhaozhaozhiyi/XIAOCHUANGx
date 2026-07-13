import type {
  DeliverablesPart,
  ErrorPart,
  SimulationNode,
  SimulationSuggestionPart,
  SimulationSummaryPart,
} from "@/lib/chat-parts";

type SimulationNextAction = NonNullable<
  SimulationSuggestionPart["nextActions"]
>[number];

type DecisionBranchPrompt = {
  id: string;
  label: string;
  detail?: string;
  scenarioId?: string;
};

export type SimulationInterventionAction = {
  label: string;
  prompt: string;
  actionId?: string;
  createsNewRound?: boolean;
};

export function composePromptLines(lines: Array<string | undefined | null | false>) {
  return lines.filter(Boolean).join("\n");
}

export function buildNodeExpandPrompt({
  node,
  nodeTypeLabel,
  impactLines,
}: {
  node: SimulationNode;
  nodeTypeLabel: string;
  impactLines: string[];
}) {
  return composePromptLines([
    "请沿着这个节点继续展开下一层推演：",
    `节点 ID：${node.id}`,
    `节点类型：${nodeTypeLabel}`,
    `节点名称：${node.label}`,
    node.detail ? `节点说明：${node.detail}` : "",
    ...impactLines,
    "请只生成与该节点存在依赖关系的后续节点、边和路径变化。",
    "不要发散到全图；如果需要新节点，请标明它们与当前节点的因果关系。",
  ]);
}

export function buildInterventionActions({
  node,
  nodeTypeLabel,
  impactLines,
}: {
  node: SimulationNode;
  nodeTypeLabel: string;
  impactLines: string[];
}): SimulationInterventionAction[] {
  const base = [
    `节点 ID：${node.id}`,
    `节点类型：${nodeTypeLabel}`,
    `节点名称：${node.label}`,
    node.detail ? `节点说明：${node.detail}` : "",
  ].filter(Boolean);
  const withBase = (title: string, instruction: string) =>
    composePromptLines([title, ...base, ...impactLines, instruction]);

  switch (node.type) {
    case "topic":
      return [
        {
          label: "确认边界并开始",
          actionId: "topic.generateWorldModel",
          createsNewRound: true,
          prompt: withBase(
            "我确认这个问题定义，可以开始第 1 轮推演。",
            "请从 Topic 继续生成世界模型层：Entity、Variable、Hypothesis，并保留 Prompt→Topic 的问题层关系。",
          ),
        },
        {
          label: "补充边界",
          actionId: "topic.addBoundaryCondition",
          createsNewRound: false,
          prompt: withBase(
            "我需要补充这个问题定义。",
            "请先指出当前 Topic 还缺哪些边界字段，并生成可修改的问题定义节点。",
          ),
        },
      ];
    case "variable":
      return [
        {
          label: "调整变量重算",
          actionId: "variable.recalculate",
          createsNewRound: true,
          prompt: withBase(
            "我要调整这个变量并重新推演。",
            "请先给出影响预览：会影响哪些节点、边、Scenario 和结论；确认后生成新 Round。",
          ),
        },
        {
          label: "锁定变量",
          actionId: "variable.lock",
          createsNewRound: false,
          prompt: withBase(
            "请锁定这个变量。",
            "后续推演保持该变量不被自动改写，并说明它会限制哪些路径变化。",
          ),
        },
      ];
    case "event":
      return [
        {
          label: "假设发生",
          actionId: "event.assumeHappens",
          createsNewRound: true,
          prompt: withBase(
            "假设这个事件发生。",
            "请按 IF/THEN 重新推演下游 Inference、Risk、Conclusion 和 Scenario。",
          ),
        },
        {
          label: "假设未发生",
          actionId: "event.assumeNotHappens",
          createsNewRound: true,
          prompt: withBase(
            "假设这个事件未发生。",
            "请保留原事件为历史假设，并生成不发生时的替代路径。",
          ),
        },
      ];
    case "hypothesis":
      return [
        {
          label: "修改假设",
          actionId: "hypothesis.replace",
          createsNewRound: true,
          prompt: withBase(
            "我要修改这个假设。",
            "请先说明该假设影响的变量、推理链和情景路径，再等待我给出新假设值。",
          ),
        },
        {
          label: "生成分支",
          actionId: "hypothesis.branch",
          createsNewRound: true,
          prompt: withBase(
            "请基于这个假设生成分支。",
            "将当前假设和替代假设分别形成 Scenario，不覆盖当前轮次。",
          ),
        },
      ];
    case "inference":
      return [
        {
          label: "重新推理",
          actionId: "inference.recalculate",
          createsNewRound: true,
          prompt: withBase(
            "请重新推理这一段。",
            "只重算该 Inference 的下游节点，并说明依据、置信度和变化点。",
          ),
        },
        {
          label: "寻找反证",
          actionId: "inference.counterEvidence",
          createsNewRound: true,
          prompt: withBase(
            "请挑战这段推理。",
            "生成反证、替代解释和可能被影响的结论节点。",
          ),
        },
      ];
    case "risk":
      return [
        {
          label: "加入缓释措施",
          actionId: "risk.addMitigation",
          createsNewRound: true,
          prompt: withBase(
            "请为这个风险加入缓释措施。",
            "生成 Action 节点，并重新评估风险概率、影响和可控程度。",
          ),
        },
      ];
    case "decision":
      return [
        {
          label: "比较分支",
          actionId: "decision.compareBranches",
          createsNewRound: false,
          prompt: withBase(
            "请比较这个决策的所有分支。",
            "为每个分支生成对应 Scenario，并列出关键变量和阶段结论差异。",
          ),
        },
      ];
    case "action":
      return [
        {
          label: "模拟行动效果",
          actionId: "action.simulate",
          createsNewRound: true,
          prompt: withBase(
            "请模拟这个行动的效果。",
            "说明该 Action 会改变哪些变量、风险、推理链和情景路径。",
          ),
        },
      ];
    case "conclusion":
      return [
        {
          label: "挑战结论",
          actionId: "conclusion.challenge",
          createsNewRound: true,
          prompt: withBase(
            "请挑战这个阶段结论。",
            "生成反驳路径、支撑证据缺口和需要重新推理的节点。",
          ),
        },
      ];
    case "scenario":
      return [
        {
          label: "对比情景",
          actionId: "scenario.compareBaseline",
          createsNewRound: false,
          prompt: withBase(
            "请对比这个情景与 Baseline。",
            "高亮差异节点、差异边、关键变量、风险等级和阶段结论。",
          ),
        },
      ];
    case "evidence":
      return [
        {
          label: "核验证据",
          actionId: "evidence.verify",
          createsNewRound: false,
          prompt: withBase(
            "请核验这个证据。",
            "说明来源可信度、更新时间、引用位置，以及它支撑或削弱了哪些推理。",
          ),
        },
      ];
    default:
      return [];
  }
}

export function buildPathContinuePrompt(impactLines: string[]) {
  return composePromptLines([
    "我选择这条推演路径继续深挖：",
    ...impactLines,
    "请基于这条路径生成新一轮推演节点，并保留旧轮次可回看。",
    "路径选择属于硬选择点；如果当前图已保存，请生成新 Round，不要覆盖旧路径。",
  ]);
}

export function buildRiskInterventionPrompt({
  node,
  operation,
  riskLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  riskLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个风险节点生成新一轮推演：",
    `Risk ID：${node.id}`,
    `Risk：${node.label}`,
    `操作：${operation}`,
    ...riskLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注风险处置后哪些节点发生变化。",
  ]);
}

export function buildEventAssumptionPrompt({
  node,
  assumptionState,
  eventLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  assumptionState: string;
  eventLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个事件假设生成新一轮推演：",
    `Event ID：${node.id}`,
    `Event：${node.label}`,
    `假设状态：${assumptionState}`,
    ...eventLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注哪些节点因事件假设发生变化。",
  ]);
}

export function buildActionSimulationPrompt({
  node,
  actionState,
  actionLines,
  impactLines,
  instruction,
  confirmationLine,
}: {
  node: SimulationNode;
  actionState: string;
  actionLines: string[];
  impactLines: string[];
  instruction: string;
  confirmationLine: string;
}) {
  return composePromptLines([
    "请基于这个行动方案生成新一轮推演：",
    `Action ID：${node.id}`,
    `Action：${node.label}`,
    ...actionLines,
    `行动状态：${actionState}`,
    ...impactLines,
    instruction,
    confirmationLine,
  ]);
}

export function buildConclusionChallengePrompt({
  node,
  operation,
  conclusionLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  conclusionLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个阶段结论生成新一轮推演：",
    `Conclusion ID：${node.id}`,
    `Conclusion：${node.label}`,
    `操作：${operation}`,
    ...conclusionLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注结论挑战后哪些节点发生变化。",
  ]);
}

export function buildEvidenceUpdatePrompt({
  node,
  operation,
  evidenceLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  evidenceLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个证据节点生成新一轮推演：",
    `Evidence ID：${node.id}`,
    `Evidence：${node.label}`,
    `操作：${operation}`,
    ...evidenceLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注证据核验后哪些推理、风险或结论发生变化。",
  ]);
}

export function buildHypothesisInterventionPrompt({
  node,
  operation,
  hypothesisLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  hypothesisLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个假设节点生成新一轮推演：",
    `Hypothesis ID：${node.id}`,
    `Hypothesis：${node.label}`,
    `操作：${operation}`,
    ...hypothesisLines,
    ...impactLines,
    instruction,
    "请明确哪些下游节点需要重推，哪些节点只保留为历史对照。",
  ]);
}

export function buildInferenceReviewPrompt({
  node,
  operation,
  inferenceLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  inferenceLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个推理节点生成新一轮推演：",
    `Inference ID：${node.id}`,
    `Inference：${node.label}`,
    `操作：${operation}`,
    ...inferenceLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注哪些节点因推理复核发生变化。",
  ]);
}

export function buildVariableInterventionPrompt({
  node,
  operation,
  currentValue,
  defaultValue,
  nextValue,
  schemaLines,
  impactLines,
  instruction,
  confirmationLine,
}: {
  node: SimulationNode;
  operation: string;
  currentValue: string;
  defaultValue?: string;
  nextValue?: string;
  schemaLines: string[];
  impactLines: string[];
  instruction: string;
  confirmationLine: string;
}) {
  return composePromptLines([
    "请处理这个变量节点：",
    `变量 ID：${node.id}`,
    `变量名称：${node.label}`,
    `操作：${operation}`,
    `当前值：${currentValue || "未提供"}`,
    defaultValue ? `默认值：${defaultValue}` : "",
    nextValue ? `目标值：${nextValue}` : "",
    ...schemaLines,
    node.detail ? `变量说明：${node.detail}` : "",
    ...impactLines,
    instruction,
    confirmationLine,
  ]);
}

export function buildSummaryActionPrompt({
  summary,
  operation,
  instruction,
}: {
  summary: SimulationSummaryPart;
  operation: string;
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个推演总结继续：",
    `Summary ID：${summary.id}`,
    summary.roundId ? `Round ID：${summary.roundId}` : "",
    `操作：${operation}`,
    summary.conclusionIds?.length
      ? `关联结论：${summary.conclusionIds.join("、")}`
      : "",
    "本轮总结：",
    summary.markdown,
    instruction,
    "请保留旧轮次可回看，并标注总结动作会生成或影响哪些节点。",
  ]);
}

export function buildNextActionExecutionPrompt(nextAction: SimulationNextAction) {
  return composePromptLines([
    "请执行这条推演下一步动作：",
    `Action ID：${nextAction.actionId}`,
    `动作：${nextAction.title}`,
    `类型：${nextAction.actionType}`,
    nextAction.targetId ? `Target ID：${nextAction.targetId}` : "",
    nextAction.basedOnConclusionId
      ? `Based On Conclusion ID：${nextAction.basedOnConclusionId}`
      : "",
    nextAction.expectedEffect ? `预期效果：${nextAction.expectedEffect}` : "",
    nextAction.description,
    "请按 actionType 和 targetId 执行，不要把 Next Action 当成普通建议；如果会改变图状态，先说明影响预览并生成新 Round。",
  ]);
}

export function buildScenarioContinuePrompt(contextLines: string[]) {
  return composePromptLines([
    "我选择这个情景继续推演：",
    ...contextLines,
    "请基于该情景生成新一轮 Reasoning Graph，并保留旧轮次可回看。",
    "情景选择属于硬选择点；如果当前图已保存，请生成新 Round，不要覆盖旧情景。",
  ]);
}

export function buildScenarioComparePrompt(contextLines: string[]) {
  return composePromptLines([
    "请对比这个情景与 Baseline：",
    ...contextLines,
    "请输出差异节点、差异边、关键变量变化、风险等级差异和阶段结论差异。",
  ]);
}

export function buildScenarioCounterfactualPrompt(contextLines: string[]) {
  return composePromptLines([
    "请基于这个情景生成反事实推演：",
    ...contextLines,
    "请反转该情景中最关键的假设或事件，生成 Counterfactual Scenario，并高亮变化的变量、推理链、风险和阶段结论。",
  ]);
}

export function buildDeliverablesActionPrompt({
  deliverables,
  reportLabel,
  operation,
  primaryPath,
  instruction,
}: {
  deliverables: DeliverablesPart;
  reportLabel: string;
  operation: string;
  primaryPath?: string;
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个推演报告继续：",
    `Deliverables ID：${deliverables.id}`,
    `Deliverables Zone：${deliverables.zone}`,
    deliverables.headline ? `Headline：${deliverables.headline}` : "",
    `Report：${reportLabel}`,
    `操作：${operation}`,
    primaryPath ? `主文件：${primaryPath}` : "",
    deliverables.workspaceProjectId
      ? `Workspace Project：${deliverables.workspaceProjectId}`
      : "",
    deliverables.items.length
      ? `全部文件：${deliverables.items
          .map((deliverable) => deliverable.path)
          .join("、")}`
      : "",
    deliverables.items.length
      ? `文件明细：${deliverables.items
          .map((deliverable) =>
            [
              deliverable.path,
              deliverable.kind ? `kind=${deliverable.kind}` : "",
              deliverable.mime ? `mime=${deliverable.mime}` : "",
              deliverable.workspaceProjectId
                ? `project=${deliverable.workspaceProjectId}`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          )
          .join("；")}`
      : "",
    instruction,
    "请标注该报告动作会读取、更新或生成哪些 Output 节点，并保留旧轮次可回看。",
  ]);
}

export function buildRecoveryActionPrompt({
  error,
  topic,
  operation,
  nodeCount,
  pathStatusLabel,
  instruction,
}: {
  error: ErrorPart;
  topic: string;
  operation: string;
  nodeCount: number;
  pathStatusLabel: string;
  instruction: string;
}) {
  return composePromptLines([
    "请处理这个推演恢复节点：",
    `主题：${topic}`,
    `操作：${operation}`,
    `错误：${error.message}`,
    error.code ? `错误代码：${error.code}` : "",
    `已保存节点：${nodeCount}`,
    `路径状态：${pathStatusLabel}`,
    instruction,
    "请保留已有 Round / History，不要覆盖已保存快照；恢复后标注补齐了哪些节点。",
  ]);
}

export function buildPromptNodeActionPrompt({
  node,
  rawText,
  operation,
  parseStatus,
  topicLabel,
  instruction,
}: {
  node: SimulationNode;
  rawText: string;
  operation: string;
  parseStatus?: string | null;
  topicLabel: string;
  instruction: string;
}) {
  return composePromptLines([
    "请处理这个推演原问题：",
    `Prompt ID：${node.id}`,
    `原问题：${rawText}`,
    `操作：${operation}`,
    node.status ? `当前状态：${node.status}` : "",
    parseStatus ? `解析状态：${parseStatus}` : "",
    `当前 Topic：${topicLabel}`,
    instruction,
    "请保持 Prompt→Topic 的双节点关系，并标注问题层是否需要更新。",
  ]);
}

export function buildTopicBoundaryPrompt({
  node,
  operation,
  topicLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  topicLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  const confirmationInstruction =
    operation === "确认"
      ? "如果操作是确认：请先将 Topic 节点标记为 status=confirmed，并将 data.state 设置为 modeling_world；然后再生成世界模型层节点。"
      : operation === "继续"
        ? "如果操作是继续：请基于当前已确认世界模型生成下一轮推演，保留旧 Round 可回看，并明确新增节点、路径和结论变化。"
        : operation === "影响"
          ? "如果操作是查看影响：只输出影响范围分析，不修改图结构，也不要开始重算。"
          : "如果操作是修改或补充：只更新问题定义表单，保持 data.state=waiting_boundary_confirmation；若触及核心边界，必须等待用户确认生成新版世界模型，暂不要静默覆盖旧 Round。";
  return composePromptLines([
    "请基于这个问题定义节点继续推演：",
    `Topic ID：${node.id}`,
    `Topic：${node.label}`,
    `操作：${operation}`,
    ...topicLines,
    ...impactLines,
    instruction,
    confirmationInstruction,
    "请保留旧轮次可回看，并标注问题边界变化会影响哪些后续节点。",
  ]);
}

export function buildHistoryActionPrompt({
  label,
  roundId,
  operation,
  topicLabel,
  nodeCount,
  pathStatusLabel,
  interventionCount,
  interventionLines,
  instruction,
}: {
  label: string;
  roundId?: string;
  operation: string;
  topicLabel: string;
  nodeCount: number;
  pathStatusLabel: string;
  interventionCount: number;
  interventionLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请处理这个推演历史版本：",
    `History：${label}`,
    roundId ? `Round ID：${roundId}` : "",
    `操作：${operation}`,
    `当前主题：${topicLabel}`,
    `当前画布节点数：${nodeCount}`,
    `当前路径状态：${pathStatusLabel}`,
    `本轮干预数：${interventionCount}`,
    ...interventionLines.map((line) => `最近干预：${line}`),
    instruction,
    "请像 Git commit 一样保留历史，不要覆盖已有轮次；如继续推演，请生成新 Round 和 History 记录。",
  ]);
}

export function buildEntityModelingPrompt({
  node,
  operation,
  entityLines,
  impactLines,
  instruction,
}: {
  node: SimulationNode;
  operation: string;
  entityLines: string[];
  impactLines: string[];
  instruction: string;
}) {
  return composePromptLines([
    "请基于这个主体节点生成新一轮推演：",
    `Entity ID：${node.id}`,
    `Entity：${node.label}`,
    `操作：${operation}`,
    ...entityLines,
    ...impactLines,
    instruction,
    "请保留旧轮次可回看，并标注主体建模后哪些变量、事件或关系发生变化。",
  ]);
}

export function buildDecisionActionPrompt({
  node,
  operation,
  branchLines,
  impactLines,
  instruction,
  confirmationLine,
}: {
  node: SimulationNode;
  operation: string;
  branchLines: string[];
  impactLines: string[];
  instruction: string;
  confirmationLine: string;
}) {
  return composePromptLines([
    "请处理这个决策节点：",
    `Decision ID：${node.id}`,
    `Decision：${node.label}`,
    `操作：${operation}`,
    node.detail ? `决策说明：${node.detail}` : "",
    ...branchLines,
    ...impactLines,
    instruction,
    confirmationLine,
  ]);
}

export function buildDecisionBranchPrompt({
  node,
  branch,
  impactLines,
}: {
  node: SimulationNode;
  branch: DecisionBranchPrompt;
  impactLines: string[];
}) {
  return composePromptLines([
    "请基于这个决策分支生成新一轮推演：",
    `Decision ID：${node.id}`,
    `Decision：${node.label}`,
    `Branch ID：${branch.id}`,
    `选择分支：${branch.label}`,
    branch.scenarioId ? `Scenario ID：${branch.scenarioId}` : "",
    branch.detail ? `分支说明：${branch.detail}` : "",
    ...impactLines,
    "请为该分支生成或更新 Scenario、Action、Risk、Conclusion，并保留未选择分支用于对比。",
  ]);
}

"use client";

import {
  SimulationActionButton,
  SimulationActionMoreMenu,
  SimulationActionButtonRow,
} from "@/components/simulation/SimulationActionButtons";
import {
  buildDecisionActionPrompt,
  buildDecisionBranchPrompt,
  buildEntityModelingPrompt,
  buildHypothesisInterventionPrompt,
} from "@/components/simulation/SimulationPromptBuilders";
import type {
  CanvasActionFeedbackInput,
  InterventionImpact,
} from "@/components/simulation/canvas/canvasTypes";
import type { SimulationNode } from "@/lib/chat-parts";

export type SimulationDecisionBranch = {
  id: string;
  label: string;
  detail?: string;
  scenarioId?: string;
};

type PendingInterventionPayload = {
  title: string;
  targetNodeId: string;
  targetLabel: string;
  nextValue?: string;
  impactLines: string[];
  message: string;
  actionId?: string;
  targetKind?: string;
  createsNewRound?: boolean;
  oldRoundPreserved?: boolean;
  confirmLabel?: string;
};

type SimulationWorldChoicePanelProps = {
  node: SimulationNode;
  decisionBranches: SimulationDecisionBranch[];
  impactLines: string[];
  impact?: InterventionImpact | null;
  onContinueAsMessage?: (message: string) => void;
  onPendingIntervention: (payload: PendingInterventionPayload) => void;
  onActionFeedback: (input: CanvasActionFeedbackInput) => void;
};

function scalarText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

function valueText(node: SimulationNode, key: string): string | undefined {
  const value = node.data?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    return value.map((item) => scalarText(item)).filter(Boolean).join("、");
  }
  return undefined;
}

function firstValueText(node: SimulationNode, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = valueText(node, key);
    if (value) return value;
  }
  return undefined;
}

function percentText(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

export function SimulationWorldChoicePanel({
  node,
  decisionBranches,
  impactLines,
  impact,
  onContinueAsMessage,
  onPendingIntervention,
  onActionFeedback,
}: SimulationWorldChoicePanelProps) {
  if (!onContinueAsMessage) return null;

  if (node.type === "entity") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
        <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
          主体建模
        </div>
        <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
          <div>角色：{valueText(node, "role") ?? node.label}</div>
          {firstValueText(node, ["goal", "goals"]) ? (
            <div>目标：{firstValueText(node, ["goal", "goals"])}</div>
          ) : null}
          {firstValueText(node, ["variables", "variableIds"]) ? (
            <div>变量：{firstValueText(node, ["variables", "variableIds"])}</div>
          ) : null}
          {firstValueText(node, ["events", "eventIds"]) ? (
            <div>事件：{firstValueText(node, ["events", "eventIds"])}</div>
          ) : null}
        </div>
        <SimulationActionButtonRow>
	          {(() => {
              const items = [
	            {
	              label: "补充变量",
	              value: "补变量",
	              actionId: "entity.addVariable",
	              instruction:
	                "请围绕该主体补充关键 Variable，并说明这些变量如何影响下游推理、风险和情景。",
	            },
	            {
	              label: "分析关系",
	              value: "关系",
	              actionId: "entity.analyzeRelation",
	              instruction:
	                "请分析该主体影响谁、受到谁影响，并补齐主体之间的关系边和利益冲突。",
	            },
	            {
	              label: "补充事件",
	              value: "补事件",
	              actionId: "entity.addEvent",
	              instruction:
	                "请围绕该主体补充可能触发变量跳变的 Event，并给出 IF/THEN 关系。",
	            },
	          ];
              const renderItem = (item: (typeof items)[number]) => (
	            <SimulationActionButton
	              key={item.value}
	              actionId={item.actionId}
              onClick={() => {
                const entityLines = [
                  valueText(node, "role") ? `角色：${valueText(node, "role")}` : "",
                  firstValueText(node, ["goal", "goals"])
                    ? `利益目标：${firstValueText(node, ["goal", "goals"])}`
                    : "",
                  valueText(node, "affectedBy")
                    ? `受到影响：${valueText(node, "affectedBy")}`
                    : "",
                  firstValueText(node, ["influences", "affects"])
                    ? `影响对象：${firstValueText(node, ["influences", "affects"])}`
                    : "",
                  firstValueText(node, ["variables", "variableIds"])
                    ? `关联变量：${firstValueText(node, [
                        "variables",
                        "variableIds",
                      ])}`
                    : "",
                  firstValueText(node, ["events", "eventIds"])
                    ? `关联事件：${firstValueText(node, ["events", "eventIds"])}`
                    : "",
                ].filter(Boolean);
                onActionFeedback({
                  actionId: item.actionId,
                  title: `已请求${item.label}`,
                  body: "系统将围绕当前主体补齐世界模型关系，并标注影响对象。",
                  targetId: node.id,
                  targetLabel: node.label,
                  targetKind: "entity",
                  impact,
                  impactLines,
                  createsNewRound: false,
                  status: "sent",
                  autoCollapse: true,
                });
                onContinueAsMessage(
                  buildEntityModelingPrompt({
                    node,
                    operation: item.value,
                    entityLines,
                    impactLines,
                    instruction: item.instruction,
                  }),
                );
              }}
	            >
	              {item.label}
	            </SimulationActionButton>
	          );
              return (
                <>
                  {items.slice(0, 2).map(renderItem)}
                  <SimulationActionMoreMenu>
                    {items.slice(2).map(renderItem)}
                  </SimulationActionMoreMenu>
                </>
              );
            })()}
	        </SimulationActionButtonRow>
      </div>
    );
  }

  if (node.type === "decision" && decisionBranches.length > 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
        <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
          选择决策分支
        </div>
        <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
          <div>决策：{node.label}</div>
          <div>分支：{decisionBranches.map((branch) => branch.label).join(" / ")}</div>
        </div>
        <SimulationActionButtonRow>
	          {(() => {
              const items = [
	            {
	              label: "比较分支",
              value: "比较分支",
              actionId: "decision.compareBranches",
              instruction:
                "请比较所有决策分支的收益、损失、影响路径、风险、关键变量和阶段结论，不要先替用户选择。",
            },
            {
              label: "暂缓决策",
              value: "暂缓决策",
              actionId: "decision.defer",
              instruction:
                "请暂缓该决策，列出还需要补充的数据、证据、变量或情景，再生成 Next Action。",
            },
            {
              label: "补充决策变量",
              value: "补充决策变量",
              actionId: "decision.addVariable",
	              instruction:
	                "请为该决策补充会影响分支选择的关键 Variable / Evidence / Risk 节点，并说明它们如何改变分支判断。",
	            },
	          ];
              const renderItem = (item: (typeof items)[number]) => (
	            <SimulationActionButton
              key={item.value}
              actionId={item.actionId}
              onClick={() => {
                const branchLines = [
                  `可选分支：${decisionBranches
                    .map((branch) =>
                      branch.detail
                        ? `${branch.label}（${branch.detail}）`
                        : branch.label,
                    )
                    .join("；")}`,
                ];
                onActionFeedback({
                  actionId: item.actionId,
                  title: `已请求${item.label}`,
                  body:
                    item.value === "暂缓决策"
                      ? "系统将列出需要补充的数据、证据、变量或情景，不生成新 Round。"
                      : "系统将比较或补充决策变量，并标注受影响分支。",
                  targetId: node.id,
                  targetLabel: node.label,
                  targetKind: "decision",
                  impact,
                  impactLines,
                  createsNewRound: false,
                  status: "sent",
                  autoCollapse: true,
                });
                onContinueAsMessage(
                  buildDecisionActionPrompt({
                    node,
                    operation: item.value,
                    branchLines,
                    impactLines,
                    instruction: item.instruction,
                    confirmationLine:
                      item.value === "暂缓决策"
                        ? "暂缓不触发新 Round，只生成需要补齐的信息和下一步动作。"
                        : "请保留未选择分支作为对照，并标注会影响哪些 Scenario、Action、Risk 和 Conclusion。",
                  }),
                );
              }}
	            >
	              {item.label}
	            </SimulationActionButton>
	          );
              return (
                <>
                  {items.slice(0, 2).map(renderItem)}
                  <SimulationActionMoreMenu>
                    {items.slice(2).map(renderItem)}
                  </SimulationActionMoreMenu>
                </>
              );
            })()}
	        </SimulationActionButtonRow>
        <div className="mt-2 space-y-2">
          {decisionBranches.map((branch) => (
            <button
              key={branch.id}
              type="button"
              data-action-id="decision.selectBranch"
              data-behavior-type="confirm"
              data-target-kind="decision"
              onClick={() => {
                onPendingIntervention({
                  actionId: "decision.selectBranch",
                  targetKind: "decision",
                  title: "选择决策分支",
                  targetNodeId: node.id,
                  targetLabel: `${node.label} / ${branch.label}`,
                  impactLines: [
                    branch.scenarioId ? `目标情景：${branch.scenarioId}` : "",
                    branch.detail ? `分支说明：${branch.detail}` : "",
                    ...impactLines,
                  ].filter(Boolean),
                  message: buildDecisionBranchPrompt({
                    node,
                    branch,
                    impactLines,
                  }),
                  createsNewRound: true,
                  oldRoundPreserved: true,
                  confirmLabel: "确认选择分支",
                });
              }}
              className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-left text-xs text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
            >
              <span className="block font-medium text-[var(--fg)]">
                {branch.label}
              </span>
              {branch.detail ? (
                <span className="mt-1 block leading-5 text-[var(--fg-tertiary)]">
                  {branch.detail}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (node.type !== "hypothesis") return null;

  const hypothesisLines = [
    valueText(node, "statement") ? `当前假设：${valueText(node, "statement")}` : "",
    valueText(node, "scope") ? `适用范围：${valueText(node, "scope")}` : "",
    percentText(node.data?.confidence)
      ? `当前可信度：${percentText(node.data?.confidence)}`
      : "",
    `可生成分支：${node.data?.branchable === false ? "否" : "是"}`,
    `锁定状态：${node.locked || node.data?.locked ? "是" : "否"}`,
  ].filter(Boolean);

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
        假设分支
      </div>
      <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
        <div>当前：{valueText(node, "statement") ?? node.label}</div>
        {valueText(node, "scope") ? <div>范围：{valueText(node, "scope")}</div> : null}
        {percentText(node.data?.confidence) ? (
          <div>可信度：{percentText(node.data?.confidence)}</div>
        ) : null}
        <div>可分支：{node.data?.branchable === false ? "否" : "是"}</div>
        <div>锁定：{node.locked || node.data?.locked ? "是" : "否"}</div>
      </div>
      <SimulationActionButtonRow>
	        {(() => {
          const items = [
	          {
	            label: "替换假设",
            value: "替换",
            actionId: "hypothesis.replace",
            instruction:
              "请先说明该假设影响的变量、推理链、路径和结论，再等待我给出替代假设值。",
	          },
	          {
	            label: "生成分支",
	            value: "分支",
	            actionId: "hypothesis.branch",
	            instruction:
	              "请基于当前假设和一个合理替代假设生成 Scenario 分支，不覆盖当前路径，并保留旧轮次可回看。",
	          },
	          {
	            label: "锁定假设",
	            value: "锁定",
	            actionId: "hypothesis.lock",
	            instruction:
	              "请将该假设锁定为后续推演约束，说明它限制了哪些变量、风险和情景变化。",
	          },
	          {
	            label: "请求删除假设",
	            value: "删除",
	            actionId: "hypothesis.delete",
	            instruction:
	              "请先给出删除该假设的影响预览，列出会失去依据的推理、证据关系、情景路径和结论；等待用户确认后再生成新 Round。",
	          },
	        ];
          const renderItem = (item: (typeof items)[number]) => (
	          <SimulationActionButton
            key={item.value}
            actionId={item.actionId}
            onClick={() => {
              const message = buildHypothesisInterventionPrompt({
                node,
                operation: item.value,
                hypothesisLines,
                impactLines,
                instruction: item.instruction,
              });
              onPendingIntervention({
                actionId: item.actionId,
                targetKind: "hypothesis",
                title:
                  item.value === "删除"
                    ? "假设删除确认"
                    : item.value === "分支"
                      ? "假设分支确认"
                      : item.value === "锁定"
                        ? "假设锁定确认"
                        : "假设替换确认",
                targetNodeId: node.id,
                targetLabel: `${node.label} / ${item.value}`,
                impactLines: [...hypothesisLines, ...impactLines],
                message,
                createsNewRound: item.value !== "锁定",
                oldRoundPreserved: true,
                confirmLabel:
                  item.value === "删除"
                    ? "确认请求删除"
                    : item.value === "分支"
                      ? "确认生成分支"
                      : "确认继续",
              });
            }}
	          >
	            {item.label}
	          </SimulationActionButton>
	        );
          return (
            <>
              {items.slice(0, 2).map(renderItem)}
              <SimulationActionMoreMenu>
                {items.slice(2).map(renderItem)}
              </SimulationActionMoreMenu>
            </>
          );
        })()}
	      </SimulationActionButtonRow>
    </div>
  );
}

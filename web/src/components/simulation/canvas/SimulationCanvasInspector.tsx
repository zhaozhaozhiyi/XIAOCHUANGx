"use client";

import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { DeliverablesCard } from "@/components/chat/parts/DeliverablesCard";
import {
  SimulationActionButton,
  SimulationActionMoreMenu,
  SimulationActionButtonRow,
} from "@/components/simulation/SimulationActionButtons";
import { SimulationActionReceipt } from "@/components/simulation/SimulationActionReceipt";
import {
  SimulationImpactPreviewCard,
  SimulationStructuredInfoCard,
  type SimulationImpactGroup,
} from "@/components/simulation/SimulationDetailSections";
import { SimulationNodeInterventionPanel } from "@/components/simulation/SimulationNodeInterventionPanel";
import {
  SimulationPendingInterventionCard,
  type PendingIntervention,
} from "@/components/simulation/SimulationPendingInterventionCard";
import { SimulationQuestionLayerPanel } from "@/components/simulation/SimulationQuestionLayerPanel";
import { SimulationWorldChoicePanel, type SimulationDecisionBranch } from "@/components/simulation/SimulationWorldChoicePanel";
import {
  buildActionSimulationPrompt,
  buildConclusionChallengePrompt,
  buildDeliverablesActionPrompt,
  buildEvidenceUpdatePrompt,
  buildEventAssumptionPrompt,
  buildHistoryActionPrompt,
  buildInferenceReviewPrompt,
  buildNextActionExecutionPrompt,
  buildPathContinuePrompt,
  buildRecoveryActionPrompt,
  buildRiskInterventionPrompt,
  buildScenarioComparePrompt,
  buildScenarioContinuePrompt,
  buildScenarioCounterfactualPrompt,
  buildSummaryActionPrompt,
  type SimulationInterventionAction,
} from "@/components/simulation/SimulationPromptBuilders";
import type { SimulationNode, SimulationPath } from "@/lib/chat-parts";
import type {
  CanvasNodeData,
  CanvasActionFeedbackInput,
  CanvasActionReceipt,
  DetailRow,
  InterventionImpact,
  NormalizedScenario,
  Scenario,
  ScenarioDiff,
  ScenarioView,
} from "./canvasTypes";
import {
  formatInterventionImpact,
  interventionSummaryLines,
  nodeDataFirstValueText,
  nodeDataValueText,
  nodeKindLabel,
  pathContextLines,
  percentLabel,
  ratingLabel,
  scenarioContextLines,
  topicTitle,
} from "./canvasHelpers";

type SimulationCanvasInspectorProps = {
  embedded: boolean;
  selected: CanvasNodeData;
  selectedNode: SimulationNode | null;
  selectedPath: SimulationPath | null;
  selectedScenarioView: ScenarioView | null;
  selectedScenarioDiff: ScenarioDiff | null;
  selectedImpact: InterventionImpact | null;
  selectedImpactLines: string[];
  selectedNodeActions: SimulationInterventionAction[];
  selectedNodeDetailRows: DetailRow[];
  selectedImpactGroups: SimulationImpactGroup[];
  selectedDecisionBranches: SimulationDecisionBranch[];
  selectedRelatedPaths: SimulationPath[];
  pendingIntervention: PendingIntervention | null;
  actionReceipt: CanvasActionReceipt | null;
  effectiveSelectedNodeId: string | null;
  scenario: Scenario;
  normalizedScenario: NormalizedScenario;
  nodeCount: number;
  pathStatusLabel: string;
  variableDrafts: Record<string, string>;
  onContinueAsMessage?: (answer: string) => void;
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>;
  setPendingIntervention: Dispatch<SetStateAction<PendingIntervention | null>>;
  setVariableDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onActionFeedback: (input: CanvasActionFeedbackInput) => void;
  onDismissActionReceipt: () => void;
};

export function SimulationCanvasInspector({
  embedded,
  selected,
  selectedNode,
  selectedPath,
  selectedScenarioView,
  selectedScenarioDiff,
  selectedImpact,
  selectedImpactLines,
  selectedNodeActions,
  selectedNodeDetailRows,
  selectedImpactGroups,
  selectedDecisionBranches,
  selectedRelatedPaths,
  pendingIntervention,
  actionReceipt,
  effectiveSelectedNodeId,
  scenario,
  normalizedScenario,
  nodeCount,
  pathStatusLabel,
  variableDrafts,
  onContinueAsMessage,
  setSelectedNodeId,
  setPendingIntervention,
  setVariableDrafts,
  onActionFeedback,
  onDismissActionReceipt,
}: SimulationCanvasInspectorProps) {
  const inspectorFrameStyle = {
    maxHeight: embedded
      ? "calc(100% - var(--chat-composer-dock-h, 0px) - 1.5rem)"
      : "calc(100% - 1.5rem)",
  };
  const sendPromptAction = ({
    message,
    ...feedback
  }: CanvasActionFeedbackInput & { message: string }) => {
    if (!onContinueAsMessage) return;
    onActionFeedback(feedback);
    onContinueAsMessage(message);
  };

  return (
          <aside
            style={inspectorFrameStyle}
            className="absolute right-3 top-3 z-40 flex w-[min(400px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[color-mix(in_srgb,var(--border-strong)_76%,transparent)] bg-[color-mix(in_srgb,var(--surface-elevated)_94%,transparent)] shadow-[0_18px_50px_rgba(20,20,19,0.14)] backdrop-blur-xl"
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color-mix(in_srgb,var(--border)_82%,transparent)] px-3 py-3">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
                  节点详情
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-[var(--fg)]">
                  {selected.label}
                </div>
                <div className="mt-0.5 text-xs text-[var(--fg-tertiary)]">
                  {nodeKindLabel(selected.kind)}
                </div>
              </div>
              <button
                type="button"
                aria-label="关闭节点详情"
                data-simulation-inspector-close="true"
                onClick={() => setSelectedNodeId(null)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
              {selected.detail ? (
                <p className="text-sm leading-relaxed text-[var(--fg-secondary)]">
                  {selected.detail}
                </p>
              ) : (
                <p className="text-sm text-[var(--fg-tertiary)]">
                  暂无更多说明。
                </p>
              )}
              {selected.summary ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <ChatMarkdown markdown={selected.summary.markdown} />
                  {onContinueAsMessage ? (
                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                        总结操作
                      </div>
                      <SimulationActionButtonRow>
                        {[
	                          {
	                            label: "继续追问",
	                            value: "追问",
	                            actionId: "summary.followUp",
	                            instruction:
	                              "请基于本轮总结继续追问未确定因素，并生成需要新增或复核的节点。",
	                          },
	                          {
	                            label: "生成报告",
	                            value: "报告",
	                            actionId: "summary.generateReport",
	                            instruction:
	                              "请基于本轮总结生成可追溯报告，包含关键变量、证据、假设、风险、情景和结论来源。",
	                          },
	                          {
	                            label: "提取 Next Action",
	                            value: "下一步",
	                            actionId: "summary.extractNextActions",
	                            instruction:
	                              "请从本轮总结中提取 3 个可点击执行的 Next Action，分别指向补数据、重推理或生成报告。",
                          },
                        ].map((item) => (
	                          <SimulationActionButton
	                            key={item.value}
	                            actionId={item.actionId}
	                            onClick={() => {
	                              const summary = selected.summary;
	                              if (!summary) return;
	                              sendPromptAction({
	                                actionId: item.actionId,
	                                title: `已请求${item.label}`,
	                                body: "系统将基于本轮总结继续生成输出或下一步建议。",
	                                targetId: `summary:${summary.id}`,
	                                targetLabel: selected.label,
	                                targetKind: "summary",
	                                createsNewRound: false,
	                                status: "sent",
	                                autoCollapse: true,
	                                message: buildSummaryActionPrompt({
	                                  summary,
	                                  operation: item.value,
	                                  instruction: item.instruction,
	                                }),
	                              });
	                            }}
                          >
                            {item.label}
                          </SimulationActionButton>
                        ))}
                      </SimulationActionButtonRow>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {actionReceipt ? (
                <SimulationActionReceipt
                  receipt={actionReceipt}
                  onDismiss={onDismissActionReceipt}
                />
              ) : null}
              <SimulationStructuredInfoCard rows={selectedNodeDetailRows} />
              {selectedNode && selectedImpact ? (
                <SimulationImpactPreviewCard groups={selectedImpactGroups} />
              ) : null}
              {pendingIntervention?.targetNodeId === effectiveSelectedNodeId &&
              onContinueAsMessage ? (
                <SimulationPendingInterventionCard
                  intervention={pendingIntervention}
                  onConfirm={() => {
                    onActionFeedback({
                      actionId: pendingIntervention.actionId ?? "pending.confirm",
                      title: `${pendingIntervention.title}已确认`,
                      body: pendingIntervention.createsNewRound
                        ? "确认已发送，系统将生成新 Round 并保留旧 Round 可回看。"
                        : "确认已发送，系统将按当前上下文继续处理。",
                      targetId: pendingIntervention.targetNodeId,
                      targetLabel: pendingIntervention.targetLabel,
                      targetKind: pendingIntervention.targetKind,
                      impactLines: pendingIntervention.impactLines,
                      createsNewRound: pendingIntervention.createsNewRound,
                      oldRoundPreserved: pendingIntervention.oldRoundPreserved,
                      status: "sent",
                      autoCollapse: true,
                    });
                    onContinueAsMessage(pendingIntervention.message);
                    setPendingIntervention(null);
                  }}
                  onCancel={() => setPendingIntervention(null)}
                />
              ) : null}
              {selectedNode?.type === "prompt" || selectedNode?.type === "topic" ? (
                <SimulationQuestionLayerPanel
	                  node={selectedNode}
	                  topicLabel={normalizedScenario.topic.label}
	                  impactLines={selectedImpactLines}
	                  impact={selectedImpact}
                  hasWorldModel={
                    normalizedScenario.nodes.length > 0 ||
                    normalizedScenario.edges.length > 0 ||
                    normalizedScenario.topic.status === "confirmed"
                  }
                  onContinueAsMessage={onContinueAsMessage}
                  onPendingIntervention={setPendingIntervention}
                  onActionFeedback={onActionFeedback}
                />
              ) : null}
              {selected.kind === "history" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    版本操作
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>轮次：{selected.dependencyLabel ?? selected.label}</div>
                    <div>节点：{nodeCount} 个</div>
                    <div>路径：{pathStatusLabel}</div>
                    <div>干预：{normalizedScenario.interventions.length} 条</div>
                    {interventionSummaryLines(normalizedScenario.interventions).map(
                      (line) => (
                        <div key={line} className="break-words text-[var(--fg-tertiary)]">
                          {line}
                        </div>
                      ),
                    )}
                  </div>
                  <SimulationActionButtonRow>
                    {[
                          {
                            label: "对比最新",
                            value: "对比最新",
                            actionId: "history.compareLatest",
                            instruction:
                              "请对比该历史轮次与最新轮次，列出新增/删除/更新的节点、边、变量、风险和结论。",
                          },
                          {
                            label: "回到最新",
                            value: "回到最新",
                            actionId: "history.backToLatest",
                            instruction:
                              "请回到最新推演视图，并说明当前历史轮次与最新轮次的主要差异。",
                          },
                          {
                            label: "从此继续",
                            value: "从此继续",
                            actionId: "history.continueFrom",
                            instruction:
                              "请以该历史轮次为分支起点继续推演，生成新的 Round，并保留原最新轮次作为对照。",
                      },
	                    ].map((item) => (
	                      <SimulationActionButton
	                        key={item.value}
	                        actionId={item.actionId}
	                        onClick={() => {
                            const message = buildHistoryActionPrompt({
                              label: selected.label,
                              roundId: selected.dependencyLabel,
                              operation: item.value,
                              topicLabel: normalizedScenario.topic.label,
                              nodeCount,
                              pathStatusLabel,
                              interventionCount:
                                normalizedScenario.interventions.length,
                              interventionLines: interventionSummaryLines(
                                normalizedScenario.interventions,
                              ),
                              instruction: item.instruction,
                            });
                            if (item.actionId === "history.continueFrom") {
                              setPendingIntervention({
                                actionId: item.actionId,
                                targetKind: "history",
                                title: "历史轮次继续确认",
                                targetNodeId:
                                  effectiveSelectedNodeId ?? `history:${selected.label}`,
                                targetLabel: selected.label,
                                impactLines: [
                                  `历史轮次：${selected.dependencyLabel ?? selected.label}`,
                                  `当前节点：${nodeCount} 个`,
                                  `当前路径：${pathStatusLabel}`,
                                  "将从该历史轮次生成新分支或新 Round。",
                                ],
                                message,
                                createsNewRound: true,
                                oldRoundPreserved: true,
                                confirmLabel: "确认从此继续",
                              });
                              return;
                            }
                            sendPromptAction({
                              actionId: item.actionId,
                              title: `已请求${item.label}`,
                              body:
                                item.actionId === "history.backToLatest"
                                  ? "系统将回到最新推演视图，并说明历史轮次差异。"
                                  : "系统将对比该历史轮次与最新轮次的差异。",
                              targetId: effectiveSelectedNodeId ?? `history:${selected.label}`,
                              targetLabel: selected.label,
                              targetKind: "history",
                              createsNewRound: false,
                              status:
                                item.actionId === "history.backToLatest"
                                  ? "done"
                                  : "sent",
                              autoCollapse: true,
                              message,
                            });
                          }}
	                      >
	                        {item.label}
	                      </SimulationActionButton>
	                    ))}
                  </SimulationActionButtonRow>
                </div>
              ) : null}
              {selectedNode?.type === "entity" ||
              selectedNode?.type === "decision" ||
              selectedNode?.type === "hypothesis" ? (
                <SimulationWorldChoicePanel
	                  node={selectedNode}
	                  decisionBranches={selectedDecisionBranches}
	                  impactLines={selectedImpactLines}
	                  impact={selectedImpact}
                  onContinueAsMessage={onContinueAsMessage}
                  onPendingIntervention={setPendingIntervention}
                  onActionFeedback={onActionFeedback}
                />
              ) : null}
              {selectedNode?.type === "inference" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    推理复核
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>
                      依据：{nodeDataValueText(selectedNode, "rationale") ?? selectedNode.detail ?? selectedNode.label}
                    </div>
                    {percentLabel(selectedNode.data?.confidence) ? (
                      <div>可信度：{percentLabel(selectedNode.data?.confidence)}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "modelName") ||
                    nodeDataValueText(selectedNode, "model") ? (
                      <div>
                        模型：
                        {nodeDataValueText(selectedNode, "modelName") ??
                          nodeDataValueText(selectedNode, "model")}
                      </div>
                    ) : null}
                    {Array.isArray(selectedNode.data?.evidenceIds) ? (
                      <div>证据：{selectedNode.data.evidenceIds.length} 条引用</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "inputNodeIds") ? (
                      <div>
                        输入节点：{nodeDataValueText(selectedNode, "inputNodeIds")}
                      </div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "outputNodeIds") ? (
                      <div>
                        输出节点：{nodeDataValueText(selectedNode, "outputNodeIds")}
                      </div>
                    ) : null}
                  </div>
                  <SimulationActionButtonRow>
	                    {(() => {
                        const items = [
	                      {
	                        label: "查看证据",
                        value: "查看证据",
                        actionId: "inference.viewEvidence",
                        instruction:
                          "请列出支撑该 Inference 的 Evidence 节点、引用位置、可信度和原文摘要，并高亮可疑或缺失证据。",
                      },
                      {
                        label: "重新推理",
                        value: "重推",
                        actionId: "inference.recalculate",
                        instruction:
                          "请只重算该 Inference 及其下游节点，说明推理依据、置信度、证据引用和变化点。",
                      },
                      {
                        label: "寻找反证",
                        value: "反证",
                        actionId: "inference.counterEvidence",
	                        instruction:
	                          "请挑战这段推理，生成反证、替代解释、证据缺口，以及可能被影响的结论和情景。",
	                      },
	                    ];
                        const renderItem = (item: (typeof items)[number]) => (
	                      <SimulationActionButton
                        key={item.value}
                        actionId={item.actionId}
                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const inferenceLines = [
                            nodeDataValueText(selectedNode, "rationale")
                              ? `推理依据：${nodeDataValueText(selectedNode, "rationale")}`
                              : "",
                            percentLabel(selectedNode.data?.confidence)
                              ? `当前可信度：${percentLabel(selectedNode.data?.confidence)}`
                              : "",
                            nodeDataValueText(selectedNode, "modelName") ||
                            nodeDataValueText(selectedNode, "model")
                              ? `使用模型：${
                                  nodeDataValueText(selectedNode, "modelName") ??
                                  nodeDataValueText(selectedNode, "model")
                                }`
                              : "",
                            Array.isArray(selectedNode.data?.evidenceIds)
                              ? `证据 ID：${selectedNode.data.evidenceIds.join("、")}`
                              : "",
                            nodeDataValueText(selectedNode, "inputNodeIds")
                              ? `输入节点：${nodeDataValueText(selectedNode, "inputNodeIds")}`
                              : "",
                            nodeDataValueText(selectedNode, "outputNodeIds")
                              ? `输出节点：${nodeDataValueText(selectedNode, "outputNodeIds")}`
                              : "",
                            nodeDataValueText(selectedNode, "counterEvidence")
                              ? `已有反证线索：${nodeDataValueText(selectedNode, "counterEvidence")}`
                              : "",
                          ].filter(Boolean);
                          const message = buildInferenceReviewPrompt({
                            node: selectedNode,
                            operation: item.value,
                            inferenceLines,
                            impactLines,
                            instruction: item.instruction,
                          });
                          if (item.value === "重推" || item.value === "反证") {
                            setPendingIntervention({
                              actionId: item.actionId,
                              targetKind: "inference",
                              title:
                                item.value === "重推" ? "推理重算确认" : "推理反证确认",
                              targetNodeId: selectedNode.id,
                              targetLabel: `${selectedNode.label} / ${item.value}`,
                              impactLines: [...inferenceLines, ...impactLines],
                              message,
                              createsNewRound: true,
                              oldRoundPreserved: true,
                              confirmLabel: "确认并生成新 Round",
                            });
                            return;
                          }
	                          sendPromptAction({
	                            actionId: item.actionId,
	                            title: `已请求${item.label}`,
	                            body: "系统将列出支撑证据与引用位置，不重算当前推理链。",
	                            targetId: selectedNode.id,
	                            targetLabel: selectedNode.label,
	                            targetKind: "inference",
	                            impact: selectedImpact,
	                            impactLines,
	                            createsNewRound: false,
	                            status: "sent",
	                            autoCollapse: true,
	                            message,
	                          });
	                        }}
	                      >
	                        {item.label}
	                      </SimulationActionButton>
	                    );
                        return (
                          <>
                            {items.map(renderItem)}
                          </>
                        );
                      })()}
	                  </SimulationActionButtonRow>
                </div>
              ) : null}
              {selectedNode?.type === "risk" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    风险处置
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-xs">
                    {[
                      ["概率", percentLabel(selectedNode.data?.probability) ?? "待评估"],
                      ["影响", ratingLabel(selectedNode.data?.impact) ?? "待评估"],
                      [
                        "可控",
                        ratingLabel(selectedNode.data?.controllability) ?? "待评估",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 py-2"
                      >
                        <div className="text-[10px] text-[var(--fg-tertiary)]">
                          {label}
                        </div>
                        <div className="mt-1 font-medium text-[var(--fg)]">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>
                  {nodeDataValueText(selectedNode, "triggerSignal") ? (
                    <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                      触发信号：{nodeDataValueText(selectedNode, "triggerSignal")}
                    </div>
                  ) : null}
                  {nodeDataValueText(selectedNode, "affectedVariableIds") ||
                  nodeDataValueText(selectedNode, "affectedScenarioIds") ||
                  nodeDataValueText(selectedNode, "mitigationActionIds") ? (
                    <div className="mt-2 space-y-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                      {nodeDataValueText(selectedNode, "affectedVariableIds") ? (
                        <div>
                          影响变量：
                          {nodeDataValueText(selectedNode, "affectedVariableIds")}
                        </div>
                      ) : null}
                      {nodeDataValueText(selectedNode, "affectedScenarioIds") ? (
                        <div>
                          影响情景：
                          {nodeDataValueText(selectedNode, "affectedScenarioIds")}
                        </div>
                      ) : null}
                      {nodeDataValueText(selectedNode, "mitigationActionIds") ? (
                        <div>
                          缓释动作：
                          {nodeDataValueText(selectedNode, "mitigationActionIds")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <SimulationActionButtonRow>
	                    {(() => {
                        const items = [
	                      {
	                        label: "加入缓释措施",
                        value: "缓释",
                        actionId: "risk.addMitigation",
                        instruction:
	                          "请生成 Action 节点作为缓释措施，并重新评估风险概率、影响、可控程度和受影响情景。",
	                      },
	                      {
	                        label: "压力测试",
	                        value: "压力测试",
	                        actionId: "risk.stressTest",
	                        instruction:
	                          "请把该风险推到更极端情景，生成压力测试 Scenario，并标注最脆弱的变量、推理链和结论。",
	                      },
	                      {
	                        label: "生成预警变量",
	                        value: "预警",
	                        actionId: "risk.warningVariable",
	                        instruction:
	                          "请生成可监控的 Variable / Event 节点作为预警信号，说明触发阈值和对应处置动作。",
	                      },
	                    ];
                        const renderItem = (item: (typeof items)[number]) => (
	                      <SimulationActionButton
                        key={item.value}
                        actionId={item.actionId}
                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const riskLines = [
                            percentLabel(selectedNode.data?.probability)
                              ? `概率：${percentLabel(selectedNode.data?.probability)}`
                              : "",
                            ratingLabel(selectedNode.data?.impact)
                              ? `影响等级：${ratingLabel(selectedNode.data?.impact)}`
                              : "",
                            ratingLabel(selectedNode.data?.controllability)
                              ? `可控程度：${ratingLabel(selectedNode.data?.controllability)}`
                              : "",
                            nodeDataValueText(selectedNode, "triggerSignal")
                              ? `触发信号：${nodeDataValueText(selectedNode, "triggerSignal")}`
                              : "",
                            nodeDataValueText(selectedNode, "affectedVariableIds")
                              ? `影响变量：${nodeDataValueText(selectedNode, "affectedVariableIds")}`
                              : "",
                            nodeDataValueText(selectedNode, "affectedScenarioIds")
                              ? `影响情景：${nodeDataValueText(selectedNode, "affectedScenarioIds")}`
                              : "",
                            nodeDataValueText(selectedNode, "mitigationActionIds")
                              ? `已有缓释动作：${nodeDataValueText(selectedNode, "mitigationActionIds")}`
                              : "",
                          ].filter(Boolean);
                          setPendingIntervention({
                            actionId: item.actionId,
                            targetKind: "risk",
                            title: "风险处置确认",
                            targetNodeId: selectedNode.id,
                            targetLabel: `${selectedNode.label} / ${item.value}`,
                            impactLines: [...riskLines, ...impactLines],
                            message: buildRiskInterventionPrompt({
                              node: selectedNode,
                              operation: item.value,
                              riskLines,
                              impactLines,
                              instruction: item.instruction,
                            }),
                            createsNewRound: true,
                            oldRoundPreserved: true,
                            confirmLabel: "确认并生成新 Round",
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
              ) : null}
              {selectedNode?.type === "event" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    事件假设
                  </div>
                  <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>
                      IF：{nodeDataValueText(selectedNode, "condition") ?? selectedNode.label}
                    </div>
                    <div>
                      THEN：{nodeDataValueText(selectedNode, "scope") ?? "重新评估下游推理、风险和情景"}
                    </div>
                  </div>
                  <SimulationActionButtonRow>
                    {[
                      {
                        label: "假设发生",
                        value: "发生",
                        actionId: "event.assumeHappens",
                        instruction:
                          "请按该事件发生的 IF/THEN 条件重算下游 Inference、Risk、Decision、Action、Conclusion 和 Scenario。",
                      },
                      {
                        label: "假设未发生",
                        value: "未发生",
                        actionId: "event.assumeNotHappens",
                        instruction:
                          "请保留该事件为未发生假设，生成不发生时的替代路径，并说明与发生情景的差异。",
                      },
                    ].map((item) => (
                      <SimulationActionButton
                        key={item.value}
                        actionId={item.actionId}
                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const eventLines = [
                            nodeDataValueText(selectedNode, "condition")
                              ? `发生条件：${nodeDataValueText(selectedNode, "condition")}`
                              : "",
                            nodeDataValueText(selectedNode, "scope")
                              ? `影响范围：${nodeDataValueText(selectedNode, "scope")}`
                              : "",
                            nodeDataValueText(selectedNode, "variables")
                              ? `影响变量：${nodeDataValueText(selectedNode, "variables")}`
                              : "",
                            nodeDataValueText(selectedNode, "actors")
                              ? `影响主体：${nodeDataValueText(selectedNode, "actors")}`
                              : "",
                            percentLabel(selectedNode.data?.probability)
                              ? `发生概率：${percentLabel(selectedNode.data?.probability)}`
                              : "",
                          ].filter(Boolean);
                          setPendingIntervention({
                            actionId: item.actionId,
                            targetKind: "event",
                            title: "事件假设确认",
                            targetNodeId: selectedNode.id,
                            targetLabel: `${selectedNode.label} / ${item.value}`,
                            impactLines: [...eventLines, ...impactLines],
                            message: buildEventAssumptionPrompt({
                              node: selectedNode,
                              assumptionState: item.value,
                              eventLines,
                              impactLines,
                              instruction: item.instruction,
                            }),
                            createsNewRound: true,
                            oldRoundPreserved: true,
                            confirmLabel: "确认并生成新 Round",
                          });
                        }}
                      >
                        {item.label}
                      </SimulationActionButton>
                    ))}
                  </SimulationActionButtonRow>
                </div>
              ) : null}
              {selectedNode?.type === "action" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    行动模拟
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    {nodeDataValueText(selectedNode, "actionType") ? (
                      <div>
                        动作类型：{nodeDataValueText(selectedNode, "actionType")}
                      </div>
                    ) : null}
                    <div>
                      对象：{nodeDataValueText(selectedNode, "target") ?? selectedNode.label}
                    </div>
                    {nodeDataValueText(selectedNode, "condition") ? (
                      <div>
                        执行条件：{nodeDataValueText(selectedNode, "condition")}
                      </div>
                    ) : null}
                    <div>
                      预期：{nodeDataValueText(selectedNode, "expectedEffect") ?? selectedNode.detail ?? "重新评估行动效果"}
                    </div>
                    {nodeDataValueText(selectedNode, "cost") ? (
                      <div>成本：{nodeDataValueText(selectedNode, "cost")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "sideEffects") ? (
                      <div>
                        潜在副作用：{nodeDataValueText(selectedNode, "sideEffects")}
                      </div>
                    ) : null}
                  </div>
                  <SimulationActionButtonRow>
	                    {(() => {
                        const items = [
	                      {
	                        label: "模拟执行",
                        value: "执行",
                        actionId: "action.simulate",
                        instruction:
                          "请将该 Action 作为用户准备采取的措施，重新模拟它对变量、风险、推理链、情景路径和阶段结论的影响。",
                      },
                      {
                        label: "对比不执行",
                        value: "不执行",
                        actionId: "action.compareNotDoing",
                        instruction:
                          "请生成该 Action 不执行时的对照情景，并与执行情景比较风险、成本、变量和结论差异。",
                      },
                      {
                        label: "修改行动",
                        value: "修改行动",
                        actionId: "action.edit",
                        instruction:
                          "请先给出这个 Action 的可编辑版本，包括执行对象、执行条件、成本、预期效果和可能替代方案，等待用户确认后再重算。",
                      },
                      {
	                        label: "补充执行条件",
                        value: "补充条件",
                        actionId: "action.addCondition",
                        instruction:
                          "请补充该 Action 成立所需的前置条件、资源约束、时间窗口和触发阈值，并生成相关 Variable / Event 节点。",
                      },
                      {
                        label: "评估副作用",
                        value: "评估副作用",
                        actionId: "action.evaluateSideEffects",
	                        instruction:
	                          "请评估该 Action 的副作用，生成新增 Risk、受影响变量、反事实情景和需要监控的 Next Action。",
	                      },
	                    ];
                        const renderItem = (item: (typeof items)[number]) => (
	                      <SimulationActionButton
                        key={item.value}
                        actionId={item.actionId}
                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const actionLines = [
                            nodeDataValueText(selectedNode, "actionType")
                              ? `Action Type：${nodeDataValueText(selectedNode, "actionType")}`
                              : "",
                            nodeDataValueText(selectedNode, "target")
                              ? `作用对象：${nodeDataValueText(selectedNode, "target")}`
                              : "",
                            nodeDataValueText(selectedNode, "condition")
                              ? `执行条件：${nodeDataValueText(selectedNode, "condition")}`
                              : "",
                            nodeDataValueText(selectedNode, "expectedEffect")
                              ? `预期效果：${nodeDataValueText(selectedNode, "expectedEffect")}`
                              : "",
                            nodeDataValueText(selectedNode, "cost")
                              ? `执行成本：${nodeDataValueText(selectedNode, "cost")}`
                              : "",
                            nodeDataValueText(selectedNode, "sideEffects")
                              ? `潜在副作用：${nodeDataValueText(selectedNode, "sideEffects")}`
                              : "",
                          ].filter(Boolean);
                          const message = buildActionSimulationPrompt({
                            node: selectedNode,
                            actionState: item.value,
                            actionLines,
                            impactLines,
                            instruction: item.instruction,
                            confirmationLine:
                              item.value === "执行" || item.value === "不执行"
                                ? "请保留旧轮次可回看，并标注哪些节点因行动假设发生变化。"
                                : "不要静默重算；先说明行动修改会影响哪些节点，并给出需要用户确认的下一步。",
                          });
                          if (item.value === "执行" || item.value === "不执行") {
                            setPendingIntervention({
                              actionId: item.actionId,
                              targetKind: "action",
                              title:
                                item.value === "执行" ? "模拟行动执行" : "对比不执行",
                              targetNodeId: selectedNode.id,
                              targetLabel: selectedNode.label,
                              impactLines,
                              message,
                              createsNewRound: true,
                              oldRoundPreserved: true,
                              confirmLabel: "确认并生成新 Round",
                            });
                            return;
                          }
	                          sendPromptAction({
	                            actionId: item.actionId,
	                            title: `已请求${item.label}`,
	                            body:
	                              item.value === "补充条件"
	                                ? "系统将补充行动成立所需前置条件、资源约束和触发阈值。"
	                                : item.value === "评估副作用"
	                                  ? "系统将评估副作用并标注可能新增的风险与变量。"
	                                  : "系统将先给出行动的可编辑版本，等待用户确认后再重算。",
	                            targetId: selectedNode.id,
	                            targetLabel: selectedNode.label,
	                            targetKind: "action",
	                            impact: selectedImpact,
	                            impactLines,
	                            createsNewRound: false,
	                            status: "sent",
	                            autoCollapse: true,
	                            message,
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
              ) : null}
              {selectedNode?.type === "conclusion" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    结论挑战
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>结论：{selectedNode.label}</div>
                    {nodeDataFirstValueText(selectedNode, ["variableIds", "variables"]) ? (
                      <div>
                        变量：
                        {nodeDataFirstValueText(selectedNode, ["variableIds", "variables"])}
                      </div>
                    ) : null}
                    {nodeDataFirstValueText(selectedNode, ["evidenceIds", "evidence"]) ? (
                      <div>
                        证据：
                        {nodeDataFirstValueText(selectedNode, ["evidenceIds", "evidence"])}
                      </div>
                    ) : null}
                    {nodeDataFirstValueText(selectedNode, ["hypothesisIds", "assumptions"]) ? (
                      <div>
                        假设：
                        {nodeDataFirstValueText(selectedNode, [
                          "hypothesisIds",
                          "assumptions",
                        ])}
                      </div>
                    ) : null}
                    {nodeDataFirstValueText(selectedNode, ["riskIds", "risks"]) ? (
                      <div>
                        风险：{nodeDataFirstValueText(selectedNode, ["riskIds", "risks"])}
                      </div>
                    ) : null}
                    {nodeDataFirstValueText(selectedNode, ["scenarioIds", "scenarios"]) ? (
                      <div>
                        情景：
                        {nodeDataFirstValueText(selectedNode, ["scenarioIds", "scenarios"])}
                      </div>
                    ) : null}
                  </div>
                  <SimulationActionButtonRow>
	                    {(() => {
                        const items = [
	                      {
	                        label: "挑战结论",
	                        value: "挑战",
	                        actionId: "conclusion.challenge",
	                        instruction:
	                          "请挑战这个阶段结论，生成反驳路径、支撑证据缺口和需要重新推理的节点。",
	                      },
	                      {
	                        label: "生成报告",
	                        value: "报告",
	                        actionId: "conclusion.report",
	                        instruction:
	                          "请围绕该阶段结论生成可追溯报告段落，列出变量、证据、假设、风险和情景路径来源。",
	                      },
	                      {
	                        label: "要求反驳",
	                        value: "反驳",
	                        actionId: "conclusion.refute",
	                        instruction:
	                          "请站在相反立场反驳该结论，指出最弱假设、最敏感变量和可能逆转结论的事件。",
	                      },
	                    ];
                        const renderItem = (item: (typeof items)[number]) => (
	                      <SimulationActionButton
	                        key={item.value}
	                        actionId={item.actionId}
	                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const conclusionLines = [
                            selectedNode.detail ? `结论说明：${selectedNode.detail}` : "",
                            nodeDataFirstValueText(selectedNode, [
                              "variableIds",
                              "variables",
                            ])
                              ? `来源变量：${nodeDataFirstValueText(selectedNode, [
                                  "variableIds",
                                  "variables",
                                ])}`
                              : "",
                            nodeDataFirstValueText(selectedNode, ["evidenceIds", "evidence"])
                              ? `引用证据：${nodeDataFirstValueText(selectedNode, [
                                  "evidenceIds",
                                  "evidence",
                                ])}`
                              : "",
                            nodeDataFirstValueText(selectedNode, [
                              "hypothesisIds",
                              "assumptions",
                            ])
                              ? `依赖假设：${nodeDataFirstValueText(selectedNode, [
                                  "hypothesisIds",
                                  "assumptions",
                                ])}`
                              : "",
                            nodeDataFirstValueText(selectedNode, ["riskIds", "risks"])
                              ? `关联风险：${nodeDataFirstValueText(selectedNode, [
                                  "riskIds",
                                  "risks",
                                ])}`
                              : "",
                            nodeDataFirstValueText(selectedNode, [
                              "scenarioIds",
                              "scenarios",
                            ])
                              ? `关联情景：${nodeDataFirstValueText(selectedNode, [
                                  "scenarioIds",
                                  "scenarios",
                                ])}`
                              : "",
                          ].filter(Boolean);
                          const message = buildConclusionChallengePrompt({
                            node: selectedNode,
                            operation: item.value,
                            conclusionLines,
                            impactLines,
                            instruction: item.instruction,
                          });
                          if (item.value === "挑战" || item.value === "反驳") {
	                            setPendingIntervention({
	                              actionId: item.actionId,
	                              targetKind: "conclusion",
	                              title:
	                                item.value === "挑战"
	                                  ? "结论挑战确认"
	                                  : "结论反驳确认",
	                              targetNodeId: selectedNode.id,
	                              targetLabel: `${selectedNode.label} / ${item.value}`,
	                              impactLines: [...conclusionLines, ...impactLines],
	                              message,
	                              createsNewRound: true,
	                              oldRoundPreserved: true,
	                              confirmLabel: "确认并生成新 Round",
	                            });
	                            return;
	                          }
	                          sendPromptAction({
	                            actionId: item.actionId,
	                            title: "已请求生成报告段落",
	                            body: "系统将围绕该阶段结论生成可追溯报告段落，不直接改写世界模型。",
	                            targetId: selectedNode.id,
	                            targetLabel: selectedNode.label,
	                            targetKind: "conclusion",
	                            impact: selectedImpact,
	                            impactLines,
	                            createsNewRound: false,
	                            status: "sent",
	                            autoCollapse: true,
	                            message,
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
              ) : null}
              {selectedNode?.type === "evidence" && onContinueAsMessage ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    证据核验
                  </div>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>
                      来源：{selectedNode.evidenceSource ?? nodeDataValueText(selectedNode, "source") ?? selectedNode.label}
                    </div>
                    {selectedNode.evidenceCredibility ? (
                      <div>可信度：{selectedNode.evidenceCredibility}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "updatedAt") ? (
                      <div>更新：{nodeDataValueText(selectedNode, "updatedAt")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "url") ? (
                      <div>原文：{nodeDataValueText(selectedNode, "url")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "page") ? (
                      <div>页码：{nodeDataValueText(selectedNode, "page")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "quoteLocation") ? (
                      <div>引用：{nodeDataValueText(selectedNode, "quoteLocation")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "quote") ? (
                      <div>摘录：{nodeDataValueText(selectedNode, "quote")}</div>
                    ) : null}
                    {nodeDataValueText(selectedNode, "citedByNodeIds") ? (
                      <div>
                        引用节点：{nodeDataValueText(selectedNode, "citedByNodeIds")}
                      </div>
                    ) : null}
                  </div>
                  <SimulationActionButtonRow>
	                    {(() => {
                        const items = [
	                      {
	                        label: "核验证据",
	                        value: "核验",
	                        actionId: "evidence.verify",
	                        instruction:
	                          "请核验该证据的来源可信度、更新时间、引用位置，并说明它支撑或削弱了哪些推理。",
	                      },
	                      {
	                        label: "请求定位原文",
	                        value: "打开原文",
	                        actionId: "evidence.locateSource",
	                        instruction:
	                          "请定位该证据的原文资料，给出可追溯位置；如果是 PDF，请定位页码或章节，不要承诺直接打开文件。",
	                      },
	                      {
	                        label: "定位引用",
	                        value: "定位",
	                        actionId: "evidence.locateCitation",
	                        instruction:
	                          "请定位该证据的原文引用位置，并生成可追溯引用说明。",
	                      },
	                      {
	                        label: "查找反例",
	                        value: "反例",
	                        actionId: "evidence.counterExample",
	                        instruction:
	                          "请寻找可能削弱该证据的反例、冲突数据或证据缺口，并标注受影响推理。",
	                      },
	                      {
	                        label: "寻找替代证据",
	                        value: "替换证据",
	                        actionId: "evidence.replace",
	                        instruction:
	                          "请提出可替换该证据的更高可信度来源，并说明替换后哪些 Inference、Risk、Conclusion 需要重算。",
	                      },
	                      {
	                        label: "补充证据",
	                        value: "补充证据",
	                        actionId: "evidence.supplement",
	                        instruction:
	                          "请补充 2-3 条互相独立的证据来源，标注可信度、更新时间、引用位置和支撑/削弱的节点。",
	                      },
	                    ];
                        const renderItem = (item: (typeof items)[number]) => (
	                      <SimulationActionButton
	                        key={item.value}
	                        actionId={item.actionId}
	                        onClick={() => {
                          const impactLines = formatInterventionImpact(selectedImpact);
                          const evidenceLines = [
                            selectedNode.evidenceSource
                              ? `来源：${selectedNode.evidenceSource}`
                              : "",
                            selectedNode.evidenceCredibility
                              ? `可信度：${selectedNode.evidenceCredibility}`
                              : "",
                            nodeDataValueText(selectedNode, "updatedAt")
                              ? `更新时间：${nodeDataValueText(selectedNode, "updatedAt")}`
                              : "",
                            nodeDataValueText(selectedNode, "url")
                              ? `原文链接：${nodeDataValueText(selectedNode, "url")}`
                              : "",
                            nodeDataValueText(selectedNode, "page")
                              ? `页码：${nodeDataValueText(selectedNode, "page")}`
                              : "",
                            nodeDataValueText(selectedNode, "quoteLocation")
                              ? `引用位置：${nodeDataValueText(selectedNode, "quoteLocation")}`
                              : "",
                            nodeDataValueText(selectedNode, "quote")
                              ? `原文摘录：${nodeDataValueText(selectedNode, "quote")}`
                              : "",
                            nodeDataValueText(selectedNode, "citationCount")
                              ? `引用次数：${nodeDataValueText(selectedNode, "citationCount")}`
                              : "",
                            nodeDataValueText(selectedNode, "citedByNodeIds")
                              ? `引用节点：${nodeDataValueText(selectedNode, "citedByNodeIds")}`
                              : "",
                          ].filter(Boolean);
                          const message = buildEvidenceUpdatePrompt({
                            node: selectedNode,
                            operation: item.value,
                            evidenceLines,
                            impactLines,
                            instruction: item.instruction,
                          });
	                          if (
	                            item.value === "反例" ||
	                            item.value === "替换证据" ||
	                            item.value === "补充证据"
	                          ) {
	                            setPendingIntervention({
	                              actionId: item.actionId,
	                              targetKind: "evidence",
	                              title: "证据更新确认",
	                              targetNodeId: selectedNode.id,
	                              targetLabel: `${selectedNode.label} / ${item.value}`,
	                              impactLines: [...evidenceLines, ...impactLines],
	                              message,
	                              createsNewRound: item.value === "替换证据",
	                              oldRoundPreserved: true,
	                              confirmLabel:
	                                item.value === "替换证据"
	                                  ? "确认寻找替代证据"
	                                  : "确认继续",
	                            });
	                            return;
	                          }
	                          sendPromptAction({
	                            actionId: item.actionId,
	                            title: `已请求${item.label}`,
	                            body:
	                              item.actionId === "evidence.locateSource"
	                                ? "系统将给出原文位置、页码、章节或 URL，不承诺直接打开文件。"
	                                : "系统将核验证据来源、更新时间和引用位置。",
	                            targetId: selectedNode.id,
	                            targetLabel: selectedNode.label,
	                            targetKind: "evidence",
	                            impact: selectedImpact,
	                            impactLines,
	                            createsNewRound: false,
	                            status: "sent",
	                            autoCollapse: true,
	                            message,
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
              ) : null}
              {selected.suggestion ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    {selected.suggestion.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--fg-secondary)]">
                    {selected.suggestion.description}
                  </p>
                  {onContinueAsMessage ? (
	                    <SimulationActionButton
	                      actionId="suggestion.continue"
	                      className="mt-3"
	                      onClick={() => {
	                        const message = [
	                          "请基于这条推演建议继续生成下一轮节点：",
	                          `建议：${selected.suggestion?.title}`,
	                          selected.suggestion?.description ?? "",
	                        ]
	                          .filter(Boolean)
	                          .join("\n");
	                        sendPromptAction({
	                          actionId: "suggestion.continue",
	                          title: "已请求基于建议继续",
	                          body: "系统将基于这条推演建议继续生成下一轮节点。",
	                          targetId: selected.suggestion
	                            ? `suggestion:${selected.suggestion.suggestionId}`
	                            : undefined,
	                          targetLabel: selected.suggestion?.title ?? selected.label,
	                          targetKind: "suggestion",
	                          createsNewRound: false,
	                          status: "sent",
	                          autoCollapse: true,
	                          message,
	                        });
	                      }}
	                    >
	                      基于建议继续
	                    </SimulationActionButton>
	                  ) : null}
                </div>
              ) : null}
              {selected.nextAction ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    {selected.nextAction.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--fg-secondary)]">
                    {selected.nextAction.description}
                  </p>
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>动作类型：{selected.nextAction.actionType}</div>
                    {selected.nextAction.targetId ? (
                      <div>目标节点：{selected.nextAction.targetId}</div>
                    ) : null}
                    {selected.nextAction.expectedEffect ? (
                      <div>预期效果：{selected.nextAction.expectedEffect}</div>
                    ) : null}
                  </div>
                  {onContinueAsMessage ? (
                    <button
                      type="button"
                      data-action-id="nextAction.execute"
                      data-behavior-type="confirm"
                      data-target-kind="next_action"
                      className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
                      onClick={() => {
                        if (!selected.nextAction) return;
                        setPendingIntervention({
                          actionId: "nextAction.execute",
                          targetKind: "next_action",
                          title: "执行 Next Action",
                          targetNodeId:
                            effectiveSelectedNodeId ??
                            selected.nextAction.targetId ??
                            `next-action:${selected.nextAction.actionId}`,
                          targetLabel: selected.nextAction.title,
                          impactLines: [
                            `动作类型：${selected.nextAction.actionType}`,
                            selected.nextAction.targetId
                              ? `目标节点：${selected.nextAction.targetId}`
                              : "",
                            selected.nextAction.expectedEffect
                              ? `预期效果：${selected.nextAction.expectedEffect}`
                              : "",
                          ].filter(Boolean),
                          message: buildNextActionExecutionPrompt(selected.nextAction),
                          createsNewRound: true,
                          oldRoundPreserved: true,
                          confirmLabel: "确认执行",
                        });
                      }}
                    >
	                      执行 Next Action
	                    </button>
                  ) : null}
                </div>
              ) : null}
              {selectedScenarioView ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <div className="text-sm font-medium text-[var(--fg)]">
                    {selectedScenarioView.label}
                  </div>
                  {selectedScenarioView.summary ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--fg-secondary)]">
                      {selectedScenarioView.summary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--fg-tertiary)]">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      {selectedScenarioView.nodeIds.length} 节点
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      {selectedScenarioView.edgeIds.length} 边
                    </span>
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                      {selectedScenarioView.pathIds.length} 路径
                    </span>
                    {selectedScenarioView.probability != null ? (
                      <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                        {Math.round(selectedScenarioView.probability * 100)}%
                      </span>
                    ) : null}
                  </div>
                  {selectedScenarioDiff ? (
                    <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                        相对 {selectedScenarioDiff.baseline?.label ?? "Baseline"} 的差异
                      </div>
                      <div className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--fg-secondary)]">
                        {[
                          ["新增节点", selectedScenarioDiff.addedNodes],
                          ["缺失节点", selectedScenarioDiff.removedNodes],
                          ["新增边", selectedScenarioDiff.addedEdges],
                          ["缺失边", selectedScenarioDiff.removedEdges],
                          ["新增路径", selectedScenarioDiff.addedPaths],
                          ["缺失路径", selectedScenarioDiff.removedPaths],
                        ].map(([label, values]) => {
                          const items = values as string[];
                          return items.length > 0 ? (
                            <div
                              key={label as string}
                              className="grid grid-cols-[56px_minmax(0,1fr)] gap-2"
                            >
                              <span className="text-[var(--fg-tertiary)]">
                                {label as string}
                              </span>
                              <span className="min-w-0 break-words">
                                {items.join("、")}
                              </span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : null}
                  {onContinueAsMessage ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        data-action-id="scenario.continue"
                        data-behavior-type="confirm"
                        data-target-kind="scenario"
                        onClick={() => {
                          const contextLines = scenarioContextLines(
                            selectedScenarioView,
                            selectedScenarioDiff,
                          );
                          setPendingIntervention({
                            actionId: "scenario.continue",
                            targetKind: "scenario",
                            title: "情景继续推演",
                            targetNodeId: `scenario:${selectedScenarioView.id}`,
                            targetLabel: selectedScenarioView.label,
                            impactLines: [
                              selectedScenarioView.nodeIds.length
                                ? `涉及节点：${selectedScenarioView.nodeIds.length} 个`
                                : "",
                              selectedScenarioView.edgeIds.length
                                ? `涉及边：${selectedScenarioView.edgeIds.length} 条`
                                : "",
                              selectedScenarioView.pathIds.length
                                ? `涉及路径：${selectedScenarioView.pathIds.join("、")}`
                                : "",
                              selectedScenarioDiff?.baseline
                                ? `对照情景：${selectedScenarioDiff.baseline.label}`
                                : "",
                            ].filter(Boolean),
                            message: buildScenarioContinuePrompt(contextLines),
                            createsNewRound: true,
                            oldRoundPreserved: true,
                            confirmLabel: "确认并生成新 Round",
                          });
                        }}
                        className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
	                      >
	                        基于此情景继续推演
	                      </button>
                      <button
                        type="button"
                        data-action-id="scenario.compareBaseline"
                        data-behavior-type="prompt"
                        data-target-kind="scenario"
	                        onClick={() => {
	                          const contextLines = scenarioContextLines(
	                            selectedScenarioView,
	                            selectedScenarioDiff,
	                          );
	                          sendPromptAction({
	                            actionId: "scenario.compareBaseline",
	                            title: "已请求对比 Baseline",
	                            body: "系统将输出差异节点、差异边、关键变量变化、风险等级差异和阶段结论差异。",
	                            targetId: `scenario:${selectedScenarioView.id}`,
	                            targetLabel: selectedScenarioView.label,
	                            targetKind: "scenario",
	                            impactSummary: {
	                              nodes: selectedScenarioView.nodeIds.length,
	                              edges: selectedScenarioView.edgeIds.length,
	                              paths: selectedScenarioView.pathIds.length,
	                              scenarios: 1,
	                            },
	                            createsNewRound: false,
	                            status: "sent",
	                            autoCollapse: true,
	                            message: buildScenarioComparePrompt(contextLines),
	                          });
	                        }}
                        className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
                      >
                        对比 Baseline
                      </button>
	                      <SimulationActionMoreMenu>
	                        <button
	                        type="button"
	                        data-action-id="scenario.counterfactual"
                        data-behavior-type="confirm"
                        data-target-kind="scenario"
                        onClick={() => {
                          const contextLines = scenarioContextLines(
                            selectedScenarioView,
                            selectedScenarioDiff,
                          );
                          setPendingIntervention({
                            actionId: "scenario.counterfactual",
                            targetKind: "scenario",
                            title: "生成反事实情景",
                            targetNodeId: `scenario:${selectedScenarioView.id}`,
                            targetLabel: selectedScenarioView.label,
                            impactLines: [
                              "将反转该情景中的关键假设或事件",
                              selectedScenarioView.pathIds.length
                                ? `原情景路径：${selectedScenarioView.pathIds.join("、")}`
                                : "",
                              selectedScenarioDiff?.addedNodes.length
                                ? `当前差异节点：${selectedScenarioDiff.addedNodes.join("、")}`
                                : "",
                            ].filter(Boolean),
                            message: buildScenarioCounterfactualPrompt(contextLines),
                            createsNewRound: true,
                            oldRoundPreserved: true,
                            confirmLabel: "确认生成反事实",
                          });
                        }}
                        className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
	                      >
	                        生成反事实
	                      </button>
	                      </SimulationActionMoreMenu>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selected.deliverables ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
                  <DeliverablesCard part={selected.deliverables} />
                  {onContinueAsMessage ? (
                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                        报告操作
                      </div>
                      <SimulationActionButtonRow>
	                        {(() => {
                          const items = [
		                          {
		                            label: "更新报告",
	                            value: "更新",
	                            actionId: "deliverables.updateReport",
		                            instruction:
		                              "请基于当前 Reasoning Graph 更新这份报告，保留变量、证据、假设、风险、情景和结论的可追溯引用。",
		                          },
		                          {
	                            label: "提取摘要",
	                            value: "摘要",
	                            actionId: "deliverables.extractSummary",
	                            instruction:
	                              "请从这份报告中提取一页执行摘要，并列出需要回到画布继续干预的节点。",
	                          },
	                          {
	                            label: "生成演示稿大纲",
	                            value: "演示稿",
	                            actionId: "deliverables.deckOutline",
	                            instruction:
	                              "请把这份报告转成演示稿大纲，按问题边界、世界模型、关键变量、情景对比、风险和 Next Action 组织。",
	                          },
	                        ];
                          const renderItem = (item: (typeof items)[number]) => (
	                          <SimulationActionButton
	                            key={item.value}
	                            actionId={item.actionId}
	                            onClick={() => {
	                              const deliverables = selected.deliverables;
	                              if (!deliverables) return;
                              const primaryPath =
                                deliverables.primaryPath ??
                                deliverables.items[0]?.path ??
                                selected.label;
	                              sendPromptAction({
	                                actionId: item.actionId,
	                                title: `已请求${item.label}`,
	                                body:
	                                  item.actionId === "deliverables.deckOutline"
	                                    ? "系统将生成演示稿大纲或结构，不承诺已生成 PPTX 文件。"
	                                    : "系统将基于当前报告继续生成可追溯输出。",
	                                targetId: `deliverables:${deliverables.id}`,
	                                targetLabel: selected.label,
	                                targetKind: "deliverables",
	                                createsNewRound: false,
	                                status: "sent",
	                                autoCollapse: true,
	                                message: buildDeliverablesActionPrompt({
	                                  deliverables,
	                                  reportLabel: selected.label,
	                                  operation: item.value,
	                                  primaryPath,
	                                  instruction: item.instruction,
	                                }),
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
                  ) : null}
                </div>
              ) : null}
              {selected.error ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-3 py-3">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    恢复操作
                  </div>
                  <div className="text-sm font-medium text-[var(--fg)]">
                    {selected.error.message}
                  </div>
                  {selected.error.code ? (
                    <div className="mt-1 font-mono text-xs text-[var(--fg-tertiary)]">
                      {selected.error.code}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--danger-muted)]/30 bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
                    <div>主题：{topicTitle(scenario)}</div>
                    <div>已保存节点：{nodeCount} 个</div>
                    <div>可恢复路径：{pathStatusLabel}</div>
                  </div>
                  {onContinueAsMessage ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[
	                        {
	                          label: "重试本轮",
	                          value: "重试本轮",
	                          actionId: "recovery.retryRound",
	                          instruction:
	                            "请重试失败的本轮生成，优先补齐中断前未完成的节点、路径、总结或报告。",
	                        },
	                        {
	                          label: "查看已保存内容",
	                          value: "查看已保存内容",
	                          actionId: "recovery.viewSaved",
	                          instruction:
	                            "请先列出当前已保存的 Prompt、Topic、关键节点、路径、Summary、Report 和缺失部分，不要直接继续生成。",
	                        },
	                        {
	                          label: "基于快照重新开始",
	                          value: "基于快照重新开始",
	                          actionId: "recovery.restartFromSnapshot",
	                          instruction:
	                            "请基于当前已保存快照重新开始本轮推演，说明中断前已完成到哪一步，再继续生成缺失内容。",
                        },
	                      ].map((item) => (
	                        <SimulationActionButton
	                          key={item.value}
	                          actionId={item.actionId}
	                          onClick={() => {
	                            const error = selected.error;
	                            if (!error) return;
	                            const message = buildRecoveryActionPrompt({
	                              error,
	                              topic: topicTitle(scenario),
	                              operation: item.value,
	                              nodeCount,
	                              pathStatusLabel,
	                              instruction: item.instruction,
	                            });
	                            if (item.actionId === "recovery.restartFromSnapshot") {
	                              setPendingIntervention({
	                                actionId: item.actionId,
	                                targetKind: "recovery",
	                                title: "基于快照重新开始确认",
	                                targetNodeId:
	                                  effectiveSelectedNodeId ?? `recovery:${error.code ?? error.message}`,
	                                targetLabel: selected.label,
	                                impactLines: [
	                                  `错误：${error.message}`,
	                                  `已保存节点：${nodeCount} 个`,
	                                  `路径状态：${pathStatusLabel}`,
	                                  "将基于当前快照重新开始补齐，不覆盖已有历史。",
	                                ],
	                                message,
	                                createsNewRound: true,
	                                oldRoundPreserved: true,
	                                confirmLabel: "确认重新开始",
	                              });
	                              return;
	                            }
	                            sendPromptAction({
	                              actionId: item.actionId,
	                              title: `已请求${item.label}`,
	                              body:
	                                item.actionId === "recovery.viewSaved"
	                                  ? "系统将只列出已保存内容和缺失部分，不继续生成。"
	                                  : "系统将重试失败轮次并优先补齐中断内容。",
	                              targetId:
	                                effectiveSelectedNodeId ?? `recovery:${error.code ?? error.message}`,
	                              targetLabel: selected.label,
	                              targetKind: "recovery",
	                              createsNewRound: false,
	                              status: "sent",
	                              autoCollapse: true,
	                              message,
	                            });
	                          }}
	                        >
	                          {item.label}
	                        </SimulationActionButton>
	                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {selectedNode ? (
                <SimulationNodeInterventionPanel
                  node={selectedNode}
                  nodeTypeLabel={nodeKindLabel(selectedNode.type)}
	                  variableDrafts={variableDrafts}
	                  impactLines={selectedImpactLines}
	                  impact={selectedImpact}
	                  actions={selectedNodeActions}
                  onDraftChange={(nodeId, value) =>
                    setVariableDrafts((prev) => ({
                      ...prev,
                      [nodeId]: value,
                    }))
                  }
                  onContinueAsMessage={onContinueAsMessage}
                  onPendingIntervention={setPendingIntervention}
                  onActionFeedback={onActionFeedback}
                />
              ) : null}
              {selectedPath?.probability != null ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    判断权重
                  </div>
                  <div className="mt-1 text-sm text-[var(--fg)]">
                    {Math.round(selectedPath.probability * 100)}%
                  </div>
                </div>
              ) : null}
              {selectedPath && onContinueAsMessage ? (
                <button
                  type="button"
                  data-action-id="path.continue"
                  data-behavior-type="confirm"
                  data-target-kind="path"
                  onClick={() => {
                    const impactLines = pathContextLines(
                      selectedPath,
                      normalizedScenario.scenarioViews,
                      normalizedScenario.edges,
                    );
                    setPendingIntervention({
                      actionId: "path.continue",
                      targetKind: "path",
                      title: "路径继续推演",
                      targetNodeId: `path:${selectedPath.id}`,
                      targetLabel: selectedPath.label,
                      impactLines,
                      message: buildPathContinuePrompt(impactLines),
                      createsNewRound: true,
                      oldRoundPreserved: true,
                      confirmLabel: "确认并生成新 Round",
                    });
                  }}
                  className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
	                >
	                  基于此路径继续推演
	                </button>
              ) : null}
              {selectedRelatedPaths.length > 0 ? (
                <div>
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    影响路径
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedRelatedPaths.map((path) => (
                      <span
                        key={path.id}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[11px] text-[var(--fg-secondary)]"
                      >
                        {path.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedNode?.evidenceSource ? (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
                  <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                    证据来源
                  </div>
                  <div className="mt-1 text-sm text-[var(--fg-secondary)]">
                    {selectedNode.evidenceSource}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
  );
}

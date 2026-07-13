"use client";

import { useState } from "react";
import {
  SimulationActionButton,
  SimulationActionButtonRow,
} from "@/components/simulation/SimulationActionButtons";
import { SimulationBoundaryEditCard } from "@/components/simulation/SimulationBoundaryEditCard";
import {
  buildPromptNodeActionPrompt,
  buildTopicBoundaryPrompt,
} from "@/components/simulation/SimulationPromptBuilders";
import type { PendingIntervention } from "@/components/simulation/SimulationPendingInterventionCard";
import type {
  CanvasActionFeedbackInput,
  InterventionImpact,
} from "@/components/simulation/canvas/canvasTypes";
import type { SimulationNode } from "@/lib/chat-parts";

type SimulationQuestionLayerPanelProps = {
  node: SimulationNode;
  topicLabel: string;
  impactLines: string[];
  impact?: InterventionImpact | null;
  hasWorldModel?: boolean;
  onContinueAsMessage?: (message: string) => void;
  onPendingIntervention?: (payload: PendingIntervention) => void;
  onActionFeedback?: (input: CanvasActionFeedbackInput) => void;
};

function valueText(node: SimulationNode, key: string): string | undefined {
  const value = node.data?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.length > 0) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (item == null) return "";
        return JSON.stringify(item);
      })
      .filter(Boolean)
      .join("、");
  }
  return undefined;
}

const WORLD_MODEL_AVAILABLE_STATES = new Set([
  "modeling_world",
  "identifying_variables",
  "generating_scenarios",
  "waiting_next_action",
  "completed",
  "confirmed",
]);

export function SimulationQuestionLayerPanel({
  node,
  topicLabel,
  impactLines,
  impact,
  hasWorldModel = false,
  onContinueAsMessage,
  onPendingIntervention,
  onActionFeedback,
}: SimulationQuestionLayerPanelProps) {
  const [boundaryEditorOpen, setBoundaryEditorOpen] = useState(false);

  if (!onContinueAsMessage) return null;

  if (node.type === "prompt") {
    const rawText = valueText(node, "rawText") ?? node.detail ?? node.label;

    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
        <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
          原问题操作
        </div>
        <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
          <div>原文：{rawText}</div>
          {valueText(node, "sentAt") ? <div>发送：{valueText(node, "sentAt")}</div> : null}
        </div>
        <SimulationActionButtonRow>
          {[
            {
              label: "重新解析",
              value: "重新解析",
              actionId: "prompt.reparse",
              instruction:
                "请重新解析用户原问题，生成新的 Topic 问题定义节点，并说明与当前 Topic 的边界差异。",
            },
            {
              label: "修改原问题",
              value: "修改",
              actionId: "prompt.edit",
              instruction:
                "请先基于当前原问题给出可编辑版本，并提示用户补充或替换关键条件。",
            },
            {
              label: "停止当前推演起点",
              value: "取消",
              actionId: "prompt.stop",
              instruction:
                "请停止基于该原问题继续推演，保留当前画布历史，并返回可重新输入的状态。",
            },
          ].map((item) => (
            <SimulationActionButton
              key={item.value}
              actionId={item.actionId}
              onClick={() =>
                {
                  const message = buildPromptNodeActionPrompt({
                    node,
                    rawText,
                    operation: item.value,
                    parseStatus: valueText(node, "parseStatus"),
                    topicLabel,
                    instruction: item.instruction,
                  });
	                  if (item.actionId === "prompt.stop" && onPendingIntervention) {
                    onPendingIntervention({
                      actionId: item.actionId,
                      targetKind: "prompt",
                      title: "停止当前推演起点",
                      targetNodeId: node.id,
                      targetLabel: node.label,
                      impactLines: ["停止后不会继续基于该起点生成世界模型。"],
                      message,
                      createsNewRound: false,
                      oldRoundPreserved: true,
                      confirmLabel: "确认停止",
                    });
	                    return;
	                  }
                  onActionFeedback?.({
                    actionId: item.actionId,
                    title: `已请求${item.label}`,
                    body:
                      item.actionId === "prompt.reparse"
                        ? "系统将重新解析原问题，并生成新的 Topic 问题定义候选。"
                        : "系统将先给出可编辑版本，等待用户补充或替换关键条件。",
                    targetId: node.id,
                    targetLabel: node.label,
                    targetKind: "prompt",
                    createsNewRound: false,
                    status: "sent",
                    autoCollapse: true,
                  });
	                  onContinueAsMessage(message);
	                }
	              }
            >
              {item.label}
            </SimulationActionButton>
          ))}
        </SimulationActionButtonRow>
      </div>
    );
  }

  if (node.type !== "topic") return null;

  const topicLines = [
    `问题：${valueText(node, "problem") ?? node.label}`,
    `推演目标：${valueText(node, "goal") ?? "待确认"}`,
    `时间范围：${valueText(node, "timeRange") ?? "待确认"}`,
    `空间范围：${valueText(node, "spaceRange") ?? "待确认"}`,
    `行业：${valueText(node, "industry") ?? "待确认"}`,
    `状态：${valueText(node, "state") ?? "waiting_boundary_confirmation"}`,
  ];
  const topicState = valueText(node, "state");
  const hasExistingWorldModel =
    hasWorldModel ||
    node.status === "confirmed" ||
    WORLD_MODEL_AVAILABLE_STATES.has(topicState ?? "");
  const topicActions = hasExistingWorldModel
    ? [
        {
          label: "编辑边界",
          value: "修改",
          actionId: "topic.editBoundary",
          instruction:
            "请先给出可编辑的问题边界方案。若修改时间、空间、行业、目标、核心主体、关键变量或初始假设，必须提示用户确认生成新版世界模型；不要静默覆盖旧 Round。",
        },
        {
          label: "查看影响",
          value: "影响",
          actionId: "topic.viewImpact",
          instruction:
            "请只说明当前 Topic 边界影响哪些主体、变量、路径、情景和结论，不要开始重算。",
        },
        {
          label: "继续推演",
          value: "继续",
          actionId: "topic.continue",
          instruction:
            "请基于当前已确认世界模型继续生成下一轮推演，保留旧 Round 可回看，并说明本轮新增节点、路径和结论变化。",
        },
      ]
    : [
        {
          label: "生成世界模型",
          value: "确认",
          actionId: "topic.generateWorldModel",
          instruction:
            "用户已确认该问题定义。请从 Topic 继续生成世界模型层：Entity、Variable、Hypothesis、Inference，并保留 Prompt→Topic 的问题层关系。输出的 Topic 必须标记 status=confirmed，data.state=modeling_world。",
        },
        {
          label: "编辑边界",
          value: "修改",
          actionId: "topic.editBoundary",
          instruction:
            "请只更新问题定义表单字段，继续保持 data.state=waiting_boundary_confirmation，暂不要生成 Entity、Variable、Hypothesis 或 Scenario。",
        },
        {
          label: "补充边界条件",
          value: "补充",
          actionId: "topic.addBoundaryCondition",
          instruction:
            "请根据补充条件更新问题边界，并说明哪些主体、变量和路径可能因此变化。",
        },
      ];

  return (
    <div
      data-question-layer-panel="true"
      data-topic-state={topicState ?? "unknown"}
      data-world-model-state={hasExistingWorldModel ? "available" : "missing"}
      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3"
    >
      <div className="text-[11px] font-medium text-[var(--fg-tertiary)]">
        问题边界
      </div>
      <div className="mt-2 space-y-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs leading-5 text-[var(--fg-secondary)]">
        <div>问题：{valueText(node, "problem") ?? node.label}</div>
        <div>目标：{valueText(node, "goal") ?? "待确认"}</div>
        <div>时间：{valueText(node, "timeRange") ?? "待确认"}</div>
        <div>空间：{valueText(node, "spaceRange") ?? "待确认"}</div>
        <div>行业：{valueText(node, "industry") ?? "待确认"}</div>
      </div>
      <SimulationActionButtonRow>
        {topicActions.map((item) => (
          <SimulationActionButton
            key={item.value}
            actionId={item.actionId}
	            onClick={() => {
              if (item.actionId === "topic.editBoundary") {
                setBoundaryEditorOpen(true);
                return;
              }
	              const message = buildTopicBoundaryPrompt({
                node,
                operation: item.value,
                topicLines,
                impactLines,
                instruction: item.instruction,
              });
	              if (item.actionId === "topic.continue" && onPendingIntervention) {
                onPendingIntervention({
                  actionId: item.actionId,
                  targetKind: "topic",
                  title: "继续推演确认",
                  targetNodeId: node.id,
                  targetLabel: node.label,
                  impactLines: [
                    "将基于当前已确认世界模型进入下一轮推演。",
                    ...impactLines,
                  ],
                  message,
                  createsNewRound: true,
                  oldRoundPreserved: true,
                  confirmLabel: "确认并继续推演",
                });
	                return;
	              }
              onActionFeedback?.({
                actionId: item.actionId,
                title:
                  item.actionId === "topic.generateWorldModel"
                    ? "已请求生成世界模型"
                    : item.actionId === "topic.viewImpact"
                      ? "已请求查看影响"
                      : "已请求补充边界条件",
                body:
                  item.actionId === "topic.generateWorldModel"
                    ? "系统将从当前问题边界生成 World Model v1 / Round 1。"
                    : item.actionId === "topic.viewImpact"
                      ? "系统将只分析当前问题边界影响范围，不重算全图。"
                      : "系统将判断补充内容是边界备注还是核心边界变化。",
                targetId: node.id,
                targetLabel: node.label,
                targetKind: "topic",
                impact,
                impactLines,
                createsNewRound: item.actionId === "topic.generateWorldModel",
                oldRoundPreserved: hasExistingWorldModel,
                status: "sent",
                autoCollapse: item.actionId !== "topic.viewImpact",
              });
	              onContinueAsMessage(message);
	            }}
	          >
	            {item.label}
	          </SimulationActionButton>
	        ))}
	      </SimulationActionButtonRow>
      {boundaryEditorOpen ? (
        <SimulationBoundaryEditCard
          node={node}
          hasWorldModel={hasExistingWorldModel}
          impactLines={impactLines}
          onCancel={() => setBoundaryEditorOpen(false)}
          onContinueAsMessage={onContinueAsMessage}
          onPendingIntervention={onPendingIntervention}
          onActionFeedback={onActionFeedback}
        />
      ) : null}
	    </div>
	  );
	}

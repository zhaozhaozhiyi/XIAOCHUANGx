"use client";

import {
  SimulationActionButton,
  SimulationActionButtonRow,
} from "@/components/simulation/SimulationActionButtons";
import {
  buildPromptNodeActionPrompt,
  buildTopicBoundaryPrompt,
} from "@/components/simulation/SimulationPromptBuilders";
import type { SimulationNode } from "@/lib/chat-parts";

type SimulationQuestionLayerPanelProps = {
  node: SimulationNode;
  topicLabel: string;
  impactLines: string[];
  onContinueAsMessage?: (message: string) => void;
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

export function SimulationQuestionLayerPanel({
  node,
  topicLabel,
  impactLines,
  onContinueAsMessage,
}: SimulationQuestionLayerPanelProps) {
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
              instruction:
                "请重新解析用户原问题，生成新的 Topic 问题定义节点，并说明与当前 Topic 的边界差异。",
            },
            {
              label: "修改原问题",
              value: "修改",
              instruction:
                "请先基于当前原问题给出可编辑版本，并提示用户补充或替换关键条件。",
            },
            {
              label: "取消创建",
              value: "取消",
              instruction:
                "请停止基于该原问题继续推演，保留当前画布历史，并返回可重新输入的状态。",
            },
          ].map((item) => (
            <SimulationActionButton
              key={item.value}
              onClick={() =>
                onContinueAsMessage(
                  buildPromptNodeActionPrompt({
                    node,
                    rawText,
                    operation: item.value,
                    parseStatus: valueText(node, "parseStatus"),
                    topicLabel,
                    instruction: item.instruction,
                  }),
                )
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

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3">
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
        {[
          {
            label: "确认进入世界模型",
            value: "确认",
            instruction:
              "用户已确认该问题定义。请从 Topic 继续生成世界模型层：Entity、Variable、Hypothesis、Inference，并保留 Prompt→Topic 的问题层关系。输出的 Topic 必须标记 status=confirmed，data.state=modeling_world。",
          },
          {
            label: "修改边界",
            value: "修改",
            instruction:
              "请先指出当前 Topic 的边界字段如何调整，并生成可修改的问题定义节点，暂不覆盖旧边界。",
          },
          {
            label: "补充条件",
            value: "补充",
            instruction:
              "请根据补充条件更新问题边界，并说明哪些主体、变量和路径可能因此变化。",
          },
        ].map((item) => (
          <SimulationActionButton
            key={item.value}
            onClick={() =>
              onContinueAsMessage(
                buildTopicBoundaryPrompt({
                  node,
                  operation: item.value,
                  topicLines,
                  impactLines,
                  instruction: item.instruction,
                }),
              )
            }
          >
            {item.label}
          </SimulationActionButton>
        ))}
      </SimulationActionButtonRow>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  buildTopicBoundaryPrompt,
  composePromptLines,
} from "@/components/simulation/SimulationPromptBuilders";
import type { PendingIntervention } from "@/components/simulation/SimulationPendingInterventionCard";
import type {
  CanvasActionFeedbackInput,
  SimulationBoundaryChange,
  SimulationBoundaryDraft,
} from "@/components/simulation/canvas/canvasTypes";
import type { SimulationNode } from "@/lib/chat-parts";

type SimulationBoundaryEditCardProps = {
  node: SimulationNode;
  hasWorldModel: boolean;
  impactLines: string[];
  onCancel: () => void;
  onContinueAsMessage?: (message: string) => void;
  onPendingIntervention?: (payload: PendingIntervention) => void;
  onActionFeedback?: (input: CanvasActionFeedbackInput) => void;
};

const FIELD_META: Array<{
  field: keyof SimulationBoundaryDraft;
  label: string;
  core: boolean;
  multiline?: boolean;
}> = [
  { field: "question", label: "问题", core: true, multiline: true },
  { field: "goal", label: "推演目标", core: true },
  { field: "timeRange", label: "时间范围", core: true },
  { field: "spaceRange", label: "空间范围", core: true },
  { field: "industry", label: "行业", core: true },
  { field: "actors", label: "核心主体", core: true },
  { field: "keyVariables", label: "关键变量", core: true, multiline: true },
  {
    field: "initialAssumptions",
    label: "初始假设",
    core: true,
    multiline: true,
  },
  { field: "note", label: "补充说明", core: false, multiline: true },
];

function fieldText(node: SimulationNode, key: string): string {
  const value = node.data?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
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
  return "";
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildInitialDraft(node: SimulationNode): SimulationBoundaryDraft {
  return {
    question: fieldText(node, "problem") || node.label,
    goal: fieldText(node, "goal"),
    timeRange: fieldText(node, "timeRange"),
    spaceRange: fieldText(node, "spaceRange"),
    industry: fieldText(node, "industry"),
    actors: fieldText(node, "actors") || fieldText(node, "coreActors"),
    keyVariables:
      fieldText(node, "keyVariables") || fieldText(node, "variables"),
    initialAssumptions:
      fieldText(node, "initialAssumptions") || fieldText(node, "assumptions"),
    note: fieldText(node, "boundaryNote") || fieldText(node, "note"),
  };
}

function diffBoundaryDraft(
  initial: SimulationBoundaryDraft,
  draft: SimulationBoundaryDraft,
): SimulationBoundaryChange[] {
  return FIELD_META.flatMap((meta) => {
    const before = normalizeText(initial[meta.field]);
    const after = normalizeText(draft[meta.field]);
    if (before === after) return [];
    return [
      {
        field: meta.field,
        label: meta.label,
        before: initial[meta.field],
        after: draft[meta.field],
        core: meta.core,
      },
    ];
  });
}

function boundaryLinesFromDraft(draft: SimulationBoundaryDraft): string[] {
  return [
    `问题：${draft.question || "待确认"}`,
    `推演目标：${draft.goal || "待确认"}`,
    `时间范围：${draft.timeRange || "待确认"}`,
    `空间范围：${draft.spaceRange || "待确认"}`,
    `行业：${draft.industry || "待确认"}`,
    `核心主体：${draft.actors || "待确认"}`,
    `关键变量：${draft.keyVariables || "待确认"}`,
    `初始假设：${draft.initialAssumptions || "待确认"}`,
    draft.note ? `补充说明：${draft.note}` : "",
  ].filter(Boolean);
}

function changeLines(changes: SimulationBoundaryChange[]): string[] {
  return changes.map((change) =>
    [
      `${change.core ? "核心边界" : "补充说明"}变化：${change.label}`,
      change.before ? `原值=${change.before}` : "原值=空",
      change.after ? `新值=${change.after}` : "新值=空",
    ].join("；"),
  );
}

export function SimulationBoundaryEditCard({
  node,
  hasWorldModel,
  impactLines,
  onCancel,
  onContinueAsMessage,
  onPendingIntervention,
  onActionFeedback,
}: SimulationBoundaryEditCardProps) {
  const initialDraft = useMemo(() => buildInitialDraft(node), [node]);
  const [draft, setDraft] = useState<SimulationBoundaryDraft>(initialDraft);
  const changes = useMemo(
    () => diffBoundaryDraft(initialDraft, draft),
    [draft, initialDraft],
  );
  const coreChanges = changes.filter((change) => change.core);
  const hasCoreChange = coreChanges.length > 0;
  const hasAnyChange = changes.length > 0;
  const shouldGenerateNewWorldModel = hasWorldModel && hasCoreChange;

  const submit = () => {
    if (!hasAnyChange) {
      onActionFeedback?.({
        actionId: "topic.editBoundary",
        targetId: node.id,
        targetLabel: node.label,
        targetKind: "topic",
        title: "未检测到边界变化",
        body: "当前字段与原问题边界一致，未向 Agent 发送新请求。",
        status: "done",
        createsNewRound: false,
        oldRoundPreserved: true,
      });
      return;
    }

    const updatedBoundaryLines = boundaryLinesFromDraft(draft);
    const changesForPrompt = changeLines(changes);
    const message = buildTopicBoundaryPrompt({
      node,
      operation: shouldGenerateNewWorldModel ? "生成新版世界模型" : "修改",
      topicLines: [...updatedBoundaryLines, ...changesForPrompt],
      impactLines,
      instruction: shouldGenerateNewWorldModel
        ? "用户修改了核心问题边界。请先生成 World Model vNext / Round N+1，保留旧 Round 可回看，并在返回中标注新旧边界差异。"
        : "请只更新 Topic 问题边界字段或保存为边界备注；不要生成新版世界模型，不要重算全图。",
    });

    if (shouldGenerateNewWorldModel && onPendingIntervention) {
      onPendingIntervention({
        actionId: "topic.generateWorldModelNext",
        targetKind: "topic",
        title: "生成新版世界模型确认",
        targetNodeId: node.id,
        targetLabel: node.label,
        impactLines: [
          ...changeLines(coreChanges),
          "核心边界变化会生成 World Model vNext / Round N+1。",
          ...impactLines,
        ],
        message,
        createsNewRound: true,
        oldRoundPreserved: true,
        confirmLabel: "生成新版世界模型",
        cancelLabel: "取消",
      });
      onCancel();
      return;
    }

    onActionFeedback?.({
      actionId: "topic.editBoundary",
      targetId: node.id,
      targetLabel: node.label,
      targetKind: "topic",
      title: hasWorldModel ? "已请求保存边界备注" : "已请求更新问题边界",
      body: hasWorldModel
        ? "本次只作为补充说明处理，不强制生成新版世界模型。"
        : "系统将更新问题定义字段，仍停留在进入世界模型前的确认阶段。",
      status: "sent",
      impactLines: changesForPrompt,
      createsNewRound: false,
      oldRoundPreserved: true,
      autoCollapse: true,
    });
    onContinueAsMessage?.(
      composePromptLines([
        message,
        "如果这些补充实际上改变核心边界，请先返回确认卡，不要直接覆盖旧世界模型。",
      ]),
    );
    onCancel();
  };

  return (
    <div
      data-boundary-edit-card="true"
      className="mt-3 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--accent)_28%,var(--border))] bg-[var(--surface)] px-3 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--fg)]">编辑问题边界</div>
          <div className="mt-1 text-xs leading-5 text-[var(--fg-tertiary)]">
            {hasWorldModel
              ? "核心字段变化会先进入确认，再生成新版世界模型。"
              : "当前仍在问题定义阶段，保存后等待生成世界模型。"}
          </div>
        </div>
        <span
          data-boundary-core-change={String(hasCoreChange)}
          className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] text-[var(--fg-secondary)]"
        >
          {hasCoreChange ? "核心变化" : "小补充"}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {FIELD_META.map((meta) => {
          const value = draft[meta.field];
          const setValue = (next: string) =>
            setDraft((current) => ({ ...current, [meta.field]: next }));
          return (
            <label key={meta.field} className="block">
              <span className="text-[11px] font-medium text-[var(--fg-tertiary)]">
                {meta.label}
              </span>
              {meta.multiline ? (
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  rows={meta.field === "question" ? 2 : 3}
                  className="mt-1 min-h-[64px] w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs leading-5 text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
              ) : (
                <input
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  className="mt-1 h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                />
              )}
            </label>
          );
        })}
      </div>
      {changes.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-2 text-[11px] leading-5 text-[var(--fg-tertiary)]">
          {changeLines(changes).slice(0, 4).map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          data-boundary-submit="true"
          onClick={submit}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-2.5 text-xs font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          {shouldGenerateNewWorldModel ? "提交并确认新版世界模型" : "保存边界"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
        >
          取消
        </button>
      </div>
    </div>
  );
}

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Copy, GitBranchPlus, Loader2, Search } from "lucide-react";
import { memo } from "react";
import { SimulationEntryRequirementsCard } from "@/components/simulation/SimulationEntryRequirementsCard";
import { SimulationTopicAnalysisPanel } from "@/components/simulation/SimulationTopicAnalysisPanel";
import { useSimulationCanvasActivity } from "./SimulationCanvasActivityContext";
import type { CanvasFlowNode } from "./canvasTypes";
import {
  isSimulationNode,
  isTopicDefinitionPending,
  nodeColor,
  nodeConfigRows,
  nodeKindLabel,
  nodeMetricBadges,
  nodeSummary,
  sameText,
  topicAnalysisSteps,
  topicDefinitionPhaseBadge,
} from "./canvasHelpers";

const EMPTY_ACTIVITY_GAP = new Map<string | null, string>();

function SimulationTopicAnalysisPanelContainer({
  fallbackSteps,
  isReplying,
}: {
  fallbackSteps: Parameters<typeof SimulationTopicAnalysisPanel>[0]["fallbackSteps"];
  isReplying?: boolean;
}) {
  const activity = useSimulationCanvasActivity();

  return (
    <SimulationTopicAnalysisPanel
      embedded
      activityParts={activity?.activityParts ?? []}
      gapBefore={activity?.gapBefore ?? EMPTY_ACTIVITY_GAP}
      runId={activity?.runId}
      statusPart={activity?.statusPart}
      isStreaming={activity?.isStreaming ?? isReplying}
      fallbackSteps={fallbackSteps}
    />
  );
}

function sourceTextValue(
  source: CanvasFlowNode["data"]["source"],
  keys: string[],
): string | undefined {
  if (!source || !("data" in source)) return undefined;
  const data = source.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function nodeDisplayTitle(data: CanvasFlowNode["data"]): string {
  return (
    sourceTextValue(data.source, [
      "displayName",
      "shortName",
      "entityName",
      "name",
      "title",
    ]) ?? data.label
  );
}

function SimulationCanvasNode({ id, data }: NodeProps<CanvasFlowNode>) {
  const color = nodeColor(data.kind);
  const displayTitle = nodeDisplayTitle(data);
  const summary = nodeSummary(data);
  const visibleSummary = sameText(summary, displayTitle) ? undefined : summary;
  const badges = nodeMetricBadges(data);
  const configRows = nodeConfigRows(data);
  const sourceNode =
    data.source && isSimulationNode(data.source) ? data.source : null;
  const topicDefinitionPhase = data.topicDefinitionPhase ?? null;
  const isTopicDefinitionNode = data.kind === "topic" && topicDefinitionPhase != null;
  const showQuestionDefinitionActions =
    !isTopicDefinitionNode &&
    sourceNode?.type === "topic" &&
    isTopicDefinitionPending(sourceNode) &&
    Boolean(data.onQuestionDefinitionAction);
  const topicAnalysisStepsForNode =
    sourceNode?.type === "topic" ? topicAnalysisSteps(sourceNode) : [];
  const analysisSteps =
    topicDefinitionPhase === "analyzing"
      ? topicAnalysisStepsForNode.length > 0
        ? topicAnalysisStepsForNode
        : [
            {
              id: "topic-analysis-waiting",
              label: data.isReplying
                ? "正在理解问题并整理推演边界"
                : "等待 Companion 返回问题定义分析进度",
              status: data.isReplying ? ("running" as const) : ("pending" as const),
            },
          ]
      : topicAnalysisStepsForNode;
  const hasTopicAnalysisContent =
    analysisSteps.length > 0 ||
    topicDefinitionPhase === "analyzing";
  const showTopicAnalysisPanel =
    isTopicDefinitionNode && hasTopicAnalysisContent;
  const showSummary =
    Boolean(visibleSummary) &&
    (configRows.length === 0 ||
      data.kind === "summary" ||
      data.kind === "report" ||
      data.kind === "recovery" ||
      data.kind === "path" ||
      data.kind === "scenario" ||
      data.kind === "suggestion" ||
      data.kind === "next_action");
  const isPromptNode = data.kind === "prompt";
  const nodeTypeLabel = isTopicDefinitionNode
    ? "问题定义"
    : isPromptNode
      ? data.label || nodeKindLabel(data.kind)
      : nodeKindLabel(data.kind);
  const showEntryRequirements =
    topicDefinitionPhase === "form" && Boolean(data.entryRequirementsPart);
  const promptText = isPromptNode
    ? configRows.find((row) => row.label === "原文")?.value ??
      visibleSummary ??
      data.detail ??
      data.label
    : undefined;
  const visibleConfigRows =
    isPromptNode || showEntryRequirements || topicDefinitionPhase === "analyzing"
      ? []
      : configRows;
  const showNodeTitle =
    !isPromptNode &&
    !showEntryRequirements &&
    topicDefinitionPhase !== "analyzing";
  const phaseBadge =
    topicDefinitionPhase && topicDefinitionPhase !== "analyzing"
      ? topicDefinitionPhaseBadge(topicDefinitionPhase, {
          submitted:
            data.entryRequirementsPart?.submitted ||
            Boolean(data.entryRequirementsPart?.answer),
          isReplying: data.isReplying,
        })
      : null;
  const topicAnalysisExpanded =
    topicDefinitionPhase === "analyzing";
  const topicNodeWidthClass = isTopicDefinitionNode
    ? topicDefinitionPhase === "form"
      ? "w-[min(920px,calc(100vw-4rem))] min-w-[360px]"
      : topicAnalysisExpanded
        ? "w-[min(520px,calc(100vw-4rem))] min-w-[360px]"
        : "w-[420px]"
    : data.kind === "topic"
      ? "min-h-[132px] w-[360px]"
      : "";

  return (
    <div
      data-simulation-node-id={id}
      data-simulation-node-kind={data.kind}
      onClick={(event) => {
        event.stopPropagation();
        data.onNodeSelect?.(id, event.shiftKey || event.metaKey || event.ctrlKey);
      }}
      className={[
        isPromptNode
          ? "min-h-[108px] w-[360px]"
          : topicNodeWidthClass || "min-h-[118px] w-[300px]",
        "group relative overflow-visible rounded-[var(--radius-md)] border bg-[var(--surface-elevated)] px-3 py-2.5 text-left shadow-[var(--shadow-sm)] transition-shadow",
        data.isSelected
          ? "border-[var(--border-strong)] shadow-[0_14px_34px_rgba(15,23,42,0.14)]"
          : data.isPathHighlighted
            ? "border-[var(--accent)]/60 shadow-[0_10px_26px_rgba(15,23,42,0.10)]"
            : "border-[var(--border)]",
      ].join(" ")}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2" />
      <div className="flex items-center justify-between gap-2">
        <span
          className="min-w-0 truncate text-[11px] font-medium"
          style={{ color }}
        >
          {nodeTypeLabel}
        </span>
        {phaseBadge ? (
          <span
            className={[
              "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]",
              topicDefinitionPhase === "confirmed"
                ? "border-[var(--success)]/25 bg-[var(--success)]/10 text-[var(--success)]"
                : topicDefinitionPhase === "form" &&
                    (data.entryRequirementsPart?.submitted ||
                      data.entryRequirementsPart?.answer)
                  ? "border-[var(--accent)]/25 bg-[var(--accent-muted)] text-[var(--fg)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-tertiary)]",
            ].join(" ")}
          >
            {phaseBadge}
          </span>
        ) : !isPromptNode && data.dependencyLabel ? (
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-tertiary)]">
            {data.dependencyLabel}
          </span>
        ) : null}
        {!isPromptNode && data.isManualPosition ? (
          <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-tertiary)]">
            手动
          </span>
        ) : null}
        {topicDefinitionPhase === "analyzing" && data.isReplying ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-1.5 py-0.5 text-[10px] text-[var(--fg)]">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            思考中
          </span>
        ) : null}
      </div>
      {showNodeTitle ? (
        <div className="mt-1.5 break-words text-sm font-semibold leading-5 text-[var(--fg)]">
          {displayTitle}
        </div>
      ) : null}
      {showTopicAnalysisPanel ? (
        <div
          className="nodrag nowheel"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SimulationTopicAnalysisPanelContainer
            fallbackSteps={analysisSteps}
            isReplying={data.isReplying}
          />
        </div>
      ) : null}
      {showEntryRequirements && data.entryRequirementsPart ? (
        <div
          className="nodrag nowheel mt-2"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SimulationEntryRequirementsCard
            embedded
            part={data.entryRequirementsPart}
            onSubmitted={data.onRequirementsSubmitted}
            onContinueAsMessage={data.onRequirementsContinue}
            onDraftChange={data.onRequirementsDraftChange}
          />
        </div>
      ) : null}
      {showSummary && visibleSummary ? (
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--fg-secondary)]">
          {visibleSummary}
        </p>
      ) : null}
      {isPromptNode && promptText ? (
        <div className="mt-2 line-clamp-4 break-words text-base font-bold leading-6 text-[var(--fg)]">
          {promptText}
        </div>
      ) : null}
      {visibleConfigRows.length > 0 ? (
        <div
          className={[
            "mt-2 space-y-1",
            topicDefinitionPhase === "confirmed"
              ? ""
              : "rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5",
          ].join(" ")}
        >
          {visibleConfigRows.map((row) => (
            <div
              key={`${row.label}:${row.value}`}
              className="grid grid-cols-[42px_minmax(0,1fr)] gap-2 text-[11px] leading-4"
            >
              <span className="text-[var(--fg-tertiary)]">{row.label}</span>
              <span className="min-w-0 break-words text-[var(--fg-secondary)]">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {topicDefinitionPhase === "confirmed" && data.isReplying ? (
        <p className="mt-2 text-xs leading-5 text-[var(--fg-secondary)]">
          问题定义已确认，正在搭建世界模型层。
        </p>
      ) : null}
      {showQuestionDefinitionActions && !showEntryRequirements ? (
        <div className="nodrag mt-2 flex flex-wrap gap-1.5">
          {[
            {
              id: "confirm" as const,
              label: "生成世界模型",
              actionId: "topic.generateWorldModel",
            },
            {
              id: "edit" as const,
              label: "编辑边界",
              actionId: "topic.editBoundary",
            },
          ].map((action) => (
            <button
              key={action.id}
              type="button"
              data-action-id={action.actionId}
              data-behavior-type="prompt"
              data-target-kind="topic"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                data.onQuestionDefinitionAction?.(id, action.id);
              }}
              className={[
                "inline-flex h-7 items-center rounded-[var(--radius-md)] border px-2 text-[11px] font-medium transition-colors",
                action.id === "confirm"
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-90"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:text-[var(--fg)]",
              ].join(" ")}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
      {badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--fg-tertiary)]"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}
      {data.onToolbarAction ? (
        <div className="nodrag absolute -top-8 right-0 flex translate-y-1 items-center gap-1 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100">
          {[
            {
              id: "inspect" as const,
              label: "查看详情",
              icon: Search,
            },
            {
              id: "expand" as const,
              label: "沿此节点展开",
              icon: GitBranchPlus,
            },
            {
              id: "copy" as const,
              label: "复制节点信息",
              icon: Copy,
            },
          ]
            .filter(
              (action) =>
                action.id !== "inspect" || data.showInspectAction !== false,
            )
            .map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                title={action.label}
                aria-label={action.label}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  data.onToolbarAction?.(action.id, id);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const MemoizedSimulationCanvasNode = memo(SimulationCanvasNode);
MemoizedSimulationCanvasNode.displayName = "SimulationCanvasNode";

export const nodeTypes = { simulation: MemoizedSimulationCanvasNode };

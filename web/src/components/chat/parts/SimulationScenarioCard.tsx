"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanvasSnapshot, ChatPart } from "@/lib/chat-parts";
import { ChatMarkdown } from "@/components/chat/parts/ChatMarkdown";
import { SimulationCanvas } from "@/components/simulation/SimulationCanvas";
import {
  fetchSimulationRounds,
  fetchSimulationSnapshot,
} from "@/lib/companion/runtime";
import { submitRunClarification } from "@/lib/companion/clarification";
import { GitBranch, Network, Route, SlidersHorizontal } from "lucide-react";

type SimulationScenarioPart = Extract<ChatPart, { kind: "simulation_scenario" }>;
type SimulationSummaryPart = Extract<ChatPart, { kind: "simulation_summary" }>;
type SimulationSuggestionPart = Extract<
  ChatPart,
  { kind: "simulation_suggestion" | "simulation_next_action" }
>;
type Scenario = SimulationScenarioPart["scenario"];

function simulationTopicText(topic: Scenario["topic"]): string {
  if (typeof topic === "string") return topic;
  const problem = topic.data?.problem;
  return typeof problem === "string" && problem.trim()
    ? problem
    : topic.label || "未命名推演";
}

function roundLabel(roundId: string, label?: string): string {
  if (label) return label;
  const match = /round_(\d+)/.exec(roundId);
  if (match?.[1] === "1") return "初始判断";
  if (match?.[1]) return `第 ${match[1]} 轮推演`;
  return roundId;
}

function scenarioFromSnapshot(
  fallbackTopic: string,
  snapshot: CanvasSnapshot,
): Scenario {
  const topicNode = snapshot.nodes.find((node) => node.type === "topic");
  const promptNode = snapshot.nodes.find((node) => node.type === "prompt");
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
    provenance: snapshot.provenance,
  };
}

function provenanceNotice(
  provenance: Scenario["provenance"],
): { label: string; detail: string; tone: "ok" | "warn" } | null {
  if (!provenance) return null;
  if (provenance.source === "llm") {
    return {
      label: provenance.label ?? "模型结构化推演",
      detail: provenance.reason ?? "由模型输出的结构化推演图谱生成。",
      tone: "ok",
    };
  }
  return {
    label:
      provenance.label ??
      (provenance.source === "fallback"
        ? "Fallback 临时沙盘"
        : provenance.source === "mock"
          ? "Mock 演示沙盘"
          : "流式临时预览"),
    detail:
      provenance.warning ??
      provenance.reason ??
      "当前沙盘是临时图，需要等待真实结构化推演输出。",
    tone: "warn",
  };
}

function variableValueLabel(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return JSON.stringify(value);
}

function affectedPathsForVariable(
  scenario: Scenario,
  variableId: string,
): Scenario["paths"] {
  const variable = scenario.variables.find((item) => item.id === variableId);
  const directPathIds = new Set(variable?.pathIds ?? []);
  const relatedEdgeIds = new Set(
    scenario.edges
      .filter((edge) => edge.source === variableId || edge.target === variableId)
      .map((edge) => edge.id),
  );

  return scenario.paths.filter(
    (path) =>
      directPathIds.has(path.id) ||
      path.edgeIds.some((edgeId) => relatedEdgeIds.has(edgeId)),
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2">
      <span className="shrink-0 text-[var(--fg-tertiary)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-tertiary)]">
        {label}
      </span>
      <span className="font-mono text-sm font-semibold text-[var(--fg)]">
        {value}
      </span>
    </div>
  );
}

export function SimulationScenarioCard({
  part,
  sessionId,
  runId,
  onContinueAsMessage,
}: {
  part: SimulationScenarioPart;
  sessionId?: string;
  runId?: string;
  onContinueAsMessage?: (answer: string) => void;
}) {
  const [rounds, setRounds] = useState<
    Array<{ roundId: string; createdAt?: string; label?: string }>
  >([]);
  const [activeRoundId, setActiveRoundId] = useState("round_1");
  const [activeSnapshot, setActiveSnapshot] = useState<CanvasSnapshot | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [variableDrafts, setVariableDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const retryDelay = (attempt: number) =>
      new Promise((resolve) => setTimeout(resolve, attempt * 350));
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

  const scenario = useMemo(
    () =>
      activeSnapshot
        ? scenarioFromSnapshot(simulationTopicText(part.scenario.topic), activeSnapshot)
        : part.scenario,
    [activeSnapshot, part.scenario],
  );
  const visibleRounds =
    rounds.length > 0 ? rounds : [{ roundId: "round_1" }];
  const nodeCount =
    scenario.nodes?.length ?? scenario.entities.length + scenario.variables.length;
  const activeRound = visibleRounds.find((round) => round.roundId === activeRoundId);
  const latestRound = visibleRounds.at(-1);
  const latestRoundId = latestRound?.roundId ?? "round_1";
  const isHistorical = activeRoundId !== latestRoundId;
  const provenance = provenanceNotice(scenario.provenance);

  const selectRound = async (roundId: string) => {
    setActiveRoundId(roundId);
    setRoundError(null);
    if (roundId === "round_1" && rounds.length <= 1) {
      setActiveSnapshot(null);
      return;
    }
    if (!sessionId) return;
    try {
      const res = await fetchSimulationSnapshot({ sessionId, roundId });
      setActiveSnapshot(res.snapshot);
    } catch (err) {
      setRoundError(err instanceof Error ? err.message : "轮次快照读取失败");
      if (roundId === "round_1") setActiveSnapshot(null);
    }
  };

  const submitSimulationAction = async (content: string) => {
    setActionError(null);
    if (runId) {
      const result = await submitRunClarification({ runId, content });
      if (result.ok) return;
      const canFallback =
        result.error === "clarification_not_pending" ||
        result.error === "run_not_resumable" ||
        result.error === "tool_use_mismatch";
      if (!canFallback) {
        setActionError(result.message);
        return;
      }
    }
    if (onContinueAsMessage) {
      onContinueAsMessage(content);
      return;
    }
    setActionError("当前推演暂时无法继续，请从底部输入区补充你的选择。");
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
            {part.title ?? "初始沙盘"}
          </div>
          <h3 className="mt-1 text-base font-semibold text-[var(--fg)]">
            {simulationTopicText(scenario.topic)}
          </h3>
        </div>
        <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1 text-xs text-[var(--fg-secondary)]">
          {roundLabel(activeRoundId, activeRound?.label)}
        </span>
      </div>

      {visibleRounds.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
                {roundLabel(round.roundId, round.label)}
              </button>
            );
          })}
        </div>
      ) : null}

      {isHistorical ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--warn)]/25 bg-[var(--activity-chip-wait-bg)] px-3 py-2 text-xs text-[var(--activity-chip-wait-fg)]">
          <span>
            你正在查看历史轮次：{roundLabel(activeRoundId, activeRound?.label)}。新的选择或重算会生成新一轮推演，旧版本仍可回看。
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

      {provenance ? (
        <div
          className={[
            "mt-3 rounded-[var(--radius-md)] border px-3 py-2 text-xs leading-5",
            provenance.tone === "warn"
              ? "border-[var(--warn)]/25 bg-[var(--activity-chip-wait-bg)] text-[var(--activity-chip-wait-fg)]"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
          ].join(" ")}
        >
          <span className="font-medium">{provenance.label}</span>
          <span className="ml-2">{provenance.detail}</span>
        </div>
      ) : null}

      {roundError ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-3 py-2 text-xs text-[var(--danger-muted)]">
          {roundError}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-3 py-2 text-xs text-[var(--danger-muted)]">
          {actionError}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Network className="h-4 w-4" aria-hidden />}
          label="核心节点"
          value={nodeCount}
        />
        <Metric
          icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}
          label="关键变量"
          value={scenario.variables.length}
        />
        <Metric
          icon={<Route className="h-4 w-4" aria-hidden />}
          label="路径"
          value={scenario.paths.length}
        />
        <Metric
          icon={<GitBranch className="h-4 w-4" aria-hidden />}
          label="关系"
          value={scenario.edges.length}
        />
      </div>

      {scenario.paths.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-[var(--fg-tertiary)]">
            推演路径
          </div>
          <div className="grid gap-2">
            {scenario.paths.slice(0, 3).map((path) => (
              <div
                key={path.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-[var(--fg)]">
                    {path.label}
                  </span>
                  {typeof path.probability === "number" ? (
                    <span className="font-mono text-xs text-[var(--fg-tertiary)]">
                      {Math.round(path.probability * 100)}%
                    </span>
                  ) : null}
                </div>
                {path.summary ? (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--fg-secondary)]">
                    {path.summary}
                  </p>
                ) : null}
                {onContinueAsMessage || runId ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        void submitSimulationAction(
                          [
                            "我选择这条推演路径继续深挖：",
                            `路径 ID：${path.id}`,
                            `路径名称：${path.label}`,
                            path.summary ? `路径摘要：${path.summary}` : "",
                            "请基于这条路径生成新一轮推演，并保留旧轮次可回看。",
                          ]
                            .filter(Boolean)
                            .join("\n"),
                        )
                      }
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
                    >
                      选择这条继续
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {scenario.variables.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {scenario.variables.slice(0, 5).map((variable) => {
            const currentValue = variableValueLabel(variable.value);
            const hasDraft = Object.prototype.hasOwnProperty.call(
              variableDrafts,
              variable.id,
            );
            const nextValue = hasDraft
              ? variableDrafts[variable.id]
              : currentValue;
            const changed = hasDraft && nextValue !== currentValue;
            const affectedPaths = affectedPathsForVariable(scenario, variable.id);
            const affectedPathLabels = affectedPaths.map((path) => path.label);

            return (
              <div
                key={variable.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--fg)]">
                      {variable.label}
                    </div>
                    {variable.detail ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[var(--fg-tertiary)]">
                        {variable.detail}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[11px] text-[var(--fg-secondary)]">
                    当前：{currentValue || "未提供"}
                  </span>
                </div>
                {(onContinueAsMessage || runId) && variable.valueSchema ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {variable.valueSchema.kind === "enum" &&
                      variable.valueSchema.options?.length ? (
                        <select
                          aria-label={`调整${variable.label}`}
                          value={nextValue}
                          onChange={(event) =>
                            setVariableDrafts((prev) => ({
                              ...prev,
                              [variable.id]: event.target.value,
                            }))
                          }
                          className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                        >
                          {variable.valueSchema.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : variable.valueSchema.kind === "boolean" ? (
                        <select
                          aria-label={`调整${variable.label}`}
                          value={nextValue || "true"}
                          onChange={(event) =>
                            setVariableDrafts((prev) => ({
                              ...prev,
                              [variable.id]: event.target.value,
                            }))
                          }
                          className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                        >
                          <option value="true">是</option>
                          <option value="false">否</option>
                        </select>
                      ) : (
                        <input
                          aria-label={`调整${variable.label}`}
                          type={
                            variable.valueSchema.kind === "number"
                              ? "number"
                              : variable.valueSchema.kind === "datetime"
                                ? "datetime-local"
                                : "text"
                          }
                          value={nextValue}
                          onChange={(event) =>
                            setVariableDrafts((prev) => ({
                              ...prev,
                              [variable.id]: event.target.value,
                            }))
                          }
                          className="h-8 w-36 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg)] outline-none focus:border-[var(--accent)]"
                          placeholder="新假设"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void submitSimulationAction(
                            [
                              "请基于变量调整生成新一轮推演：",
                              `变量 ID：${variable.id}`,
                              `变量名称：${variable.label}`,
                              `原假设：${currentValue || "未提供"}`,
                              `新假设：${nextValue || "未提供"}`,
                              affectedPathLabels.length
                                ? `预计影响路径：${affectedPathLabels.join("、")}`
                                : "预计影响路径：当前画布未建立明确路径关系，请重新评估全部路径。",
                              "请先说明影响预览，再继续重算路径，并保留旧轮次可回看。",
                            ].join("\n"),
                          );
                        }}
                        className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]"
                      >
                        确认重算
                      </button>
                    </div>

                    {changed ? (
                      <div
                        className="rounded-[var(--radius-md)] border border-[var(--accent)]/30 bg-[var(--accent-muted)]/45 px-3 py-2 text-xs leading-5 text-[var(--fg-secondary)]"
                        aria-live="polite"
                      >
                        <div className="font-medium text-[var(--fg)]">
                          影响预览
                        </div>
                        <div>
                          本次改动：{currentValue || "未提供"} →{" "}
                          {nextValue || "未提供"}
                        </div>
                        <div>
                          预计影响：
                          {affectedPathLabels.length
                            ? affectedPathLabels.join("、")
                            : "当前画布未建立明确路径关系，将重新评估全部路径"}
                        </div>
                        <div>确认后会生成新一轮推演，当前版本仍可回看。</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      <SimulationCanvas scenario={scenario} />
    </div>
  );
}

export function SimulationSummaryCard({ part }: { part: SimulationSummaryPart }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
        推演总结 · {part.roundId}
      </div>
      <ChatMarkdown markdown={part.markdown} />
    </div>
  );
}

export function SimulationSuggestionCard({
  part,
}: {
  part: SimulationSuggestionPart;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--fg-tertiary)]">
        后续推演建议
      </div>
      <div className="grid gap-2">
        {(part.suggestions ?? []).map((suggestion) => (
          <div
            key={suggestion.suggestionId}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
          >
            <div className="font-medium text-[var(--fg)]">
              {suggestion.title}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fg-secondary)]">
              {suggestion.description}
            </p>
          </div>
        ))}
        {(part.nextActions ?? []).map((action) => (
          <div
            key={action.actionId}
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2"
          >
            <div className="font-medium text-[var(--fg)]">
              {action.title}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fg-secondary)]">
              {action.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

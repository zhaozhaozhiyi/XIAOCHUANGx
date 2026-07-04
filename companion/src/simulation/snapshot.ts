import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  inferSimulationStageState,
  normalizeSimulationNodesWorldModelData,
  type CanvasSnapshot,
  type SimulationInterventionKind,
} from "@jlc/contracts";
import { config } from "../config.js";

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function simulationSessionDir(sessionId: string): string {
  return join(config.dataDir, "simulation", safeSegment(sessionId));
}

function roundsDir(sessionId: string): string {
  return join(simulationSessionDir(sessionId), "rounds");
}

function snapshotPath(sessionId: string, roundId: string): string {
  return join(roundsDir(sessionId), `${safeSegment(roundId)}.json`);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function interventionLabel(kind: SimulationInterventionKind | string | undefined): string | undefined {
  switch (kind) {
    case "topic_confirm":
      return "确认初始设定";
    case "topic_edit":
      return "调整问题边界";
    case "path_continue":
      return "深挖路径";
    case "variable_override":
      return "调整变量后重算";
    case "scenario_continue":
      return "情景继续推演";
    case "scenario_compare":
      return "对比情景";
    case "scenario_counterfactual":
      return "生成反事实";
    case "node_expand":
      return "沿节点展开";
    case "entity_update":
      return "更新主体";
    case "event_assumption":
      return "事件假设推演";
    case "evidence_update":
      return "更新证据";
    case "hypothesis_update":
      return "调整假设";
    case "inference_rerun":
    case "inference_challenge":
      return "复核推理";
    case "risk_mitigate":
      return "处置风险";
    case "risk_stress_test":
      return "风险压力测试";
    case "decision_select":
      return "选择决策分支";
    case "action_simulate":
      return "模拟行动";
    case "conclusion_challenge":
      return "挑战结论";
    case "summary_continue":
      return "基于总结继续";
    case "report_update":
      return "更新报告";
    case "next_action_execute":
      return "执行下一步";
    case "history_restore":
      return "历史版本操作";
    case "recovery_retry":
      return "恢复推演";
    case "prompt_reparse":
      return "重新解析原问题";
    default:
      return undefined;
  }
}

function snapshotLabel(snapshot: CanvasSnapshot): string | undefined {
  if (snapshot.roundId === "round_1") return "初始判断";
  const intervention = snapshot.interventions?.at(-1);
  const interventionDisplay = interventionLabel(intervention?.kind);
  if (interventionDisplay) return interventionDisplay;

  const selection = snapshot.selections.at(-1);
  const action = snapshot.actions.at(-1);
  const payload = recordValue(action?.payload);
  const actionInterventionKind =
    typeof payload?.interventionKind === "string"
      ? payload.interventionKind
      : undefined;
  const actionInterventionDisplay = interventionLabel(actionInterventionKind);
  if (actionInterventionDisplay) return actionInterventionDisplay;

  if (selection?.type === "path" || action?.type === "path_deepen") {
    return "深挖路径";
  }
  if (
    selection?.type === "variable" ||
    action?.type === "variable_resimulate"
  ) {
    return "调整变量后重算";
  }
  if (selection?.type === "entry" || action?.type === "entry_confirm") {
    return "确认初始设定";
  }
  if (selection?.type === "scenario") {
    return "情景继续推演";
  }
  if (selection?.type === "report") {
    return "更新报告";
  }
  return undefined;
}

function normalizeCanvasSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  const nodes = normalizeSimulationNodesWorldModelData(snapshot.nodes);
  const prompt =
    nodes.find((node) => node.id === snapshot.promptNodeId) ??
    nodes.find((node) => node.type === "prompt");
  const topic =
    nodes.find((node) => node.id === snapshot.topicNodeId) ??
    nodes.find((node) => node.type === "topic");
  return {
    ...snapshot,
    nodes,
    stageState: inferSimulationStageState({
      prompt,
      topic: topic ?? "未命名推演",
      nodes,
      entities: nodes.filter((node) => node.type === "entity"),
      variables: nodes.filter((node) => node.type === "variable"),
      stageState: snapshot.stageState,
    }),
  };
}

type SnapshotNode = CanvasSnapshot["nodes"][number];

function mergeById<T extends { id: string }>(
  previous: T[] | undefined,
  incoming: T[] | undefined,
): T[] {
  const merged = new Map<string, T>();
  for (const item of previous ?? []) merged.set(item.id, item);
  for (const item of incoming ?? []) {
    const existing = merged.get(item.id);
    merged.set(item.id, existing ? { ...existing, ...item } : item);
  }
  return [...merged.values()];
}

function mergeSnapshotNode(
  previous: SnapshotNode | undefined,
  incoming: SnapshotNode,
): SnapshotNode {
  if (!previous) return incoming;
  const protectedUpstream = previous.locked || previous.status === "confirmed";
  const incomingStatus = incoming.status;
  const status =
    protectedUpstream &&
    incomingStatus !== "confirmed" &&
    incomingStatus !== "updated" &&
    incomingStatus !== "historical" &&
    incomingStatus !== "failed"
      ? previous.status
      : (incomingStatus ?? previous.status);

  return {
    ...previous,
    ...incoming,
    status,
    locked: previous.locked || incoming.locked,
    data: {
      ...(previous.data ?? {}),
      ...(incoming.data ?? {}),
    },
  };
}

function mergeNodesById(
  previous: SnapshotNode[] | undefined,
  incoming: SnapshotNode[] | undefined,
): SnapshotNode[] {
  const merged = new Map<string, SnapshotNode>();
  for (const node of previous ?? []) merged.set(node.id, node);
  for (const node of incoming ?? []) {
    merged.set(node.id, mergeSnapshotNode(merged.get(node.id), node));
  }
  return [...merged.values()];
}

function hasDownstreamNodes(nodes: SnapshotNode[] | undefined): boolean {
  return (nodes ?? []).some(
    (node) => node.type !== "prompt" && node.type !== "topic",
  );
}

function isQuestionShellRegression(input: {
  previous: CanvasSnapshot;
  incoming: CanvasSnapshot;
}): boolean {
  if (!hasDownstreamNodes(input.previous.nodes)) return false;
  if (hasDownstreamNodes(input.incoming.nodes)) return false;
  return (
    input.incoming.provenance?.source === "fallback" ||
    input.incoming.stageState?.current === "question" ||
    (input.incoming.nodes.length <= 2 &&
      input.incoming.paths.length === 0 &&
      (input.incoming.scenarios?.length ?? 0) === 0)
  );
}

function mergeCanvasSnapshotPreservingUpstream(
  previous: CanvasSnapshot,
  incoming: CanvasSnapshot,
): CanvasSnapshot {
  const keepPreviousQuestionLayer = isQuestionShellRegression({
    previous,
    incoming,
  });
  const nodes = mergeNodesById(
    previous.nodes,
    keepPreviousQuestionLayer
      ? incoming.nodes.filter(
          (node) => node.type !== "prompt" && node.type !== "topic",
        )
      : incoming.nodes,
  );

  return {
    ...previous,
    ...incoming,
    promptNodeId: keepPreviousQuestionLayer
      ? (previous.promptNodeId ?? incoming.promptNodeId)
      : (incoming.promptNodeId ?? previous.promptNodeId),
    topicNodeId: keepPreviousQuestionLayer
      ? (previous.topicNodeId ?? incoming.topicNodeId)
      : (incoming.topicNodeId ?? previous.topicNodeId),
    nodes,
    edges: mergeById(previous.edges, incoming.edges),
    scenarios:
      incoming.scenarios?.length || previous.scenarios?.length
        ? mergeById(previous.scenarios, incoming.scenarios)
        : undefined,
    paths: mergeById(previous.paths, incoming.paths),
    selections: mergeById(previous.selections, incoming.selections),
    actions: mergeById(previous.actions, incoming.actions),
    interventions:
      incoming.interventions?.length || previous.interventions?.length
        ? mergeById(previous.interventions, incoming.interventions)
        : undefined,
    stageState: keepPreviousQuestionLayer
      ? (previous.stageState ?? incoming.stageState)
      : (incoming.stageState ?? previous.stageState),
    provenance: keepPreviousQuestionLayer
      ? (previous.provenance ?? incoming.provenance)
      : (incoming.provenance ?? previous.provenance),
    createdAt: incoming.createdAt,
  };
}

export async function saveCanvasSnapshot(input: {
  sessionId: string;
  snapshot: CanvasSnapshot;
}): Promise<CanvasSnapshot> {
  const previous = await loadCanvasSnapshot({
    sessionId: input.sessionId,
    roundId: input.snapshot.roundId,
  });
  const snapshot = normalizeCanvasSnapshot(
    previous
      ? mergeCanvasSnapshotPreservingUpstream(previous, input.snapshot)
      : input.snapshot,
  );
  await mkdir(roundsDir(input.sessionId), { recursive: true });
  await writeFile(
    snapshotPath(input.sessionId, snapshot.roundId),
    JSON.stringify(snapshot, null, 2),
    "utf8",
  );
  return snapshot;
}

export async function loadCanvasSnapshot(input: {
  sessionId: string;
  roundId: string;
}): Promise<CanvasSnapshot | null> {
  try {
    const raw = await readFile(
      snapshotPath(input.sessionId, input.roundId),
      "utf8",
    );
    const parsed = JSON.parse(raw) as CanvasSnapshot;
    if (parsed.roundId !== input.roundId) return null;
    return normalizeCanvasSnapshot(parsed);
  } catch {
    return null;
  }
}

export async function listCanvasSnapshots(
  sessionId: string,
): Promise<Array<{ roundId: string; createdAt?: string; label?: string }>> {
  try {
    const names = await readdir(roundsDir(sessionId));
    const rounds: Array<{ roundId: string; createdAt?: string; label?: string }> = [];
    const loaded = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => {
          const roundId = name.replace(/\.json$/, "");
          const snapshot = await loadCanvasSnapshot({ sessionId, roundId });
          return snapshot
            ? {
                roundId: snapshot.roundId,
                createdAt: snapshot.createdAt,
                label: snapshotLabel(snapshot),
              }
            : null;
        }),
    );
    for (const item of loaded) {
      if (item) rounds.push(item);
    }
    return rounds
      .sort((a, b) => a.roundId.localeCompare(b.roundId, undefined, {
        numeric: true,
      }));
  } catch {
    return [];
  }
}

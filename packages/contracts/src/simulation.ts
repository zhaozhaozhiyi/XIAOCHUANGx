import type {
  ChatPart,
  SimulationEdge,
  SimulationNode,
  SimulationNodeType,
  SimulationPath,
  SimulationScenarioPart,
  SimulationStageId,
  SimulationStageState,
  SimulationStageStatus,
} from "./chat";

export type SimulationScenario = SimulationScenarioPart["scenario"];

export type SimulationDeltaPart = Extract<
  ChatPart,
  { kind: "simulation_node" | "simulation_edge" | "simulation_path" }
>;

export const SIMULATION_STAGE_ORDER: SimulationStageId[] = [
  "question",
  "entity",
  "hypothesis",
  "variable",
  "risk",
  "reasoning",
  "scenario",
  "output",
];

const SIMULATION_STAGE_STATUS_VALUES: SimulationStageStatus[] = [
  "idle",
  "generating",
  "awaiting_confirmation",
  "confirmed",
  "failed",
];

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export const SIMULATION_WORLD_MODEL_MIRRORED_KEYS = [
  "confidence",
  "rationale",
  "upstreamNodeIds",
  "upstreamEdgeIds",
  "waveId",
  "waveIndex",
  "waveType",
  "waveTitle",
  "analysisQuestion",
  "uncertainty",
] as const;

export function normalizeSimulationNodeWorldModelData<T extends SimulationNode>(
  node: T,
): T {
  const data = recordValue(node.data);
  if (!data) return node;
  const worldModel = recordValue(data.worldModel);
  if (!worldModel) return node;

  const mirrored: Record<string, unknown> = {};
  for (const key of SIMULATION_WORLD_MODEL_MIRRORED_KEYS) {
    if (data[key] === undefined && worldModel[key] !== undefined) {
      mirrored[key] = worldModel[key];
    }
  }
  if (Object.keys(mirrored).length === 0) return node;

  return {
    ...node,
    data: {
      ...data,
      ...mirrored,
    },
  };
}

export function normalizeSimulationNodesWorldModelData<T extends SimulationNode>(
  nodes: readonly T[],
): T[] {
  return nodes.map((node) => normalizeSimulationNodeWorldModelData(node));
}

export function isSimulationStageId(
  value: unknown,
): value is SimulationStageId {
  return (
    typeof value === "string" &&
    SIMULATION_STAGE_ORDER.includes(value as SimulationStageId)
  );
}

function normalizeStageId(
  value: unknown,
  fallback: SimulationStageId,
): SimulationStageId {
  if (isSimulationStageId(value)) return value;
  if (typeof value !== "string") return fallback;
  const lower = value.toLowerCase();
  if (lower.includes("problem") || lower.includes("question")) return "question";
  if (lower.includes("skeleton") || lower.includes("entity")) return "entity";
  if (lower.includes("hypothesis")) return "hypothesis";
  if (lower.includes("variable")) return "variable";
  if (lower.includes("risk")) return "risk";
  if (
    lower.includes("reason") ||
    lower.includes("inference") ||
    lower.includes("evidence")
  ) {
    return "reasoning";
  }
  if (lower.includes("scenario") || lower.includes("path")) return "scenario";
  if (
    lower.includes("output") ||
    lower.includes("summary") ||
    lower.includes("report")
  ) {
    return "output";
  }
  return fallback;
}

function normalizeCompletedStages(
  value: unknown,
  fallback: SimulationStageId[],
): SimulationStageId[] {
  if (!Array.isArray(value)) return fallback;
  const seen = new Set<SimulationStageId>();
  for (const item of value) {
    const stage = normalizeStageId(item, "question");
    seen.add(stage);
  }
  const normalized = SIMULATION_STAGE_ORDER.filter((stage) => seen.has(stage));
  return normalized.length > 0 ? normalized : fallback;
}

function normalizeStageStatus(
  value: unknown,
  fallback: SimulationStageStatus,
): SimulationStageStatus {
  if (
    typeof value === "string" &&
    SIMULATION_STAGE_STATUS_VALUES.includes(value as SimulationStageStatus)
  ) {
    return value as SimulationStageStatus;
  }
  if (value === "active" || value === "pending") return "awaiting_confirmation";
  return fallback;
}

export function normalizeSimulationStageState(
  value: Partial<SimulationStageState> | null | undefined,
  fallback: SimulationStageState,
): SimulationStageState {
  const rawCurrent = value?.current;
  const current = normalizeStageId(rawCurrent, fallback.current);
  const waveId =
    typeof value?.waveId === "string" && value.waveId.trim()
      ? value.waveId
      : typeof rawCurrent === "string" && !isSimulationStageId(rawCurrent)
        ? rawCurrent
        : fallback.waveId;

  return {
    current,
    status: normalizeStageStatus(value?.status, fallback.status),
    completed: normalizeCompletedStages(value?.completed, fallback.completed),
    awaitingConfirmation:
      value?.awaitingConfirmation ?? fallback.awaitingConfirmation,
    message: value?.message ?? fallback.message,
    waveId,
  };
}

export function simulationStageForNodeType(
  type: SimulationNodeType,
): SimulationStageId {
  switch (type) {
    case "prompt":
    case "topic":
      return "question";
    case "entity":
      return "entity";
    case "hypothesis":
      return "hypothesis";
    case "variable":
      return "variable";
    case "event":
    case "risk":
      return "risk";
    case "evidence":
    case "inference":
    case "conclusion":
      return "reasoning";
    case "decision":
    case "action":
    case "scenario":
      return "scenario";
    case "summary":
    case "report":
    case "next_action":
    case "history":
    case "recovery":
    case "suggestion":
      return "output";
    default:
      return "reasoning";
  }
}

function normalizeNode(node: SimulationNode): SimulationNode {
  const normalizedNode = normalizeSimulationNodeWorldModelData(node);
  return {
    ...normalizedNode,
    stage:
      normalizedNode.stage ?? simulationStageForNodeType(normalizedNode.type),
  };
}

function mergeNode(
  previous: SimulationNode | undefined,
  incoming: SimulationNode,
): SimulationNode {
  if (!previous) return normalizeNode(incoming);

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

  return normalizeNode({
    ...previous,
    ...incoming,
    status,
    locked: previous.locked || incoming.locked,
    data: {
      ...(previous.data ?? {}),
      ...(incoming.data ?? {}),
    },
    stage:
      incoming.stage ??
      previous.stage ??
      simulationStageForNodeType(incoming.type ?? previous.type),
  });
}

function upsertNodeById(
  items: SimulationNode[],
  item: SimulationNode | undefined,
): SimulationNode[] {
  if (!item) return items;
  const idx = items.findIndex((existing) => existing.id === item.id);
  if (idx < 0) return [...items, normalizeNode(item)];
  const next = [...items];
  next[idx] = mergeNode(next[idx], item);
  return next;
}

function upsertById<T extends { id: string }>(
  items: T[],
  item: T | undefined,
): T[] {
  if (!item) return items;
  const idx = items.findIndex((existing) => existing.id === item.id);
  if (idx < 0) return [...items, item];
  const next = [...items];
  next[idx] = { ...next[idx]!, ...item };
  return next;
}

function mergeNodesById(
  items: Array<SimulationNode | undefined>,
): SimulationNode[] {
  return items.reduce<SimulationNode[]>(upsertNodeById, []);
}

function mergeById<T extends { id: string }>(items: T[]): T[] {
  return items.reduce<T[]>(upsertById, []);
}

function topicNodeFromScenario(
  scenario: Partial<SimulationScenario> | null | undefined,
): SimulationNode | undefined {
  const topic = scenario?.topic;
  return typeof topic === "string" ? undefined : topic;
}

function inferLatestStage(nodes: SimulationNode[]): SimulationStageId {
  let latestIndex = 0;
  for (const node of nodes) {
    const stage = node.stage ?? simulationStageForNodeType(node.type);
    const idx = SIMULATION_STAGE_ORDER.indexOf(stage);
    if (idx > latestIndex) latestIndex = idx;
  }
  return SIMULATION_STAGE_ORDER[latestIndex] ?? "question";
}

function inferCompletedStages(
  nodes: SimulationNode[],
  current: SimulationStageId,
): SimulationStageId[] {
  const seen = new Set<SimulationStageId>();
  for (const node of nodes) {
    const stage = node.stage ?? simulationStageForNodeType(node.type);
    if (node.status === "confirmed" || node.locked) {
      seen.add(stage);
    }
  }

  const currentIndex = SIMULATION_STAGE_ORDER.indexOf(current);
  for (let idx = 0; idx < currentIndex; idx += 1) {
    const stage = SIMULATION_STAGE_ORDER[idx];
    if (stage) seen.add(stage);
  }
  return SIMULATION_STAGE_ORDER.filter((stage) => seen.has(stage));
}

export function inferSimulationStageState(
  scenario: Partial<SimulationScenario> | null | undefined,
): SimulationStageState {
  const nodes = [
    ...(scenario?.nodes ?? []),
    scenario?.prompt,
    topicNodeFromScenario(scenario),
    ...(scenario?.entities ?? []),
    ...(scenario?.variables ?? []),
  ]
    .filter((node): node is SimulationNode => Boolean(node))
    .map(normalizeNode);
  const current = normalizeStageId(
    scenario?.stageState?.current,
    inferLatestStage(nodes),
  );
  const inferredCompleted = inferCompletedStages(nodes, current);
  const completed = normalizeCompletedStages(
    scenario?.stageState?.completed,
    inferredCompleted,
  );
  const hasActiveCurrent = nodes.some(
    (node) =>
      (node.stage ?? simulationStageForNodeType(node.type)) === current &&
      (node.status === "draft" ||
        node.status === "pending" ||
        node.status === "active"),
  );

  return {
    current,
    status: normalizeStageStatus(
      scenario?.stageState?.status,
      hasActiveCurrent ? "awaiting_confirmation" : "confirmed",
    ),
    completed,
    awaitingConfirmation:
      scenario?.stageState?.awaitingConfirmation ?? hasActiveCurrent,
    message: scenario?.stageState?.message,
    waveId:
      scenario?.stageState?.waveId ??
      (!isSimulationStageId(scenario?.stageState?.current)
        ? scenario?.stageState?.current
        : undefined),
  };
}

export function mergeSimulationScenarioPreservingUpstream(
  previous: Partial<SimulationScenario> | null | undefined,
  incoming: Partial<SimulationScenario> | null | undefined,
): SimulationScenario {
  const prompt = incoming?.prompt ?? previous?.prompt;
  const topic = incoming?.topic ?? previous?.topic ?? "未命名推演";
  const topicNode = typeof topic === "string" ? undefined : topic;
  const previousTopicNode = topicNodeFromScenario(previous);
  const incomingTopicNode = topicNodeFromScenario(incoming);
  const nodes = mergeNodesById([
    ...(previous?.nodes ?? []),
    previous?.prompt,
    previousTopicNode,
    ...(previous?.entities ?? []),
    ...(previous?.variables ?? []),
    ...(incoming?.nodes ?? []),
    incoming?.prompt,
    incomingTopicNode,
    ...(incoming?.entities ?? []),
    ...(incoming?.variables ?? []),
  ]);
  const entities = mergeNodesById([
    ...(previous?.entities ?? []),
    ...nodes.filter((node) => node.type === "entity"),
    ...(incoming?.entities ?? []),
  ]);
  const variables = mergeNodesById([
    ...(previous?.variables ?? []),
    ...nodes.filter((node) => node.type === "variable"),
    ...(incoming?.variables ?? []),
  ]);
  const inferredStageState = inferSimulationStageState({
    prompt,
    topic,
    nodes,
    entities,
    variables,
  });
  const stageState = normalizeSimulationStageState(
    incoming?.stageState ?? previous?.stageState,
    inferredStageState,
  );

  return {
    ...previous,
    ...incoming,
    prompt,
    topic,
    topicDefinition: incoming?.topicDefinition ?? previous?.topicDefinition,
    nodes,
    scenarios:
      incoming?.scenarios?.length
        ? mergeById([...(previous?.scenarios ?? []), ...incoming.scenarios])
        : previous?.scenarios,
    entities,
    variables,
    assumptions:
      incoming?.assumptions?.length
        ? Array.from(
            new Set([
              ...(previous?.assumptions ?? []),
              ...incoming.assumptions,
            ]),
          )
        : previous?.assumptions,
    paths: mergeById<SimulationPath>([
      ...(previous?.paths ?? []),
      ...(incoming?.paths ?? []),
    ]),
    edges: mergeById<SimulationEdge>([
      ...(previous?.edges ?? []),
      ...(incoming?.edges ?? []),
    ]),
    interventions:
      incoming?.interventions?.length
        ? mergeById([
            ...(previous?.interventions ?? []),
            ...incoming.interventions,
          ])
        : previous?.interventions,
    stageState,
    provenance: incoming?.provenance ?? previous?.provenance,
    roundId: incoming?.roundId ?? previous?.roundId,
  };
}

export function mergeSimulationDeltaIntoScenarioPreservingUpstream(
  scenario: Partial<SimulationScenario> | null | undefined,
  part: SimulationDeltaPart,
): SimulationScenario {
  if (part.kind === "simulation_node") {
    const node = normalizeNode(part.node);
    return mergeSimulationScenarioPreservingUpstream(scenario, {
      ...(node.type === "prompt" ? { prompt: node } : {}),
      ...(node.type === "topic" ? { topic: node } : {}),
      ...(node.type === "entity" ? { entities: [node] } : {}),
      ...(node.type === "variable" ? { variables: [node] } : {}),
      nodes: [node],
      stageState: inferSimulationStageState({
        ...scenario,
        nodes: [...(scenario?.nodes ?? []), node],
      }),
    });
  }
  if (part.kind === "simulation_edge") {
    return mergeSimulationScenarioPreservingUpstream(scenario, {
      edges: [part.edge],
    });
  }
  return mergeSimulationScenarioPreservingUpstream(scenario, {
    paths: [part.path],
  });
}

export function mergeSimulationDeltasIntoScenarioPreservingUpstream(
  scenario: Partial<SimulationScenario> | null | undefined,
  deltas: SimulationDeltaPart[],
): SimulationScenario {
  return deltas.reduce<SimulationScenario>(
    (next, delta) =>
      mergeSimulationDeltaIntoScenarioPreservingUpstream(next, delta),
    mergeSimulationScenarioPreservingUpstream(null, scenario),
  );
}

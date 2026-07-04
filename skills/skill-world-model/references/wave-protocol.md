# World Model Wave Protocol

## Mental Model

The canvas is a result container. The product experience is the reasoning wave:

```text
upstream context -> analysis question -> rationale -> delta graph -> checkpoint
```

The graph must not contain downstream conclusions before the wave that justifies them.

## Canonical Wave Shape

Use this shape internally. Current runtime output should encode it inside supported simulation parts.

```ts
type WorldModelWave = {
  waveId: string;
  roundId: string;
  waveIndex: number;
  waveType:
    | "problem_boundary"
    | "skeleton"
    | "evidence_context"
    | "causal_hypothesis"
    | "intermediate_inference"
    | "risk_disturbance"
    | "scenario_path"
    | "intervention"
    | "output_memory"
    | "critique";
  title: string;
  purpose: string;
  upstream: {
    problemDefinitionId: string;
    nodeIds: string[];
    edgeIds?: string[];
    previousWaveIds?: string[];
    userEdits?: string[];
  };
  analysis: {
    question: string;
    rationale: string;
    assumptionsUsed?: string[];
    uncertainty?: string[];
  };
  output: {
    addedNodeIds: string[];
    addedEdgeIds: string[];
    addedPathIds?: string[];
  };
  checkpoint: {
    required: boolean;
    reason?: string;
    options: Array<"continue" | "revise" | "rerun" | "stop">;
  };
};
```

## P0 Encoding

Until `simulation_wave` is supported as a first-class part, encode the wave on each emitted item:

```json
{
  "data": {
    "worldModel": {
      "waveId": "wave_3_hypothesis",
      "waveIndex": 3,
      "waveType": "causal_hypothesis",
      "waveTitle": "建立首批因果假设",
      "analysisQuestion": "哪些变量最可能驱动结果分叉？",
      "upstreamNodeIds": ["topic_definition", "var_demand", "var_cost"],
      "upstreamEdgeIds": [],
      "rationale": "需求强度和成本压力会共同决定利润空间，因此先建立二者到利润结果的因果假设。",
      "confidence": 0.68,
      "uncertainty": ["缺少最新订单数据"]
    }
  }
}
```

For `SimulationEdge`, the current declared shape has no `data` field. In P0, put the concise reason in `label` and keep detailed traceability on connected nodes' `data.worldModel`. If the runtime later adds edge metadata, mirror the same trace under `edge.data.worldModel`.

For `SimulationPath`, the current declared shape has no `data`. Encode traceability in `summary`:

```text
基于 wave_3_hypothesis 与 wave_5_risk：...
上游：var_demand, hypothesis_margin, risk_policy_shift。
```

## Wave Types

### Wave 0: Problem Boundary

Purpose: confirm what is being modeled.

Allowed:

- prompt node
- topic node
- `simulation_requirements`
- `simulation_requirement_summary`

Forbidden:

- risk nodes
- scenario paths
- intervention options
- full world graph

### Wave 1: Skeleton

Purpose: create the minimum world skeleton.

Allowed:

- entity nodes
- variable nodes
- edges from prompt/topic to these nodes when useful

Forbidden:

- final conclusions
- action recommendations
- detailed path branches

Checkpoint: optional unless the variables are ambiguous or user-facing stakes are high.

### Wave 2: Evidence And Context

Purpose: ground the model before mechanisms become too speculative.

Allowed:

- evidence nodes from user-provided material or cited sources
- event nodes for known time-bound changes
- variable refinements if evidence reveals a missing control variable
- uncertainty markers in `data.worldModel.uncertainty`

Forbidden:

- pretending assumptions are evidence
- final conclusions
- intervention recommendations

Checkpoint: optional, required when evidence conflicts or is thin.

### Wave 3: Causal Hypothesis

Purpose: explain how the skeleton variables may influence each other.

Allowed:

- hypothesis nodes
- inference nodes
- causal edges
- evidence-support edges if the user supplied sources

Forbidden:

- action recommendations
- final path selection

Checkpoint: recommended, because hypotheses shape all downstream analysis.

### Wave 4: Intermediate Inference

Purpose: derive intermediate judgments from variables, evidence, and hypotheses before jumping to paths.

Allowed:

- inference nodes
- candidate conclusion nodes marked as `status: "active"` rather than final
- causal/evidence-support edges from variables, evidence, and hypotheses

Forbidden:

- final path selection
- actions or mitigation plans

Checkpoint: recommended when inferences are low-confidence or conflict with user intuition.

### Wave 5: Risk And Disturbance

Purpose: identify shocks, constraints, and uncertainty that can perturb the causal chain.

Allowed:

- risk nodes
- event nodes
- uncertainty summaries
- causal or temporal edges to affected variables/hypotheses

Forbidden:

- mitigation plans
- decision actions

Checkpoint: optional for routine cases, required for high-impact or low-confidence risks.

### Wave 6: Scenario Path

Purpose: combine variables, hypotheses, and risks into comparable paths.

Allowed:

- scenario nodes
- `simulation_path`
- path-linked conclusion nodes

Forbidden:

- intervention plans unless the user explicitly asks to move to action

Checkpoint: required. The user should choose, compare, or ask to rerun before interventions.

### Wave 7: Intervention

Purpose: generate possible user actions after the world structure is understandable.

Allowed:

- decision nodes
- action nodes
- intervention suggestions
- next actions

Forbidden:

- silent upstream edits
- pretending actions are guaranteed outcomes

Checkpoint: required.

### Wave 8: Output And Memory

Purpose: close or preserve a round without losing traceability.

Allowed:

- summary nodes
- report nodes
- suggestion nodes
- history nodes
- recovery nodes
- `simulation_summary`
- `simulation_suggestion`

Forbidden:

- new causal claims that bypass earlier waves
- report claims without node or path references

Checkpoint: required if the output changes the user's next action.

## Validation Rules

Before emitting a wave, check:

1. Is the problem definition confirmed?
2. Does every new node name at least one upstream node or the topic definition?
3. Does every new edge connect existing or same-wave nodes?
4. Are all new IDs stable and unique?
5. Does the wave avoid downstream content that belongs later?
6. Is uncertainty visible when confidence is below 0.7?
7. Is there a checkpoint when the wave changes the direction of downstream reasoning?
8. Does each new node obey the ontology for its node type?
9. Does each new edge follow an allowed transition rule?
10. Does the wave preserve scope, temporal order, and evidence/hypothesis/conclusion distinctions?

## Rerun Semantics

When a user edits an upstream node:

1. Identify dependent nodes by `data.worldModel.upstreamNodeIds`.
2. Mark affected downstream nodes as `historical` or `updated`.
3. Generate a new wave with a new `roundId` or a new wave ID suffix such as `wave_3_hypothesis_rerun_1`.
4. Explain what changed and why.

Do not overwrite history without a visible trace.

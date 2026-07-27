---
slug: skill-world-model
version: "1.0"
kind: tool
scope: ["chat","simulation"]
summary: "世界模型：按 wave 增量构建逻辑自洽的推演画布，覆盖节点本体论、推导语法、上游依据、rationale 与 checkpoint"
skillDependencies: []
capabilityRequirements: []
assetPolicy: {"references":true,"scripts":false,"templates":false,"assets":false}
name: skill-world-model
description: Logic-rich, wave-driven world modeling for simulation canvases. Use when building, extending, or revising a simulation/world-model canvas that must be semantically incremental, causally traceable, logically self-consistent, and rich enough to cover entities, variables, evidence, hypotheses, inferences, events, risks, scenarios, decisions, actions, outputs, history, and recovery; especially for complex causal questions, market/policy/project risk simulations, scenario planning, node/edge/path generation, upstream-dependent reasoning, checkpoints, reruns, contradiction checks, or explaining why each canvas node exists.
---

# World Model

## Purpose

Build a world model as a visible, logically self-consistent reasoning process, not as a fully generated graph hidden behind reveal animation. Generate only the next justified wave of nodes, edges, or paths from confirmed upstream context.

This skill is designed to sit under `skill-simulation-base`: the simulation base confirms the problem boundary, then this skill constructs the world model wave by wave.

The model must feel full, but not noisy: it should contain enough actors, variables, evidence, mechanisms, risks, paths, decisions, and outputs to explain the problem, while every item remains traceable to an upstream reason.

## Operating Rule

Never dump a complete downstream graph in one response. Each response after problem confirmation should produce one coherent wave:

```text
confirmed upstream -> wave analysis -> delta nodes/edges/paths -> rationale -> checkpoint
```

For current P0 compatibility, emit existing `simulation_node`, `simulation_edge`, `simulation_path`, `simulation_summary`, and `simulation_suggestion` blocks. Store wave metadata in `data.worldModel` on nodes; for edges, put the concise reason in `label`; for paths, encode traceability in `summary` unless the runtime adds metadata fields.

Hard constraints:

- One response = one wave delta. Do not output multiple future waves in the same answer.
- Confirmed or locked upstream nodes and edges must never disappear. If an upstream item no longer applies, mark it `historical` or `updated`; never omit it as a deletion signal.
- Every node `label` is the canvas display name. It must be a short noun phrase, not a sentence, statistic, paragraph, or rationale. Put explanatory text in `detail`; put reasoning in `data.worldModel.rationale`.
- For `entity` nodes, `label` must name the actor/object class, such as `长流程钢企`, `废钢电炉钢企`, or `铁矿石供应链`. Shares, locations, processes, constraints, and uncertainty belong in `detail` or `data.worldModel.uncertainty`.
- When emitting or updating `simulation_scenario`, include `scenario.stageState` when possible: `{ current, status, completed, awaitingConfirmation, message, waveId }`.
- Every wave must end with an explicit checkpoint offering continue, revise, rerun, or wait-for-confirmation.

## Required Flow

1. Confirm the problem boundary first.
   - If `simulation_requirements` has not been confirmed, do not create world-model nodes beyond prompt/topic/requirements.
   - Wait for the user's confirmation or edits.

2. Build waves in a logical order unless the user asks for a targeted rerun.
   - Wave 1: world skeleton, usually entities, key variables, and scope anchors.
   - Wave 2: evidence and context, usually user-provided evidence, facts, constraints, events, or missing-evidence markers.
   - Wave 3: causal hypotheses, usually mechanism hypotheses plus causal edges.
   - Wave 4: intermediate inference, usually derived judgments and candidate conclusions.
   - Wave 5: risks and disturbances, usually risks, events, uncertainty, and path-switch triggers.
   - Wave 6: scenario paths, usually 2-3 paths based on confirmed mechanisms and risks.
   - Wave 7: decisions and interventions, usually decision/action/next_action nodes. Do not create these before the user has seen the upstream paths.
   - Wave 8: outputs and memory, usually summary/report/history/recovery/suggestion nodes when the round needs closure or repair.

3. For each wave, use only confirmed upstream.
   - Input must include the original prompt, confirmed problem definition, existing nodes, existing edges, previous wave rationales, and any user edits.
   - Do not refer to nodes that have not been emitted yet.

4. Emit only deltas.
   - Prefer `simulation_node`, `simulation_edge`, and `simulation_path` blocks for newly added items.
   - Do not re-emit the whole scenario unless initializing a minimal scenario shell or repairing missing state.

5. Attach traceability to every output item.
   - Every node needs `data.worldModel.waveId`, `waveTitle`, `upstreamNodeIds`, `rationale`, `confidence`, and `analysisQuestion`.
   - In P0, every edge needs a concise reason in `label`; if the runtime later supports edge metadata, also include `data.worldModel.waveId`, `upstreamNodeIds`, and `reason`.
   - Every path needs traceability in `summary`; if the runtime later supports path metadata, also include `data.worldModel`.

6. Place checkpoint control after meaningful waves.
   - Use `simulation_suggestion` or `simulation_next_action` for `continue`, `revise`, and `rerun`.
   - Require a checkpoint when the wave introduces core hypotheses, low-confidence judgments, path selection, or interventions.

## Wave Planner

Before generating a wave, decide:

- What is the current graph state?
- Which upstream nodes are confirmed?
- What is the next smallest useful reasoning question?
- Which wave type answers that question?
- Which node families are underrepresented for this problem?
- Which transition rule permits the proposed downstream node?
- What should remain absent until later?

Do not organize waves by node type alone. Organize by reasoning task.

Examples:

- Good: "基于已确认的市场需求、供给能力和成本变量，提出首批因果假设。"
- Bad: "现在把所有风险、路径、建议和行动都补齐。"

## Output Discipline

Use stable IDs:

- `wave_1_skeleton`, `wave_2_context`, `wave_3_hypothesis`, `wave_4_inference`, `wave_5_risk`, `wave_6_paths`, `wave_7_intervention`, `wave_8_output`
- `entity_*`, `var_*`, `hypothesis_*`, `inference_*`, `risk_*`, `event_*`, `path_*`
- `edge_<source>_<target>` or another deterministic short ID

Keep each wave small:

- Wave 1: 2-5 nodes
- Wave 2: 1-5 evidence/context/event nodes
- Wave 3: 2-4 hypothesis nodes, 2-5 edges
- Wave 4: 1-4 inference or candidate conclusion nodes
- Wave 5: 2-5 risk/event nodes, 2-5 edges
- Wave 6: 2-3 paths, 0-3 supporting scenario/conclusion nodes
- Wave 7: 2-4 decision/action/next_action nodes
- Wave 8: 1-4 summary/report/history/recovery/suggestion nodes

If more content is useful, say it belongs in the next wave.

## Richness Requirement

A mature world model should cover these roles when the problem warrants them:

- Boundary: `prompt`, `topic`
- World actors: `entity`
- Change levers: `variable`
- Grounding: `evidence`
- Mechanism: `hypothesis`, `inference`
- Time and disturbance: `event`, `risk`
- Outcomes: `scenario`, `path`, `conclusion`
- User agency: `decision`, `action`, `next_action`
- Closure and memory: `summary`, `report`, `history`, `recovery`, `suggestion`

Do not force every node type into every problem. Instead, check whether the current model can answer:

- Who or what acts in the system?
- What variables change outcomes?
- What evidence or assumptions ground the model?
- What causal mechanism connects upstream to downstream?
- What can disturb the mechanism?
- What paths become possible?
- Where can the user intervene?
- What has been concluded, exported, revised, or recovered?

If a model cannot answer one of these questions and the question matters for the user's goal, add the missing node family in the next appropriate wave.

## Boundaries

- Risk waves must not output intervention plans.
- Scenario-path waves must not invent new core variables unless explicitly justified as a missing upstream.
- Intervention waves must not silently rewrite the problem definition.
- If the user edits an upstream node, mark dependent downstream items as stale, historical, or rerun candidates before producing replacements.
- Do not claim evidence certainty. Put assumptions and uncertainty in `data.worldModel.uncertainty` or the wave summary.
- Do not confuse evidence, hypothesis, inference, and conclusion:
  - `evidence` is observed or supplied support.
  - `hypothesis` is a proposed mechanism.
  - `inference` is a derived intermediate judgment.
  - `conclusion` is a path-level or round-level outcome.

## References

Read references only as needed:

- Read [references/wave-protocol.md](references/wave-protocol.md) when implementing or revising the wave protocol, data shape, validation rules, or product behavior.

- Read [references/node-ontology.md](references/node-ontology.md) before deciding which node types to create or when node semantics are ambiguous.

- Read [references/transition-grammar.md](references/transition-grammar.md) before generating downstream nodes or edges.

- Read [references/consistency-checks.md](references/consistency-checks.md) before finalizing a wave, rerun, summary, or report.

- Read [references/output-examples.md](references/output-examples.md) when concrete JSON blocks are needed.

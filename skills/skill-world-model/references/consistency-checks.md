# Consistency Checks

Run these checks before finalizing any wave, summary, rerun, or report.

## Structural Checks

1. Every non-boundary node has at least one upstream node.
2. Every edge connects existing nodes or nodes emitted in the same wave.
3. Edge direction follows upstream-to-downstream logic.
4. Every path references existing edges.
5. Every conclusion is linked to a path, scenario, inference, or summary.
6. Every action is linked to a decision or conclusion.
7. Reports only cite nodes, paths, and conclusions that exist.

## Semantic Checks

1. Scope: no node silently changes the confirmed time range, region, industry, or object.
2. Type: evidence is not hypothesis; hypothesis is not conclusion; risk is not action.
3. Causality: causal claims include mechanism and direction.
4. Temporality: events precede the risks, inferences, or path switches they affect.
5. Confidence: low-confidence nodes expose uncertainty and do not become final conclusions without checkpoint.
6. Completeness: the graph has enough entities, variables, mechanisms, disturbances, paths, and decisions for the user's goal.
7. Parsimony: the graph avoids decorative nodes that do not affect reasoning or user control.

## Logical Self-Consistency

Use this checklist:

- No downstream node relies on a node that is absent, stale, failed, or excluded.
- No path uses mutually exclusive assumptions unless it is explicitly a compare/counterfactual path.
- No action claims a guaranteed result; it should describe expected effect and uncertainty.
- No conclusion outranks its evidence. If evidence is weak, the conclusion must be tentative.
- No two active nodes make contradictory claims without a conflict/inference node representing that tension.

## Fullness Score

For complex problems, mentally score the model from 0-2 on each dimension:

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Actors | none | main actor only | actors plus incentives/constraints |
| Variables | vague | key variables named | variables have values/schema/direction |
| Evidence | none | assumptions visible | evidence/uncertainty linked to claims |
| Mechanism | missing | hypotheses present | hypotheses plus inference chain |
| Disturbance | missing | risks listed | risks linked to triggers/path switches |
| Scenarios | one path | multiple paths | paths comparable with probabilities/triggers |
| Agency | no action | generic suggestions | decisions/actions tied to path impacts |
| Memory | no history | summary only | report/history/recovery/suggestions trace back |

Treat this as a round-level maturity score, not a per-wave requirement. Early waves are allowed to score low because downstream content has not been derived yet. For a serious simulation, avoid ending the modeled round below 10 total unless the user asked for a quick sketch.

## Wave Finalization Checklist

Before emitting:

1. State the wave's analysis question.
2. Ensure each new node answers that question.
3. Ensure each new node has rationale and upstream IDs.
4. Ensure each new edge has a reason.
5. Check whether a richer node family is needed before moving downstream.
6. Add a checkpoint if downstream paths, user decisions, or low-confidence claims are affected.

## Report Consistency

A report must not become a separate essay. It should be a projection of the graph.

Every core report claim should cite:

- `[node: node_id]`
- `[path: path_id]`
- `[edge: edge_id]`
- `[scenario: scenario_id]`

If a claim cannot cite the graph, either add the missing node first or remove the claim.

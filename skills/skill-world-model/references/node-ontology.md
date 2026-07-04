# Node Ontology

Use this reference to decide what each node means. A world model is logical only if each node type has a stable job.

## Node Roles

| Type | Role | Should contain | Should not contain |
|---|---|---|---|
| `prompt` | Raw user input | Original wording, source text | AI interpretation |
| `topic` | Confirmed problem boundary | Problem, goal, scope, assumptions, state | Downstream conclusions |
| `entity` | Actor or object in the modeled world | Role, incentives, constraints, affected variables | Generic abstract factors better modeled as variables |
| `variable` | Changeable factor that affects outcomes | Current/default value, value schema, direction if known | Fixed facts or one-time events |
| `evidence` | Observed or supplied support | Source, credibility, observation, linked claim | Unsourced speculation |
| `hypothesis` | Proposed causal mechanism | Mechanism statement, expected direction, assumptions | Final conclusion or action |
| `inference` | Derived intermediate judgment | Inputs used, reasoning step, confidence | Raw evidence or final path |
| `event` | Time-bound occurrence or external shift | Timing, trigger, affected variables/entities | Persistent factor better modeled as variable |
| `risk` | Uncertain downside or path-switch condition | Probability/impact/controllability, trigger | Mitigation plan |
| `scenario` | Coherent state of the world | Combined assumptions, included paths | Single causal edge |
| `conclusion` | Outcome judgment for a wave/path/round | What follows if upstream holds, confidence | New evidence or hidden assumptions |
| `decision` | Choice point for user/system | Options, tradeoffs, impacted paths | Executed action |
| `action` | Concrete intervention | Owner, action, expected effect, preconditions | Guaranteed outcome |
| `next_action` | UI-facing continuation command | Continue/add data/rerun/generate report | New analysis content |
| `summary` | Stage-level synthesis | What changed this wave, key implications | Unsupported claims |
| `report` | Persistent output artifact | File path, covered paths/nodes, status | Unwritten file claims |
| `history` | Prior version or rerun memory | Round ID, changed inputs, superseded nodes | Current active conclusion |
| `recovery` | Failure or repair state | Failure cause, retry path, preserved context | Normal scenario content |
| `suggestion` | Optional continuation | Why it is useful, target node/path | Mandatory conclusion |

## Required Metadata

Every analytical node should include:

```json
{
  "data": {
    "worldModel": {
      "waveId": "wave_3_hypothesis",
      "waveIndex": 3,
      "waveType": "causal_hypothesis",
      "waveTitle": "建立因果机制",
      "analysisQuestion": "这一步在回答什么？",
      "upstreamNodeIds": ["topic_definition", "var_example"],
      "rationale": "为什么这个节点从上游推出？",
      "confidence": 0.7,
      "uncertainty": []
    }
  }
}
```

Use `status: "active"` for nodes still under analysis, `confirmed` for user-confirmed nodes, `historical` for superseded nodes, `updated` for rerun replacements, and `failed` only for recovery/error cases.

## Richness Heuristic

A full world model usually needs at least one node in each needed role:

- boundary: `prompt`, `topic`
- system structure: `entity`, `variable`
- grounding: `evidence` or explicit uncertainty
- mechanism: `hypothesis`, `inference`
- disturbance: `event`, `risk`
- branch/outcome: `scenario`, `path`, `conclusion`
- user agency: `decision`, `action`, `next_action`
- closure: `summary`, `report`, `suggestion`, `history`, `recovery`

Do not add all roles mechanically. Add a missing role only when it improves explanation, control, or traceability for the user's problem.

## Node Quality Test

Before emitting a node, answer:

1. What question does this node answer?
2. Which upstream node(s) make it necessary?
3. Is this the right node type, or is it actually evidence, hypothesis, inference, risk, or conclusion?
4. What downstream decisions or paths could depend on it?
5. What would make it false, stale, or need rerun?

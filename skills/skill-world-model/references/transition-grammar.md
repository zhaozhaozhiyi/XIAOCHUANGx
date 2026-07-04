# Transition Grammar

Use this reference to keep the world model causal, traceable, and non-random.

## Core Grammar

Allowed high-level transitions:

```text
prompt -> topic
topic -> entity
topic -> variable
topic -> evidence
entity -> variable
variable -> hypothesis
evidence -> hypothesis
hypothesis -> inference
evidence -> inference
variable -> inference
event -> variable
event -> risk
risk -> scenario
risk -> path
inference -> scenario
inference -> conclusion
scenario -> path
path -> conclusion
conclusion -> decision
decision -> action
action -> next_action
summary -> report
any active node -> suggestion
any superseded node -> history
failed step -> recovery
```

Allowed edge types:

- `temporal`: order, sequence, lifecycle, version transition.
- `causal`: mechanism, influence, trigger, path dependency.
- `evidence_support`: evidence or source supports a hypothesis, inference, or conclusion.

## Edge Direction

Edges should point from upstream cause/support/time predecessor to downstream effect/claim/time successor.

Good:

```text
var_demand_strength -> hypothesis_margin_pressure
evidence_order_decline -> inference_demand_softening
risk_policy_shift -> path_risk
path_base -> conclusion_base
```

Bad:

```text
conclusion_base -> var_demand_strength
action_reduce_cost -> evidence_order_decline
```

unless the edge is explicitly a temporal update or history relation.

## Wave Transition Defaults

### From Problem Boundary To Skeleton

Use:

```text
topic -> entity
topic -> variable
```

Ask: which actors and variables are necessary before any mechanism can be discussed?

### From Skeleton To Evidence/Context

Use:

```text
topic/entity/variable -> evidence
topic -> event
```

Ask: what has the user supplied, what is assumed, and what is missing?

### From Evidence/Context To Hypotheses

Use:

```text
variable + evidence -> hypothesis
entity + variable -> hypothesis
event + variable -> hypothesis
```

Ask: what mechanism could connect these upstream facts?

### From Hypotheses To Inference

Use:

```text
hypothesis + evidence -> inference
hypothesis + variable -> inference
```

Ask: what intermediate judgment follows if the mechanism is plausible?

### From Inference To Risk

Use:

```text
inference -> risk
event -> risk
variable -> risk
```

Ask: what could invalidate or redirect the inference?

### From Risk/Inference To Paths

Use:

```text
inference + risk + variable -> scenario
scenario -> path
path -> conclusion
```

Ask: which coherent branches are now possible?

### From Conclusions To Intervention

Use:

```text
conclusion -> decision
decision -> action
action -> next_action
```

Ask: where can the user act, and what changes if they act?

### From Any Stage To Output/Memory

Use:

```text
confirmed conclusion/path -> summary
summary -> report
stale node -> history
failed generation -> recovery
active node -> suggestion
```

Ask: what should be preserved, exported, repaired, or continued?

## Disallowed Shortcuts

Avoid these unless the user explicitly asks and the rationale is visible:

- `topic -> action`: skips the model.
- `variable -> conclusion`: skips mechanism.
- `evidence -> conclusion`: skips interpretation.
- `risk -> action`: skips path and decision.
- `scenario -> report`: skips conclusion or summary.

If a shortcut is unavoidable, emit an `inference` or `summary` node that explains the compression.

## Contradiction Handling

When two upstream nodes conflict:

1. Do not choose silently.
2. Add an `inference` node that states the conflict.
3. Add uncertainty to affected downstream nodes.
4. Require a checkpoint if the conflict changes paths or interventions.

Example:

```text
evidence_orders_up + evidence_margin_down -> inference_volume_margin_divergence -> risk_profit_squeeze
```

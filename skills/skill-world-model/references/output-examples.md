# Output Examples

These examples use existing P0-compatible simulation parts.

## Minimal Scenario Shell After Confirmation

Only use a scenario shell to initialize prompt/topic state. Do not include downstream world-model content in the shell.

```json
{
  "kind": "simulation_scenario",
  "title": "世界模型初始化",
  "scenario": {
    "prompt": {
      "id": "prompt_root",
      "type": "prompt",
      "label": "用户原问题",
      "detail": "用户输入的原始问题",
      "roundId": "round_1",
      "status": "confirmed"
    },
    "topic": {
      "id": "topic_definition",
      "type": "topic",
      "label": "已确认的问题定义",
      "detail": "问题、目标、范围、默认假设",
      "roundId": "round_1",
      "status": "confirmed"
    },
    "topicDefinition": {
      "problem": "已确认的问题",
      "goal": "推演目标",
      "state": "modeling_world"
    },
    "entities": [],
    "variables": [],
    "assumptions": [],
    "paths": [],
    "edges": [
      {
        "id": "edge_prompt_topic",
        "type": "temporal",
        "source": "prompt_root",
        "target": "topic_definition",
        "label": "问题定义",
        "roundId": "round_1"
      }
    ],
    "provenance": {
      "source": "llm",
      "label": "Wave-driven world model",
      "reason": "问题边界已确认，世界模型将按 wave 增量构建。",
      "generatedAt": "2026-07-03T00:00:00.000Z"
    }
  }
}
```

## Wave 1: Skeleton Node

```json
{
  "kind": "simulation_node",
  "node": {
    "id": "var_demand_strength",
    "type": "variable",
    "label": "需求强度",
    "detail": "决定市场消化速度和价格/利润弹性的核心变量。",
    "roundId": "round_1",
    "status": "active",
    "value": "中性",
    "defaultValue": "中性",
    "valueSchema": {
      "kind": "enum",
      "options": ["偏弱", "中性", "偏强"]
    },
    "data": {
      "worldModel": {
        "waveId": "wave_1_skeleton",
        "waveIndex": 1,
        "waveType": "skeleton",
        "waveTitle": "搭建核心变量骨架",
        "analysisQuestion": "本问题最先需要观察哪些核心变量？",
        "upstreamNodeIds": ["topic_definition"],
        "rationale": "用户的问题关注结果走向，需求强度通常是决定结果分叉的第一层变量。",
        "confidence": 0.72,
        "uncertainty": []
      }
    }
  }
}
```

## Wave 3: Hypothesis Node And Edge

Emit the hypothesis node before emitting an edge that targets it.

```json
{
  "kind": "simulation_node",
  "node": {
    "id": "hypothesis_margin_pressure",
    "type": "hypothesis",
    "label": "需求转弱压缩利润空间",
    "detail": "若需求强度转弱，价格折让和产能利用率下降可能共同压缩利润空间。",
    "roundId": "round_1",
    "status": "active",
    "data": {
      "worldModel": {
        "waveId": "wave_3_hypothesis",
        "waveIndex": 3,
        "waveType": "causal_hypothesis",
        "waveTitle": "建立首批因果假设",
        "analysisQuestion": "核心变量之间通过什么机制影响结果？",
        "upstreamNodeIds": ["var_demand_strength"],
        "rationale": "需求强度影响价格弹性和产能利用率，因此可以作为利润压力的上游机制。",
        "confidence": 0.68,
        "uncertainty": ["缺少分客户价格折让数据"]
      }
    }
  }
}
```

```json
{
  "kind": "simulation_edge",
  "edge": {
    "id": "edge_demand_margin",
    "type": "causal",
    "source": "var_demand_strength",
    "target": "hypothesis_margin_pressure",
    "label": "需求强度通过价格弹性和产能利用率影响利润空间",
    "roundId": "round_1"
  }
}
```

## Rich Wave Sequence

For complex problems, do not stop at variables and paths. A healthy sequence should include grounding, mechanism, disturbance, and agency:

```json
{
  "kind": "simulation_node",
  "node": {
    "id": "evidence_orders_softening",
    "type": "evidence",
    "label": "订单边际转弱",
    "detail": "用户提供材料显示新增订单增速放缓，用于支撑需求变量的偏弱判断。",
    "roundId": "round_1",
    "status": "active",
    "evidenceSource": "用户材料",
    "evidenceCredibility": "medium",
    "data": {
      "worldModel": {
        "waveId": "wave_2_context",
        "waveIndex": 2,
        "waveType": "evidence_context",
        "waveTitle": "补充证据与上下文",
        "analysisQuestion": "哪些材料能支撑或约束核心变量？",
        "upstreamNodeIds": ["topic_definition", "var_demand_strength"],
        "rationale": "需求强度需要可观察材料支撑，否则后续假设会悬空。",
        "confidence": 0.62,
        "uncertainty": ["材料未覆盖全部客户类型"]
      }
    }
  }
}
```

```json
{
  "kind": "simulation_node",
  "node": {
    "id": "inference_volume_margin_divergence",
    "type": "inference",
    "label": "销量与利润可能分化",
    "detail": "即使销量保持，价格折让或成本压力也可能导致利润承压。",
    "roundId": "round_1",
    "status": "active",
    "data": {
      "worldModel": {
        "waveId": "wave_4_inference",
        "waveIndex": 4,
        "waveType": "intermediate_inference",
        "waveTitle": "形成中间推理",
        "analysisQuestion": "基于证据和假设，可以推出哪些中间判断？",
        "upstreamNodeIds": ["hypothesis_margin_pressure", "evidence_orders_softening"],
        "rationale": "订单转弱会提高价格竞争压力，利润变化可能先于销量显性下滑。",
        "confidence": 0.66,
        "uncertainty": ["缺少毛利率分产品拆分"]
      }
    }
  }
}
```

## Wave 4: Path

```json
{
  "kind": "simulation_path",
  "path": {
    "id": "path_base",
    "label": "基准路径",
    "probability": 0.52,
    "status": "available",
    "edgeIds": ["edge_demand_margin", "edge_policy_risk_margin"],
    "summary": "基于 wave_3_hypothesis 与 wave_5_risk：需求保持中性、外部扰动可控时，利润压力温和释放。上游：var_demand_strength, hypothesis_margin_pressure, risk_policy_shift。",
    "roundId": "round_1"
  }
}
```

## Checkpoint Suggestion

```json
{
  "kind": "simulation_suggestion",
  "suggestions": [
    {
      "suggestionId": "continue_wave_5",
      "title": "继续分析风险扰动",
      "description": "基于已确认的变量和因果假设，进入下一波风险/事件分析。",
      "basedOnConclusionId": "conclusion_candidate_margin"
    },
    {
      "suggestionId": "rerun_wave_3",
      "title": "重推本步假设",
      "description": "如果你认为变量之间的关系不对，可以基于当前变量重新生成因果假设。",
      "basedOnConclusionId": "conclusion_candidate_margin"
    }
  ]
}
```

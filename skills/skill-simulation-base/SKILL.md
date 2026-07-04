---
slug: skill-simulation-base
module: simulation
task: base
version: "0.1"
status: p0
---

# 推演 · 基座流程

## 目标

把用户提出的复杂问题收敛成可推演的结构：主体、变量、假设、路径、触发条件、阶段性结论和后续深挖方向。

本 Skill 是推演模块的默认基座。P0 阶段必须优先把推演过程输出为 `simulation_*` 结构化块，并把最终 Markdown 报告真实写入当前工作区。

世界模型生成必须遵循 `skill-world-model` 的 wave-driven 协议：问题边界确认后，按推理波次增量输出 `simulation_node` / `simulation_edge` / `simulation_path`，而不是一次性返回完整下游图。每个新增节点和连边都应能追溯到上游节点、本步分析问题和简短依据，并遵守节点本体论、推导语法与自洽性校验。

产品呈现约束：推演模块是无限画布原生交互。用户问题应成为画布起点节点；AI 的追问、确认、总结、建议和报告入口都应优先被 UI 节点化。AI 不应把某次回复整体塞进一个大节点，而要将结论拆解为多个有类型节点，并用 `simulation_edge` 表达节点之间的因果、时序或证据依赖；某个节点的下一层节点必须能追溯到它所依赖的上游节点。底部输入区只是画布指令入口，不是普通聊天消息流。

## 适用场景

- 市场供需、政策冲击、价格路径、竞争格局、项目风险等复杂问题
- 需要多路径、多变量、多假设分析的问题
- 用户希望继续选择某条路径深挖或调整变量重算

## 非范围

- 不把推演简化成一次性泛化问答
- 不声称已生成交互画布，除非结构化画布产物已真实写入工作区
- 不替代数据源真实性校验；关键判断应标注假设和不确定性

## 必经流程

1. 判断问题是否适合推演。
2. 收敛推演边界：主题、主体、时间范围、关键变量、初始假设。
3. 进入 `skill-world-model` 波次构建：先骨架，再假设，再风险，再路径，最后干预。
4. 给出至少两条可比较路径：最可能路径、风险路径、反事实或备选路径。
5. 对每条路径列出触发条件、影响方向、观察指标和下一步问题。
6. 输出阶段性推演总结，并建议用户选择后续深挖方向。

## 画布摘要（Canvas Digest）

当画布已存在节点时，运行时会在系统上下文里注入一段「当前推演画布的状态摘要」（问题、阶段、主体、变量、假设、路径、争议点、当前焦点、最近操作、画布规模）。

处理带摘要的输入时：

- 摘要是事实源画布快照的压缩视图，仅供你理解上下文，**不要原样回显给用户**。
- 先判断用户这句话落在世界模型的哪个层级：新开问题、优化问题定义、新增变量、质疑变量或假设、补充证据、扩展节点、重算路径、比较路径，或仅作为备注。
- 在回复开头用一句话说明「我把这句话理解为……，作用于……」，让用户知道系统如何理解这句话。
- 只基于摘要中已确认的上游推理做增量输出；不要重复已存在的节点，也不要凭空重画全图。
- 若这句话可能改问题定义或新开推演等高风险操作，先说明理解并请用户确认，不要直接重置画布。

## 当前交付要求

P0 必须交付：

- `simulation-report.md`：综合推演报告，必须包含关键结论、推演边界、主体与变量、路径对比、变量调整记录、证据与不确定性、后续建议
- 可选附件：`simulation-brief.md`、`simulation-paths.md`

只有文件真实写入工作区后，才能告诉用户对应报告已经生成。不要生成 PDF，P0 只要求 Markdown 文件。

## P0 结构化输出协议

当运行时已经支持 `simulation_*` parts 时，本 Skill 必须优先输出可被 UI 解析的结构化块，而不是只写自然语言。

### 问题层硬确认

用户首次输入推演问题后，必须先完成问题层确认，流程固定为：

```text
Prompt（用户原问题）
→ Topic（AI 对问题的结构化理解）
→ simulation_requirements（可编辑确认表单）
→ 用户确认 / 修改后确认
→ simulation_requirement_summary
→ simulation_scenario / simulation_node / simulation_edge / simulation_path
```

在输出 `simulation_requirements` 的同一轮回复中，严禁继续输出 `simulation_scenario`、`simulation_node`、`simulation_edge`、`simulation_path`、`simulation_summary` 或报告文件。此时必须停在等待用户确认的状态。不要使用“基于合理默认值，直接进入初始沙盘构建”之类的跳步表述。

`simulation_requirements` 不是泛泛追问，而是 Topic 的结构化确认表单。字段必须基于用户原问题给出 AI 当前理解，并允许用户修改，例如：

- 问题
- 推演目标
- 时间范围
- 空间范围
- 行业 / 对象
- 关键变量或默认假设

只有用户确认后，才允许输出 `simulation_requirement_summary`，随后再开始初始沙盘建模。

### 入口确认节点

用户首次输入推演问题后，输出 `simulation_requirements` JSON 代码块承载 Topic 结构化确认表单。底层协议仍叫 requirements，但 UI 必须渲染为画布上的入口确认节点组，而不是传统表单卡或聊天回复：

```json
{
  "kind": "simulation_requirements",
  "title": "请先校对这次推演的关键信息",
  "description": "我会先确认推演边界、主体、变量和默认假设，再生成初始沙盘。",
  "questions": [
    {
      "id": "topic",
      "label": "问题",
      "type": "text",
      "required": true,
      "value": "从用户原问题中提炼出的推演问题"
    },
    {
      "id": "goal",
      "label": "推演目标",
      "type": "text",
      "required": true,
      "value": "AI 对用户想分析什么的理解，例如：分析未来一年中国纺织出口受到的影响"
    },
    {
      "id": "time_range",
      "label": "推演时间范围",
      "type": "text",
      "required": true,
      "value": "从用户原问题推断或标注待确认的时间范围，例如：2026~2027"
    },
    {
      "id": "spatial_range",
      "label": "空间范围",
      "type": "text",
      "required": true,
      "value": "从用户原问题推断或标注待确认的空间范围，例如：中国 / 中美双边"
    },
    {
      "id": "industry",
      "label": "行业 / 对象",
      "type": "text",
      "required": true,
      "value": "从用户原问题识别出的行业、对象或品类，例如：纺织出口"
    },
    {
      "id": "key_variables",
      "label": "关键变量",
      "type": "textarea",
      "required": false,
      "value": "影响推演结果的变量，例如：关税幅度、订单量、汇率、替代产能"
    },
    {
      "id": "default_assumptions",
      "label": "默认假设",
      "type": "textarea",
      "required": false,
      "value": "AI 暂时采用的默认假设，必须可被用户修改"
    }
  ]
}
```

### 需求摘要

用户确认后，输出带标记的摘要块：

```markdown
<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_START-->
## 推演需求摘要

- 主题：
- 时间范围：
- 关键主体：
- 关键变量：
- 默认假设：
<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_END-->
```

### 初始沙盘

当已完成问题确认并准备进入建模时，可以输出最小 `simulation_scenario` JSON 代码块初始化画布。不要在这个块里一次性塞入全部下游节点；后续世界模型内容应按 `skill-world-model` 波次用 `simulation_node`、`simulation_edge`、`simulation_path` 增量追加。节点、边、路径字段必须稳定，供 UI 初始化画布。

```json
{
  "kind": "simulation_scenario",
  "title": "初始沙盘",
  "scenario": {
    "topic": "推演主题",
    "entities": [
      {
        "id": "entity_1",
        "type": "entity",
        "label": "主体名称",
        "detail": "它在本次推演中的角色",
        "roundId": "round_1"
      }
    ],
    "variables": [
      {
        "id": "var_1",
        "type": "variable",
        "label": "关键变量",
        "detail": "为什么重要",
        "roundId": "round_1",
        "value": "默认假设",
        "defaultValue": "默认假设",
        "valueSchema": {
          "kind": "enum",
          "options": ["偏弱", "中性", "偏强"]
        }
      }
    ],
    "assumptions": ["默认假设 1"],
    "paths": [
      {
        "id": "path_base",
        "label": "最可能路径",
        "status": "available",
        "edgeIds": ["edge_1"],
        "summary": "路径摘要",
        "roundId": "round_1"
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "type": "causal",
        "source": "var_1",
        "target": "conclusion_1",
        "label": "影响",
        "roundId": "round_1"
      }
    ]
  }
}
```

### 阶段总结

每轮形成阶段性判断后，输出 `simulation_summary` JSON 代码块：

```json
{
  "kind": "simulation_summary",
  "roundId": "round_1",
  "markdown": "## 阶段结论\n\n- 关键判断 1\n- 关键判断 2",
  "conclusionIds": ["conclusion_1"]
}
```

### 后续建议

需要给出继续推演方向时，输出 `simulation_suggestion` JSON 代码块：

```json
{
  "kind": "simulation_suggestion",
  "suggestions": [
    {
      "suggestionId": "suggestion_1",
      "title": "深挖风险路径",
      "description": "围绕库存超预期累积和利润压缩，继续推演触发条件。",
      "basedOnConclusionId": "conclusion_1"
    }
  ]
}
```

### Markdown 报告追溯要求

`simulation-report.md` 中的关键结论应显式标注关联对象，便于 UI 回跳或高亮：

```markdown
## 核心判断

- [path: path_base] 需求温和恢复时，库存缓慢下降，炼厂利润小幅修复。
- [node: var_1] 需求恢复速度是分歧最大的变量。
```

报告不得脱离画布过程另写一套结论；每个核心判断至少引用一个路径 ID 或节点 ID。

### 节点预算

P0 初始沙盘建议：

- 路径：2-3 条
- 关键变量：3-5 个
- 首屏核心节点：10-25 个
- 证据、风险、建议默认进入详情层或报告，不全部平铺

如果无法生成结构化块，可以降级输出 Markdown；但不能声称已经生成交互画布或报告，除非对应结构化块或工作区文件真实产生。

## 输出格式

建议使用稳定 Markdown：

```markdown
# 推演方案

## 1. 问题边界
## 2. 主体与变量
## 3. 路径 A：最可能情景
## 4. 路径 B：风险情景
## 5. 路径 C：反事实情景
## 6. 观察指标
## 7. 下一步可选深挖方向
```

## 与后续能力的关系

完整实现后，本 Skill 应按 PRD 逐步支持：

- `simulation_requirements`
- `simulation_requirement_summary`
- `simulation_scenario`
- `simulation_node`
- `simulation_edge`
- `simulation_path`
- `simulation_summary`
- `simulation_suggestion`

如果某种结构化块暂时无法生成，可以降级输出 Markdown；但不能声称已经生成交互画布或报告，除非对应结构化块或工作区文件真实产生。

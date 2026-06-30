---
slug: skill-simulation-base
module: simulation
task: base
version: "0.1"
status: planning
---

# 推演 · 基座流程

## 目标

把用户提出的复杂问题收敛成可推演的结构：主体、变量、假设、路径、触发条件、阶段性结论和后续深挖方向。

本 Skill 是推演模块的默认基座。当前阶段先保证导航可见、对话链路可运行、推演问题可结构化；专用画布、Round 快照与 `simulation_*` 结构化卡片按推演模块 PRD 后续补齐。

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
3. 给出至少两条可比较路径：最可能路径、风险路径、反事实或备选路径。
4. 对每条路径列出触发条件、影响方向、观察指标和下一步问题。
5. 输出阶段性推演总结，并建议用户选择后续深挖方向。

## 当前交付要求

在画布协议完整接入前，优先交付：

- `simulation-brief.md`：推演边界与变量
- `simulation-paths.md`：路径、触发条件、影响链
- `simulation-report.md`：阶段性总结和后续建议

只有文件真实写入工作区后，才能告诉用户对应报告已经生成。

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

在这些 `parts[]` 类型落地前，使用普通 Markdown 摘要和工作区文件承载结果。

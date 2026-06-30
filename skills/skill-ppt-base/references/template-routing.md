# PPT 模版路由建议

## 目标

在 `skill-ppt-base` 完成需求收敛后，选择一个最合适的主 PPT 模版 Skill。

## 路由规则

| 场景 / 信号 | 优先 Skill |
|-------------|------------|
| 融资、路演、客户提案、销售提案、商务说服 | `skill-ppt-pitch-deck` |
| 周报、阶段同步、经营例会、状态汇报 | `skill-ppt-weekly-report` |
| 季度复盘、阶段复盘、路线图回顾 | `skill-ppt-quarterly-review` |
| 技术方案、技术分享、方法介绍 | `skill-ppt-tech-sharing` |
| 知识体系、框架拆解、结构蓝图 | `skill-ppt-knowledge-arch` |
| 强调金融专业感、研究机构风格 | `skill-ppt-fintech-swiss` 或 `skill-ppt-blue-professional` |
| 杂志化叙事、编辑感表达 | `skill-ppt-editorial-burgundy` 或 `skill-ppt-guizang-editorial` |
| 无明显风格指向 | `skill-ppt-deck` |

## 选择原则

1. 先看业务场景，再看视觉偏好。
2. 一次只选一个主模版 Skill。
3. 若用户明确指定模版，以用户指定为准。
4. 若用户只说“做一个 PPT”，默认退回 `skill-ppt-deck`。

## 交接要求

把以下内容带给后续主模版 Skill：

- 已确认的需求摘要
- 用户提供的材料路径
- 页数与风格偏好
- 必须保留内容
- 是否要求最终输出 PPTX、HTML，或两者都要

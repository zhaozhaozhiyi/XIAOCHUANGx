# 写作结构化追问协议

## 目标

让 `skill-writing-base` 能把“缺失的关键信息”返回成稳定的 AI to UI 数据结构，便于前端渲染为问题卡。

关键边界：

- **问题内容由 AI 决定**：问什么、问几题、每题类型与选项，均由当前回合的 AI 根据用户需求动态生成。
- **前端只负责通用渲染**：前端不能把“通知/报告/纪要”等业务问题写死成固定表单，只能渲染 AI 返回的结构化协议。
- **结构化优先，文本退化兜底**：理想路径是 AI 直接返回结构化问题；自然语言解析只作为兼容兜底，不能反过来成为主设计方式。
- **真实链路验收优先**：是否完成，以真实 Companion / Runtime / `parts[]` 输出验证为准，`mock` 只能用于开发联调。

## 追问时机

仅当以下信息不足以进入大纲时追问：

- 主题
- 体裁
- 受众
- 用途

篇幅、风格、材料、必须保留内容属于次级信息，可按情况追问。

若主题、体裁、受众、用途在首轮中已经明确到足以进入摘要阶段，则：

- 禁止返回 `kind: "writing_requirements"`
- 禁止为了“形式完整”再造一张表单
- 应直接输出 `writing_requirement_summary` 或先输出普通摘要确认文本

换言之，结构化问题卡只在“确实缺关键信息”时出现，不能变成固定首轮流程。

## 单轮问题上限

- 每轮最多 4 题
- 优先单选或短文本
- 尽量一轮收够，不要拖成多轮问卷

## 建议字段

每个问题建议包含：

- `kind`
- `title`
- `description`
- `id`
- `label`
- `type`
- `required`
- `description`
- `placeholder`
- `options`

## 建议类型

| type | 用途 |
|------|------|
| `text` | 单行文本 |
| `textarea` | 多行说明 |
| `single_select` | 单选 |
| `multi_select` | 多选 |
| `date` | 日期 |
| `time` | 时间 |
| `datetime` | 日期时间 |
| `number` | 数字 |
| `file_pick` | 从工作区选文件 |
| `file_upload` | 上传附件 |

## 示例

```json
{
  "kind": "writing_requirements",
  "title": "为了先确认这篇文稿的方向，我还需要补 3 个信息",
  "questions": [
    {
      "id": "genre",
      "label": "这篇文稿更接近哪一种？",
      "type": "single_select",
      "required": true,
      "options": [
        { "label": "研究报告" },
        { "label": "政策解读" },
        { "label": "正式公文" },
        { "label": "会议纪要" }
      ]
    },
    {
      "id": "audience",
      "label": "主要写给谁看？",
      "type": "text",
      "required": true,
      "placeholder": "例如：内部管理层、客户、研究员、政府关系团队"
    }
  ]
}
```

## 退化策略

若当前运行时还不支持结构化卡片，则用编号问题代替，但问题内容保持同样的选择逻辑。

## 摘要确认

收到回答后，应生成一份 `writing_requirement_summary`，并等待用户确认后再进入大纲。

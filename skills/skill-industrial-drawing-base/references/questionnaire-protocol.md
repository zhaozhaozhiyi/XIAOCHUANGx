# 工业制图结构化追问协议

## 目标

让 `skill-industrial-drawing-base` 能把缺失的制图关键信息返回成稳定的 AI to UI 数据结构，便于前端像写作 / PPT 一样渲染问题卡，并在用户补充后继续进入摘要、结构方案和真实文件生成。

关键边界：

- 问题内容由 AI 根据当前任务动态决定，前端只负责通用渲染。
- 结构化追问只在缺少关键几何信息时使用，不能变成固定表单。
- 真实链路验收优先：是否完成，以 Companion / Runtime / 工作区文件输出为准，mock 只能用于开发联调。
- 追问的目标是生成可编译、可编辑、可导出的 CAD Artifact，而不是收集一份无法落盘的说明书。

## 追问时机

仅当以下信息不足以形成参数化草模时追问：

- 对象类型：支架、法兰、容器、管线、外壳、底座、装配示意等。
- 关键尺寸：长、宽、高、直径、厚度、孔径、孔距、数量等。
- 工业意图：报告示意、加工沟通、3D 打印、二维投影、结构草案等。
- 必须保留结构：孔、槽、支脚、法兰、加强筋、开口、接口、阵列等。

若对象、主要尺寸和工业意图已经足够明确，应直接输出 `3d_requirement_summary`，不要为了形式完整再发需求卡。

## 单轮问题上限

- 每轮最多 4 题。
- 优先 `single_select`、`number`、`text`、`textarea`。
- 尺寸单位默认 `mm`，除非用户明确指定其他单位。
- 对缺失但可合理默认的次级信息，写入摘要的“默认假设”，不要因此阻断生成。

## 建议字段

每个问题建议包含：

- `kind`
- `title`
- `description`
- `id`
- `label`
- `type`
- `required`
- `placeholder`
- `options`

## 建议类型

| type | 用途 |
|------|------|
| `text` | 对象名称、结构说明 |
| `textarea` | 复杂约束、已有图纸修改说明 |
| `single_select` | 对象类型、用途、输出格式 |
| `multi_select` | 必须包含的结构 |
| `number` | 尺寸、数量、厚度、孔径 |
| `file_pick` | 从工作区选择已有 `.scad` / `.stl` / `.dxf` |
| `file_upload` | 上传参考图或已有图纸 |

## 示例

```json
{
  "kind": "3d_requirements",
  "title": "为了生成可编辑的参数化图纸，我还需要补 3 个信息",
  "questions": [
    {
      "id": "object_type",
      "label": "要绘制哪类工业结构？",
      "type": "single_select",
      "required": true,
      "options": [
        { "label": "安装支架" },
        { "label": "法兰接口" },
        { "label": "容器 / 罐体" },
        { "label": "设备外壳" }
      ]
    },
    {
      "id": "main_dimensions",
      "label": "请给出主要尺寸，默认单位 mm",
      "type": "textarea",
      "required": true,
      "placeholder": "例如：长 120、宽 80、高 40、板厚 4、孔径 8"
    },
    {
      "id": "output_goal",
      "label": "这版图纸主要用于什么？",
      "type": "single_select",
      "required": true,
      "options": [
        { "label": "报告示意" },
        { "label": "加工沟通" },
        { "label": "3D 打印预览" },
        { "label": "二维 DXF 投影" }
      ]
    }
  ]
}
```

## 摘要确认

收到回答后，应生成 `3d_requirement_summary`。

- 若这是首轮信息充分后直接输出的摘要，可以等待用户确认后再进入结构方案。
- 若这是用户对 `3d_requirements` 表单或编号追问的补充回答，则这次补充视为 brief 已确认：必须输出 `3d_requirement_summary`，继续输出 `3d_outline`，并生成 `.scad` 与 `drawing.parameters.json`。
- 若 OpenSCAD CLI / WASM 可用，应继续尝试生成 `exports/drawing.stl` 或 `exports/drawing.dxf`；不可用时仍必须落盘 `.scad` 与参数 JSON。

## 隐藏标记

摘要阶段必须优先使用以下标记，便于 Companion 解析：

```markdown
<!--JLC:3D_REQUIREMENT_SUMMARY_START-->
## 3D 制图需求摘要
- 对象：
- 用途：
- 关键尺寸：
- 必须结构：
- 输出目标：
- 默认假设：
<!--JLC:3D_REQUIREMENT_SUMMARY_END-->
```

结构方案阶段必须优先使用以下标记：

```markdown
<!--JLC:3D_OUTLINE_START-->
# 参数化结构方案

1. 主体结构
2. 安装 / 连接结构
3. 导出计划
<!--JLC:3D_OUTLINE_END-->
```

标记内只放摘要或方案正文，不要放额外解释。

## 禁止

- 不要把 3D 需求追问写成普通闲聊。
- 不要重复询问用户已经明确给出的尺寸或用途。
- 不要为了等待完整工程图而拒绝生成草模；能生成可调草模时先生成。
- 不要在未落盘文件时声称“已生成图纸”。

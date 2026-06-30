---
slug: skill-industrial-drawing-base
module: 3d
task: drawing
version: "1.0"
status: active
---

# 工业制图 · 基座流程

## 目标

把用户的自然语言、参考图或已有图纸修改需求，收敛成一次可执行的工业制图任务，并选择后续制图 Skill 与执行引擎。

本 Skill 对齐 CADAM 的核心逻辑：**意图判断 → 需求摘要 → 结构方案 → 参数化 Artifact → OpenSCAD 编译预览 → 参数编辑 → 重新编译 → 导出交付**。

在小窗产品中，本 Skill 是 3D 模块的默认基座 Skill。页面结构沿用写作 / PPT 的对话式工作流，但执行结果必须进入工作区，成为可继续编辑、预览和导出的 CAD 文件。

详细执行规范见：

- [references/cadam-core-flow.md](./references/cadam-core-flow.md)
- [references/cadam-alignment-checklist.md](./references/cadam-alignment-checklist.md)
- [references/questionnaire-protocol.md](./references/questionnaire-protocol.md)

## 适用场景

| 场景 | 处理方式 |
|------|----------|
| 新建零件 / 结构件 / 设备草模 | 转入 `skill-industrial-drawing-parametric` |
| 修改已有参数化图纸 | 保留原始表达，只生成增量参数修改 |
| 导出 DXF / SVG / PDF / STL | 转入 `skill-industrial-drawing-export` |
| 单纯解释图纸 | 可直接回答，不生成 Artifact |
| 创意 Mesh / 艺术 3D | 提醒用户该模块优先服务工业参数化制图 |

## 输入收敛

如果信息不足，只追问会影响几何结果或导出的关键问题：

1. 对象类型：零件、支架、容器、管线、设备外形、装配示意。
2. 关键尺寸：长、宽、高、直径、厚度、孔径、间距。
3. 用途：报告示意、3D 打印、二维工程图、加工前沟通。
4. 输出格式：默认同时保留参数化表达和预览，按需导出。

不要用长问卷阻断用户。能先生成草模时，先生成可调草模。

若需要结构化追问，优先输出 `kind: "3d_requirements"`；若信息已经足够，禁止为了流程完整再发表单。

## 逻辑链路

1. 判断用户意图是否属于工业制图。
2. 形成 `drawing_brief`：对象、尺寸、结构、约束、导出目标。
3. 输出 `3d_requirement_summary`，并用 `<!--JLC:3D_REQUIREMENT_SUMMARY_START-->` / `<!--JLC:3D_REQUIREMENT_SUMMARY_END-->` 包住完整摘要正文。
4. 输出 `3d_outline`，并用 `<!--JLC:3D_OUTLINE_START-->` / `<!--JLC:3D_OUTLINE_END-->` 包住结构方案。
5. 生成完整 OpenSCAD 参数化源码，遵循 `skill-industrial-drawing-parametric` 的规则。
6. 将源码和参数文件写入工作区，不把大段源码塞进普通聊天文本。
7. 如果环境具备 OpenSCAD CLI、WASM 或其他 CAD 导出能力，继续导出 STL / DXF，遵循 `skill-industrial-drawing-export` 的规则。
8. 如果当前环境暂时没有导出工具，仍必须完成 `.scad` 与参数文件落盘；不要手工计算 STL 三角面片，平台会基于真实 `.scad` 产物补生成预览兜底。
9. 最终回复只简短说明文件路径、已生成格式和可继续修改的参数方向。

## Artifact 约定

后续 Skill 应围绕以下中间对象工作：

```json
{
  "title": "立式储罐草图",
  "version": "v1",
  "engine": "openscad",
  "code": "complete OpenSCAD source",
  "parameters": [],
  "exports": []
}
```

## 执行边界

- Skill 负责逻辑链路、输入收敛、Artifact 规范和质量标准。
- 执行面负责调用 OpenSCAD CLI、OpenSCAD WASM Worker 或 CAD API。
- 通用 Agent Run 可以直接写入 `.scad`、`.json` 等文件；导出阶段仅在工具真实可用时执行。
- 不使用聊天消息流作为图纸主状态；工作区文件才是图纸主状态。
- `.scad` 是主资产；`drawing.parameters.json` 是参数索引；`exports/` 是派生导出物。

## 当前产品执行策略

1. 用户输入足够生成草模时，直接生成，不要只给方案。
2. 当前工作区根目录即本轮图纸目录；不要在根目录下再额外套一层 `工业制图/<日期-标题>/`，除非用户明确选择的是一个已有上级目录并要求你创建子目录。
3. 默认文件名固定为：
   - `drawing.scad`
   - `drawing.parameters.json`
   - `README.md`（简短记录对象、关键尺寸、导出状态）
4. 如果可以执行 OpenSCAD 导出，继续生成：
   - `exports/drawing.stl`
   - `exports/drawing.dxf`
5. 若导出工具不可用，但用户需要工作区 3D 预览，不要手工生成大量 ASCII STL 面片；只需保证 `.scad` 和参数 JSON 真实落盘，平台预览兜底会基于同目录 CAD 源文件生成 `exports/preview.stl`。
6. 若既不能执行导出，也无法可靠生成 STL 草模，不要伪造 STL / DXF；只交付真实存在的 `.scad` 与参数文件，并在最终回复中明确“本轮没有生成可预览 STL”。
7. 回复用户前必须检查文件是否已写入。若没有写入，先补写文件。
8. 用户后续修改尺寸或结构时，必须优先读取并更新当前目录下的 `drawing.scad` 与 `drawing.parameters.json`，不要无故新建另一份孤立图纸。

## 真实产物验收

本模块的成功标准不是聊天正文，而是工作区真实文件：

1. 进入新建 / 修改工业制图任务后，至少必须真实写入 `drawing.scad`。
2. `drawing.parameters.json` 必须能被 JSON 解析，且列出本轮核心尺寸变量。
3. 若用户要求“可预览”或默认产品路径需要工作区预览，优先由执行层真实写入以下任一文件：
   - `exports/drawing.stl`
   - `exports/preview.stl`
   - `exports/drawing.off`
4. 如果你没有亲自写入可预览文件，不能说“已导出 STL”；可以说“已生成参数化源文件，平台将使用预览兜底生成工作区预览”。
5. 不要依赖平台兜底模板件。只有当你明确判断需要平台兜底时，才在回复或工具输出中写出 `fallback_required`。
6. 若输出了 `3d_requirement_summary` 或 `3d_outline`，应确保内容与实际落盘文件一致。

## 工作区落盘要求

1. 只要进入工业制图生成路径，必须使用 `file_write`、shell 重定向、脚本写入或等价工具把结果写入当前工作区。
2. 第一版至少落盘以下文件：
   - `drawing.scad`
   - `drawing.parameters.json`（若当前轮已形成可解析参数）
3. 若本轮已生成导出结果，应继续落盘到 `exports/`：
   - `drawing.stl`
   - `drawing.dxf`
   - `preview.stl`（当 OpenSCAD 导出不可用、但已由 Agent 生成 ASCII STL 预览草模时）
   - 可选 `drawing.svg`、`drawing.pdf`
4. 文件目录建议使用：

```text
drawing.scad
drawing.parameters.json
README.md
exports/
  drawing.stl
  drawing.dxf
```

5. 只有在文件真实写入工作区后，才能告诉用户“已生成图纸”或“已导出文件”。
6. 若当前轮只完成参数化表达但尚未导出，也必须至少写入 `.scad`，不能只在聊天正文中给出源码。
7. `drawing.parameters.json` 应包含用户可编辑参数，格式示例：

```json
{
  "engine": "openscad",
  "parameters": [
    {
      "name": "tank_height",
      "label": "罐体高度",
      "value": 120,
      "unit": "mm",
      "min": 50,
      "max": 300,
      "step": 5
    }
  ],
  "exports": [
    {
      "format": "scad",
      "path": "drawing.scad",
      "status": "generated"
    },
    {
      "format": "stl",
      "path": "exports/preview.stl",
      "status": "preview_generated",
      "source": "agent_ascii_stl_preview"
    }
  ]
}
```

## OpenSCAD 与 fallback

OpenSCAD 是本模块默认主工具链：

1. `.scad` 必须能作为 OpenSCAD 输入。
2. 可用时优先使用 OpenSCAD CLI / WASM 生成预览和导出。
3. UI 或回复中应能区分“OpenSCAD 实时编译”“工作区 preview.stl 兜底”“OpenSCAD 投影 DXF”“参数轮廓 DXF 兜底”。
4. 工具链不可用不影响 `.scad` 与参数 JSON 的主交付，但不能捏造 STL / DXF 已导出。

## ASCII STL 预览 fallback

当本机没有 OpenSCAD CLI / WASM，但用户明确需要工作区可预览 3D 文件时，优先让平台兜底生成简化 ASCII STL。要求：

1. Agent 不要手工推导大量 `facet normal` 面片，避免长时间空转。
2. STL 只作为预览草模，不替代参数化源文件；`.scad` 仍是主交付。
3. 如果平台生成 `exports/preview.stl`，它只是工作区预览草模，不代表 OpenSCAD 导出结果。
4. 复杂曲面可用低面数近似，但要在 `README.md` 和 `drawing.parameters.json` 中标注为 `preview_generated`。
5. 不能把 ASCII STL 称为“OpenSCAD 导出结果”；只能称为“预览 STL 草模”。

## 禁止

- 不要把工业制图任务转成普通写作或 PPT 任务。
- 不要输出只有一张图片、无法继续参数编辑的结果作为最终图纸。
- 不要在普通文本里粘贴大段 CAD 源码作为最终答复。
- 不要捏造已完成导出；只有执行面返回文件后才可告知用户。

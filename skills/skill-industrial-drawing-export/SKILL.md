---
slug: skill-industrial-drawing-export
module: 3d
task: export
version: "1.0"
status: active
---

# 工业制图 · 预览与导出

## 目标

把当前参数化工业图纸转换为可交付文件，并保证导出结果与用户所见预览一致。

本 Skill 对应 CADAM 里的预览与下载链路：编译、生成正交视图、导出 `.STL` / `.SCAD` / `.DXF`。小窗工业制图在此基础上补充 `.SVG`、`.PNG`、`.PDF`。

详细执行规范见：

- [references/openscad-toolchain.md](./references/openscad-toolchain.md)
- [references/export-quality-checklist.md](./references/export-quality-checklist.md)

## 输入

```json
{
  "title": "图纸标题",
  "engine": "openscad",
  "code": "当前完整参数化源码",
  "parameters": [],
  "requestedFormats": ["dxf", "svg", "pdf", "stl"]
}
```

## 导出原则

1. 导出必须基于当前参数值与当前源码。
2. 导出前应先完成预览编译。
3. 二维导出与三维导出分开处理。
4. 文件名应包含主题与日期。
5. 导出失败必须返回可读错误。
6. 必须区分真实 OpenSCAD 导出和 fallback 兜底导出。
7. `.scad` 始终是可编辑主资产，导出物不能反向替代主资产。

## 格式规则

| 格式 | 用途 | 规则 |
|------|------|------|
| `.scad` | 可再次编辑的参数化源文件 | 必须保存完整源码 |
| `.stl` | 3D 打印 / 三维预览 | 使用当前三维实体导出 |
| `.dxf` | 二维工程沟通 | 默认导出俯视或指定投影 |
| `.svg` | 报告 / PPT 插图 | 默认导出清晰线稿 |
| `.png` | 快速预览图 | 使用当前视角或多视角图 |
| `.pdf` | 归档 / 交付 | 可由 SVG / DXF / 预览图生成 |

## OpenSCAD 工具链

1. 优先使用 OpenSCAD CLI / WASM 编译当前 `.scad`。
2. STL 默认从三维实体导出。
3. DXF 默认通过 `projection(cut = false)` 从当前模型导出。
4. 工具链不可用时，可以使用 `exports/preview.stl` 或参数轮廓 DXF 兜底，但必须标注来源。
5. 工具链状态应能被 UI 展示，包括可用性、版本、失败原因和 fallback 能力。

## 多视图检查

导出前建议生成以下视角：

- ISO
- FRONT
- LEFT
- TOP

复杂件可补充：

- RIGHT
- BACK
- BOTTOM

## 质量检查

导出结果必须满足：

1. 文件存在且非空。
2. 文件格式与扩展名一致。
3. 关键轮廓可见。
4. 尺寸比例与预览一致。
5. 二维投影没有明显空白页。
6. `drawing.parameters.json` 中记录了导出状态、导出方法和必要警告。

## 工作区输出

建议目录结构：

```text
工业制图/
  <YYYY-MM-DD>-<标题>/
    drawing.scad
    drawing.parameters.json
    preview.png
    exports/
      drawing.dxf
      drawing.svg
      drawing.pdf
      drawing.stl
```

## 用户反馈

导出成功时，回复应简短说明：

- 已生成哪些格式
- 文件位于工作区哪个目录
- 是否可以继续修改参数

不要描述内部 CLI、Worker、API 调用细节。

如果使用 fallback，需要用用户能理解的方式说明，例如“DXF 已按参数轮廓生成，可用于沟通轮廓；当前不是 OpenSCAD 投影导出”。

## 禁止

- 不要在未执行导出时声称已生成文件。
- 不要把截图当成 DXF / STL 交付。
- 不要导出与当前参数不一致的旧文件。
- 不要把 `exports/preview.stl` 称为正式 STL 导出。
- 不要把参数轮廓兜底 DXF 称为加工级工程图。

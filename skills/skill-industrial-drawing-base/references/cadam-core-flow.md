# CADAM 核心流程对齐

## 对齐目标

工业制图模块要学习 CADAM 的核心产品能力，而不是复制 CADAM 的页面形态。页面结构继续沿用写作 / PPT 模块的对话式工作流，但 3D 的能力闭环必须达到：

```text
用户需求
  -> 需求摘要
  -> 参数化 CAD Artifact
  -> OpenSCAD 编译预览
  -> 参数面板编辑
  -> 重新编译
  -> STL / DXF / SCAD 导出
```

## 主资产原则

`.scad` 是图纸主资产，`drawing.parameters.json` 是可编辑参数索引，`exports/` 下文件是由主资产派生的导出物。

要求：

- 修改参数必须回写 `.scad` 和 `drawing.parameters.json`。
- 预览、STL、DXF 必须基于当前 `.scad` 和当前参数。
- 不允许把 STL / DXF 当作唯一主状态。
- 不允许把聊天正文里的代码当作已交付图纸。

## CADAM 能力映射

| CADAM 能力 | 本产品对齐方式 |
|------------|----------------|
| `build_parametric_model` | 由 `skill-industrial-drawing-parametric` 产出完整 OpenSCAD Artifact |
| OpenSCAD WASM 预览 | 浏览器侧可逐步接入 WASM Worker；当前可先用 Node API + CLI |
| 参数编辑面板 | 从 `.scad` Customizer 注释和 `drawing.parameters.json` 提取 |
| 颜色 / 分组参数 | 通过 OpenSCAD `color()` 与分组注释表达 |
| STL 下载 | 由 OpenSCAD 导出或工作区预览 STL 提供 |
| DXF 下载 | 由 OpenSCAD `projection()` 导出，失败时才用参数轮廓兜底 |
| 依赖文件 | 通过工作区文件和 OpenSCAD `import()` 路径管理 |

## 必经阶段

### 1. 需求收敛

先判断是否足够建模。足够时输出 3D 需求摘要；不足时最多追问 4 个高杠杆问题。

### 2. 结构方案

在生成前输出 `3d_outline`，说明：

- 主体几何
- 可编辑参数
- 关键结构
- 预览 / 导出计划
- 已采用的默认假设

### 3. 参数化生成

生成完整 `.scad`，必须包含：

- 顶部参数
- Customizer 范围注释
- 模块化几何
- 尺寸和结构命名
- 可编译的最终调用

### 4. 工作区落盘

至少落盘：

```text
drawing.scad
drawing.parameters.json
README.md
```

导出可用时继续落盘：

```text
exports/drawing.stl
exports/drawing.dxf
```

### 5. 预览与导出

优先使用真实 OpenSCAD 工具链。不可用时：

- 仍交付 `.scad` 和参数 JSON。
- 可显示工作区已有 `exports/preview.stl`。
- 可使用参数轮廓 DXF 兜底，但必须标注 `dxfMethod: "parameter_outline"`。

### 6. 回改闭环

用户修改尺寸、结构或导出格式时：

- 先读取当前 `.scad` 和 `drawing.parameters.json`。
- 修改源文件或参数索引。
- 重新触发预览 / 导出。
- 不新建无关目录，除非用户要求保留版本。

## 成功标准

一轮 3D 任务完成时，必须能回答：

- 主 `.scad` 文件在哪里？
- 用户可以改哪些参数？
- 当前预览来自 OpenSCAD 编译还是 fallback？
- 已生成哪些导出物？
- 哪些导出失败或未执行，原因是什么？

## 禁止

- 不要输出只有图片、截图或文字描述的最终图纸。
- 不要把 fallback STL 说成 OpenSCAD 导出。
- 不要生成不可回改的孤立 mesh 作为工业制图主交付。
- 不要跳过工作区落盘。

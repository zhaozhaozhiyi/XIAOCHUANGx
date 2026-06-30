# CADAM 能力对齐验收清单

## 目标

本清单用于判断 3D / 工业制图模块是否达到 CADAM 核心产品深度。页面不复制 CADAM，但能力链路必须对齐。

## L1：入口与流程

| 项目 | 要求 | 验收证据 |
|------|------|----------|
| 模块入口 | 产品 registry 有 `3d` / 工业制图入口 | `web/src/lib/module-registry.ts` |
| 页面结构 | `/3d`、`/3d/new`、`/3d/[id]` 沿用写作 / PPT 对话结构 | 页面路由与 `ChatHome` / `ChatThread` |
| 基座 Skill | 3D 默认走 `skill-industrial-drawing-base` | module chat config / run context |
| 结构化中间态 | 支持 `3d_requirements`、`3d_requirement_summary`、`3d_outline` | Companion parts 解析与 UI 渲染 |

## L2：参数化主资产

| 项目 | 要求 | 验收证据 |
|------|------|----------|
| 主资产 | 必须生成 `drawing.scad` | 工作区真实文件 |
| 参数索引 | 必须生成 `drawing.parameters.json` | JSON 可解析，参数名与 SCAD 顶部变量一致 |
| 可编辑性 | 参数修改回写 `.scad` 和参数 JSON | 参数面板保存后文件变化 |
| 非孤立 mesh | STL / DXF 不能替代 `.scad` 主资产 | README / JSON 标注 source 与 exports |

## L3：OpenSCAD 工具链

| 项目 | 要求 | 验收证据 |
|------|------|----------|
| 工具链检测 | UI / API 可返回 OpenSCAD 可用性、版本、错误原因 | `/api/workspace/cad/toolchain` |
| STL 编译 | OpenSCAD 可用时由 `.scad` 编译 STL | `/api/workspace/cad/compile` |
| DXF 投影 | OpenSCAD 可用时由 `projection()` 导出 DXF | `/api/workspace/cad/dxf` |
| fallback 标注 | 工具链不可用时明确 fallback 来源 | `drawing.parameters.json` / UI 状态 |

## L4：预览与导出

| 项目 | 要求 | 验收证据 |
|------|------|----------|
| SCAD 预览 | 打开 `.scad` 可看到预览或 fallback 说明 | 工作区 FileViewer |
| STL 预览 | `.stl` 可在工作区预览 | `StlPreview` |
| DXF 预览 | `.dxf` 可解析轮廓、孔、长度等统计 | `DxfPreview` |
| 导出一致性 | 导出基于当前 `.scad` 和当前参数 | 参数保存 / 导出流程 |

## L5：真实 Agent 流程

| 项目 | 要求 | 验收命令 |
|------|------|----------|
| Skill 完整性 | 3D skill 与 references 可加载 | `pnpm skills:verify-3d` |
| 工具链状态 | OpenSCAD 检测可运行 | `pnpm smoke:3d:toolchain` |
| 参数编辑 | SCAD 参数可解析与回写 | `pnpm smoke:3d:parameters` |
| DXF fallback | 参数轮廓 DXF 可生成和预览 | `pnpm smoke:3d:dxf` |
| 真实生成 | Claude Code 真实写入工作区文件 | `pnpm smoke:3d:claude` |

## 当前允许的差距

以下能力属于 CADAM 深度增强，不阻塞当前 3D 基座验收，但应作为后续迭代：

- 浏览器 OpenSCAD WASM Worker 与服务端 CLI 双通道完全统一。
- OFF 彩色预览与 OpenSCAD `color()` 的面级颜色传播。
- OBJ / GLB / FBX / GIF 等创意 3D 格式导出。
- 更完整的依赖文件管理，包括 `import()` 引用 STL / SVG / DXF。
- 多视角 PNG / SVG / PDF 工程报告导出。

## 不通过条件

出现以下任一情况，视为未达到 CADAM 核心流程：

- 只在聊天中输出源码，没有工作区文件。
- 只生成 STL / 图片，没有 `.scad` 主资产。
- 参数面板修改后无法回写源码。
- 声称已导出 STL / DXF，但文件不存在。
- fallback 文件被描述成 OpenSCAD 真实导出。

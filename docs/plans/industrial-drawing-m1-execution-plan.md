# 3D绘图模块 M1 执行计划

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-06-25 |
| 适用范围 | 3D绘图模块 v0.2 MVP（对应 PRD §12.2） |
| 上级文档 | [industrial-drawing-module-prd.v1.md](../product/modules/industrial-drawing-module-prd.v1.md)、[p0-writing-ppt-execution-plan.md](./p0-writing-ppt-execution-plan.md)、[product-roadmap-v4.md](./product-roadmap-v4.md) |
| 启动条件 | 写作 / PPT V1.1 收口完成（以 [writing-ppt-v1.1-status.md](./writing-ppt-v1.1-status.md) 通过为准） |
| 计划周期 | 4 个工作周（W1 ~ W4） |
| 退出标准 | PRD v0.2 MVP 主功能闭环可在 Desktop 与 Web 两侧真实运行；fixture 回归通过；删除 fallback 兜底；功能清单与 PRD 同步修订 |

---

## 0. 定位与决策基线

本计划是 3D绘图模块进入产品化排期的第一份执行文档。在 2026-06-25 评审中已确认以下决策，本文档以此为前提，不再重新论证：

| 决策项 | 结论 |
|--------|------|
| 模块执行面 | **沿用 Companion Run + Skill 主路径**，不另起独立 API 族 |
| 启动节奏 | **写作 / PPT V1.1 收口后串行启动**，不与 V1.1 并行抢 Companion / contracts / parts 渲染层 |
| OpenSCAD 编译执行面 | **产品托管 OpenSCAD CLI Runtime 为主路径**；浏览器 OpenSCAD WASM Worker 作为快速预览增强；不要求用户安装或配置 PATH |
| MVP 范围 | **共享 3D 会话 + 可编辑 `.scad` 主资产 + 参数面板 + STL/DXF 真实导出 + SVG/PDF 参数轮廓 fallback**；不做历史图纸 |
| PRD §3.2 / §9.1 / §9.2 | 与上述决策冲突，本计划 W4 同步修订 PRD，标注"由 v1.1 PRD 替换" |

启动前提：本计划 W1 不动 `companion/src/runs/manager.ts` 主循环，W2 不动写作 / PPT 主流程，确保 V1.1 收口期内 3D绘图改动可独立回滚。

---

## 1. 当前实现基线（截至 2026-06-25）

### 1.1 已具备

- 路由 / 注册：`web/src/app/(main)/3d/{page,new,[id]}.tsx`、`module-registry.ts:64`、`module-chat-config.ts:209`、`navigation.ts:61`、`companion/src/module-segments.ts:8`
- Skill 三件套（草稿 v0.1）：`skill-industrial-drawing-base / parametric / export`
- Companion mode-hints：`companion/src/runs/manager.ts:317-324`
- Companion fallback：`companion/src/runs/industrial-drawing-fallback.ts`（生成 `.scad / parameters.json / preview.stl / README.md`）
- 预览链路：`web/src/components/workspace/{ScadPreview,StlPreview,SvgPreview}.tsx` + `web/src/app/api/workspace/cad/{toolchain,compile,export}/route.ts`（产品托管 OpenSCAD CLI 主路径，参数轮廓 fallback）
- Contracts：`packages/contracts/src/chat.ts` 已定义 `3d_requirements / 3d_requirement_summary / 3d_outline` 三个 part.kind
- PartRenderer：`web/src/components/chat/parts/PartRenderer.tsx` 已注册 3D 三种 part，并复用 `RequirementsCard / RequirementSummaryCard`
- 3D outline：`RequirementSummaryCard` 已支持 `IndustrialDrawingOutlineData.blocks` 的编辑与确认

### 1.2 真实缺口

- Companion 端仍需用真实 SSE / fixture 验证 3D 三张 AI to UI 卡是否稳定输出与恢复
- 产品托管 OpenSCAD Runtime 未随安装包内置时，研发态只能显示 `openscad_runtime_missing` 并走参数轮廓 / preview fallback
- OpenSCAD WASM Worker 已接入官方 WebAssembly web 包，研发态可通过 `pnpm engines:prepare:openscad-wasm` 准备 `web/public/openscad-wasm/`，并通过 `pnpm smoke:3d:wasm-preview` 真实编译 STL
- 正式发布前必须补齐 OpenSCAD Runtime、版本、许可证、第三方声明与源码获取说明

---

## 2. M1 目标

### 2.1 主闭环

`首轮输入 → 共享 3D 会话 → 需求摘要 / 方案卡 → .scad + 参数 JSON 落盘 → 参数面板编辑 → OpenSCAD CLI 编译预览 / 导出 → WASM 快速预览增强 → DXF / SVG / PDF / STL 交付`

### 2.2 完成后达成

- 3D绘图模块在对话壳内与写作 / PPT 体验一致：卡片可渲染、可提交、可恢复
- 任意一台用户机器都不需要自行安装 OpenSCAD；发布包必须内置产品托管 Runtime
- 工作区 `.scad` 文件可在右侧参数面板调参，预览实时刷新
- "导出 DXF / SVG / PDF / STL" 按钮按格式产出文件；STL 只在真实 OpenSCAD 成功时标记生成
- fallback 明确标注来源：参数轮廓 fallback 不能冒充 OpenSCAD 投影，preview STL 不能冒充正式 STL 导出
- PRD / 功能清单同步至 v1.1 口径，移除"不进入主线导航"标记

### 2.3 显式不做

- 不做加工级完整工程图尺寸标注（推 M2）
- 不做 OFF 彩色预览（推 M2）
- 不做三栏工作台（PRD §6），仍复用 `ChatHome / ChatThread`
- 不做历史图纸（F-ID-007）/ 模板库
- 不做参考图辅助生成（F-ID-002 多模态）
- 不做独立 `/api/industrial-drawing/*` API 族
- 不做 BOM、协作评论、装配约束
- 不做后端 headless 截图

---

## 3. 四周任务分解

### 3.1 W1 · Skill + Contracts 收口

W1 不动 Companion 主循环，目标是让"3D 三张卡"在协议与渲染两层先打通。

| 编号 | 任务 | 涉及文件 |
|------|------|----------|
| W1-T1 | 改写 `skill-industrial-drawing-base/SKILL.md`：加入首轮追问 → 摘要 → 方案卡的三段式协议，对齐写作 / PPT 在 `p0-writing-ppt-execution-plan` §2 收紧后的格式（fenced JSON + 标准 part.kind） | `skills/skill-industrial-drawing-base/SKILL.md` |
| W1-T2 | 改写 `skill-industrial-drawing-parametric/SKILL.md`：明确"输出必须为可被 WASM Worker 编译的纯净 SCAD"约束（禁用 `import()`、外部字体、外部库） | `skills/skill-industrial-drawing-parametric/SKILL.md` |
| W1-T3 | 在 `PartRenderer.tsx` 加 `3d_requirements / 3d_requirement_summary / 3d_outline` 三个 case，复用 `RequirementsCard / RequirementSummaryCard`；如有 3D 特有字段（例如 `IndustrialDrawingOutlineData.blocks`），在 `RequirementSummaryCard` 内做最小分支 | `web/src/components/chat/parts/PartRenderer.tsx`、`web/src/components/chat/parts/RequirementSummaryCard.tsx` |
| W1-T4 | 写 fixture：`tests/fixtures/3d-ai-ui/F7-F12.json`，6 个样例覆盖"信息充分直出方案"、"信息不足出表单"、"方案卡可结构化编辑"等场景 | `tests/fixtures/3d-ai-ui/*.json`、`scripts/qa-3d-ai-ui.mjs`（参考 `pnpm qa:writing-ppt-ai-ui`） |

#### W1 验收

| 项 | 标准 |
|----|------|
| 协议 | Skill 输出能稳定被解析为 `3d_requirements / summary / outline` 三种 part.kind |
| 渲染 | 三种 part 在 `ChatThread` 内可见、不报错、不落到默认渲染 |
| fixture | `pnpm qa:3d-ai-ui` 通过；至少 4/6 样例稳定 |

---

### 3.2 W2 · 产品托管 OpenSCAD Runtime

本周优先解决"用户拿来即用"的 Runtime 主路径，避免把浏览器 Worker 当成发布前置。

| 编号 | 任务 | 说明 |
|------|------|------|
| W2-T1 | Runtime 资源布局固定到 `apps/desktop/resources/engines/openscad/{platform}/`，打包后映射到 `process.resourcesPath/engines/openscad/{platform}/` | 不读取用户 PATH 作为正式能力 |
| W2-T2 | 提供 `scripts/fetch-openscad-runtime.mjs`：支持内部归档 / URL、SHA256 校验、解包、交给 prepare 脚本 | 发布流水线优先用内部制品库 |
| W2-T3 | `prepare-openscad-runtime.mjs` 写入 `VERSION.txt`、许可证目录、源码获取说明；`verify-openscad-runtime.mjs --required` 作为发布硬闸门 | 许可证材料不齐不能发包 |
| W2-T4 | `/api/workspace/cad/toolchain`、`compile`、`export` 统一走 `resolveOpenScadExecutable()`，不暴露本机路径 | UI 只展示可用性、版本、来源类型 |
| W2-T5 | `ScadPreview.tsx` 保留 WASM 调用位，但默认 CLI 主路径；WASM 未配置时不阻塞 CLI / fallback | Worker 后续作为增强接入 |

#### W2 验收

| 项 | 标准 |
|----|------|
| 用户机器 | 不需要安装 OpenSCAD 或配置 PATH |
| 开发态 | Runtime 缺失时 `pnpm engines:verify:openscad` 通过，UI 显示 `openscad_runtime_missing` |
| 发布态 | `pnpm engines:verify:openscad:required` 通过；否则 `desktop:pack:release` 失败 |
| 错误 | 编译失败有结构化错误和 fallback 标注，不静默失败（对应 PRD §11.2） |

---

### 3.3 W3 · 导出链路 + 参数面板

| 编号 | 任务 | 说明 |
|------|------|------|
| W3-T1 | CLI Runtime 加 `stl` / `dxf` 导出能力，DXF 默认使用 `projection(cut = false)` 包装；Runtime 不可用时 DXF/SVG/PDF 走参数轮廓 fallback | 借鉴 CADAM 思路；自行重写实现 |
| W3-T2 | 新增 `web/src/components/workspace/ScadParametersPanel.tsx`：从同目录 `drawing.parameters.json` 加载参数，渲染数值（带 min/step/max 滑杆）/ 枚举 / 颜色 / 布尔四类控件；按 group 折叠 | 对应 PRD §8.3 F-ID-003 |
| W3-T3 | 参数改动 → 注入 SCAD 顶部变量 → 保存 `.scad` → 重新编译 / fallback 预览；编译失败不丢参数 | 对应 PRD §11.2 "任何失败都不能丢失当前参数与源码表达" |
| W3-T4 | 新增"导出为 DXF / SVG / PDF / STL"按钮：API 产出 → 通过工作区文件 API 写到 `exports/`；写入完成后刷新文件树 | 对应 PRD §8.5 F-ID-005 |
| W3-T5 | `web/src/lib/workspace-binary.ts` / `web/src/lib/workspace/adapter.ts` 增加 `.dxf` 的 MIME（`application/dxf`）/ language 推断；`FileViewer.tsx` 暂只支持下载与源码预览 | 对应 PRD §9.6.3 改造点表 |

#### W3 验收

| 场景 | 通过标准 |
|------|----------|
| 调参 | 用户修改 `base_length` 等顶部参数后，`.scad` 与参数 JSON 同步更新 |
| 编译失败保留 | 用户输入非法值后预览报错，松开后恢复上一可编译值 |
| DXF/SVG/PDF | OpenSCAD 不可用时仍能生成参数轮廓文件，并明确标注 fallback |
| STL | 只有 OpenSCAD 成功时才生成正式 `exports/drawing.stl` |
| 工作区 | 文件落到 `工业制图/<YYYY-MM-DD>-<标题>/exports/` |

---

### 3.4 W4 · 验收 + 文档 + 清理 fallback

| 编号 | 任务 | 说明 |
|------|------|------|
| W4-T1 | 跑 fixture 回归：W1-T4 的 6 个对话样例 + W2 的 5 个预览样例 + W3 的"调参 → 导出"端到端样例 | 至少连续 2 轮一致才算通过 |
| W4-T2 | 写 `docs/plans/industrial-drawing-m1-status.md`，体例对齐 `writing-ppt-v1.1-status.md`：列出"本轮已验证的闭环"与"本轮已确认存在的真实产物"（含工作区文件路径） | 验收态以真实文件为准，不以 mock 通过判定 |
| W4-T3 | 降级 `companion/src/runs/industrial-drawing-fallback.ts`：从"3D绘图模块每轮无 CAD 产物时强制生成模板件"改为"仅在 Skill 明确返回 `fallback_required` 或 WASM 加载失败时触发"；并在 `manager.ts:1090` 区段加注释说明 | M1 走通真路径后，默认模板件兜底反而是噪声 |
| W4-T4 | 修订 `docs/product/功能清单.md`：把 `3D绘图（规划）` 改为 `3D绘图（M1）`；移除"**不进入** Desktop Alpha / Beta 主线导航"行 | 同步开启一级导航默认可见 |
| W4-T5 | 修订 `docs/product/modules/industrial-drawing-module-prd.v1.md` §3.2 / §9.1 / §9.2 / §13.1：把"禁止接入 Agent Run / Companion runs / session message parts"改为"以 Companion Run + Skill 为主路径，执行层走浏览器 OpenSCAD WASM Worker"；底部加版本表注明"由 v1.1 PRD 替换" | 不重写整份 PRD，仅做点位修订 |

#### W4 验收

| 项 | 标准 |
|----|------|
| 回归 | fixture + 真实链路两侧均通过 |
| 状态卡 | `industrial-drawing-m1-status.md` 列出真实工作区文件路径 |
| 文档一致性 | PRD / 功能清单 / 路线图三处口径一致，不再相互矛盾 |
| 兜底 | 默认路径不再触发 ASCII STL 模板件 |

---

## 4. 与现有计划的关系

### 4.1 与 V1.1 收口的边界

| V1.1 收口仍负责 | 本计划负责 |
|----------------|-----------|
| 写作 / PPT 首轮判断、摘要、大纲卡稳定 | 3D绘图首轮判断、摘要、方案卡稳定 |
| Companion 主循环、`parts[]` 渲染主路径 | 仅在 `PartRenderer` 加 case；不改主路径 |
| 写作 / PPT fixture 与 smoke | 3D绘图 fixture 与 smoke 独立成套 |

#### 共用的协议层
`packages/contracts/src/chat.ts` 内的 3D part 定义已与 V1.1 同步合入；本计划不再扩展 contracts，避免协议层版本飘移。

### 4.2 与 PRD v1.0 的偏离

| PRD 条款 | 偏离 | 处理 |
|----------|------|------|
| §3.2 不接入 Agent Run / Companion runs | 实际继续沿用 | W4-T5 修订 |
| §9.1 直连执行面 = API Route → 本地 CLI | 实际为 Worker → WASM | W4-T5 修订 |
| §13.1 默认 Agent Run = false | 实际 = true（沿用 Companion Run） | W4-T5 修订 |
| §13.5 `/api/industrial-drawing/*` API 族 | 本计划不实现 | 保留为 v1.1 PRD 候选 |

### 4.3 与路线图 v4 的关系

本计划属于 `product-roadmap-v4.md` 的新增项，不冲突于 P0~P3。建议在路线图 v4.1 修订时把"3D绘图 M1"挂在 P3 之后、Web Sandbox（P5）之前。

---

## 5. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| OpenSCAD WASM ~5MB 拖慢首屏 | 高 | 动态 import，仅在 `/3d` 或加载 `.scad` 时拉；用 `next.config.js` 排除 server bundle |
| CADAM GPLv3 许可 | 中 | W2 用 spike 目录隔离，保留许可证声明；W3 起按 PRD §9.7 阶段 B 改写接口；正式合并前由项目负责人确认许可策略 |
| Worker postMessage 大文件性能 | 中 | STL / DXF 使用 transferable ArrayBuffer；不走 JSON 序列化 |
| SCAD Customizer 注释解析与现实差异 | 低 | M1 仅支持 `[min:step:max]` / `[a, b, c]` / 颜色 / 布尔四类；其余降级为只读 |
| Desktop 已装 OpenSCAD 用户体验回退 | 低 | 保留 `/api/workspace/cad/compile` 路由不删；将其降级为 fallback 而非主路径 |
| 3D绘图模块上线后被并入 V1.1 验收范围 | 中 | 本计划与 V1.1 串行；M1 收口卡片独立，不进 `mvp-closure-checklist.md` 当前批次 |

---

## 6. 后续版本预告（不进 M1 范围）

为防止 M1 期间被塞入超范围需求，下述能力明确推到 M2 / M3。

### 6.1 M2 候选

- SVG / PDF / OFF 彩色预览导出
- 三栏工作台（左历史 / 中预览 / 右参数面板，PRD §6）
- 参数化重生成的局部 diff 视图
- `.dxf` 在 `FileViewer` 内的 Canvas 可视化预览

### 6.2 M3 候选

- 参考图辅助生成（F-ID-002，多模态）
- 历史图纸（F-ID-007）+ 模板库
- 模型测量 / 剖切（StlPreview 进阶）
- 独立 `/api/industrial-drawing/*` API 族（如 v1.1 PRD 决定回归 PRD §3.2 路线）

---

## 7. 进度对照表（W4 完成时回填）

| 里程碑 | 计划完成日 | 实际完成日 | 备注 |
|--------|------------|------------|------|
| W1 收口 | 启动日 + 7d | | |
| W2 CLI Runtime 通 | 启动日 + 14d | | |
| W3 调参 + DXF 通 | 启动日 + 21d | | |
| W4 验收 + 文档 | 启动日 + 28d | | |

启动日 = 写作 / PPT V1.1 收口确认日。如 V1.1 实际收口晚于 2026-07-04，本计划相应顺延，不并行启动。

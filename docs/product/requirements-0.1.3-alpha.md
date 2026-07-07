# 小窗 `0.1.3-alpha` 版本内容梳理

| 属性 | 内容 |
|------|------|
| 平台版本 | `0.1.3-alpha` |
| 阶段定位 | Desktop Alpha 交付体验补强版 |
| 文档版本 | v0.1 |
| 日期 | 2026-07-07 |
| 上一版本 | `0.1.2-alpha` |
| 后续目标 | `0.2.0-beta` / Desktop Beta |
| 适用范围 | Desktop + 本地 Companion + 本地文件夹工作区 |
| 整理依据 | 2026-07-07 本地未提交代码变更 |

> 本文件用于把 2026-07-07 已进入代码树的改动归并为 `0.1.3-alpha` 范围。当前 `package.json`、`web`、`apps/desktop`、`companion`、`api`、`packages/contracts`、`packages/runtime-core`、`apps/video` 包版本已统一升到 `0.1.3-alpha`。

---

## 1. 版本定位

`0.1.3-alpha` 是 `0.1.2-alpha` 之后、`0.2.0-beta` 之前的 Alpha 补强版本。

本版本不新增第七个业务模块，不进入 Web Sandbox / 云端 Runtime / 多用户后台。重点从 `0.1.2-alpha` 的“六模块入口与 release gate 收束”，推进到“真实交付物可识别、可预览、可继续操作”：把交付文件从普通列表升级为结构化 artifact manifest，并补齐 3D、视频、推演等模块的下一层体验细节。

---

## 2. 范围原则

### 2.1 纳入范围

- Artifact Manifest：交付物结构化描述、预览、生成格式、可用动作与后续转换占位。
- Module Adapter：模块生命周期、工作台类型、动作、验收 smoke 的统一元数据雏形。
- 交付物卡片升级：显示项目摘要、主产物、预览数量、已生成格式，并支持打开预览 / 打开文件 / 继续修改。
- 3D绘图 M1 体验补强：从交付物动作打开 SCAD 工作台、优先识别 `drawing.scad`、支持指定工作区视图模式。
- 视频模块三路径：视频舞台、屏幕分镜、诗意短动画，并在底栏和首页选择中保留 `videoTemplateId`。
- 新增 `skill-vp-poetic-visual-coding`：面向 p5.js / Processing 风格的概念视觉诗短动画。
- 推演画布颜色体系：节点按边界、证据、推理、风险、行动、产出分组，并提供图例。
- QA / release gate：视频类型绑定 smoke、3D 交付物动作 E2E、Playwright 端口/worker 可配置。
- 文案口径收敛：减少“导出”误导，统一使用“生成 / 交付 / 派生格式”等更可验证表述。

### 2.2 不纳入范围

- Web Sandbox、云端 Runtime、多用户后台、多人协作。
- 新增第七个一级业务模块。
- 视频自动 MP4、Remotion 渲染完整闭环、TTS / BGM 库。
- PPT / 文档 PDF 真实转换服务；当前只保留 manifest 中的 planned action。
- Module Adapter 完整驱动所有前端页面；本版本先定义契约与基础映射。
- macOS 公证、Windows EV 签名、正式更新源生产配置。

---

## 3. 版本内容清单

| 编号 | 模块 | 内容 | 优先级 | 当前状态 |
|------|------|------|--------|----------|
| `A013-ART-001` | 协议 / Contracts | 新增 `ArtifactManifest` 协议，描述 artifacts、previews、generatedFormats、availableConversions、actions | P0 | 已进入代码树 |
| `A013-ART-002` | Runtime | `buildArtifactManifestFromDeliverables` 从真实 deliverables 构造结构化 manifest，并挂到 writing / PPT / 3D deliverables part | P0 | 已进入代码树 |
| `A013-ART-003` | 前端交付物 | `DeliverablesCard` 渲染项目摘要和动作按钮，支持打开预览、打开文件、继续迭代、跨工作区切换后打开 | P0 | 已进入代码树 |
| `A013-MOD-001` | 模块协议 | 新增 `ModuleAdapter` 契约与 Web 侧 `MODULE_ADAPTERS`，沉淀模块生命周期、工作台、动作与验收口径 | P1 | 已进入代码树，未完全产品化 |
| `A013-3D-001` | 3D绘图 | CAD workbench 主文件选择优先级：`drawing.scad` > STL / DXF > README；交付物动作可直接打开模型预览 | P0 | 已进入代码树 |
| `A013-3D-002` | 3D绘图 | `openFileAt` 支持 `viewMode`，从交付物卡片打开 3D 文件时可进入预览模式并展示参数面板 | P0 | 已进入代码树 |
| `A013-3D-003` | 3D绘图 | 参数 JSON 字段从 `exports` 收敛为 `generatedFormats`，明确 preview STL 不等于 OpenSCAD CLI 真实生成 | P1 | 已进入代码树 |
| `A013-VIDEO-001` | 视频 | 新增视频类型选择：`auto` / `stage` / `screenplay` / `poetic`，并贯穿 Composer、Home、Thread、Hermes、Companion binding | P0 | 已进入代码树 |
| `A013-VIDEO-002` | 视频 | 新增 `VIDEO_SKILL_CATALOG`，根据 `videoTemplateId` 路由到 `skill-vp-base`、`skill-vp-video-stage`、`skill-vp-screenplay-canvas` 或 `skill-vp-poetic-visual-coding` | P0 | 已进入代码树 |
| `A013-VIDEO-003` | 视频 Skill | 新增 `skill-vp-poetic-visual-coding`，支持概念 / 情绪 / 参考画面生成 10-25 秒 p5.js 诗意短动画 `sketch.html` | P1 | 已进入代码树 |
| `A013-VIDEO-004` | 视频预览 | 视频类型进入模板/类型选择器，支持 `auto`、`stage`、`screenplay`、`poetic` 预览占位与文案 | P1 | 已进入代码树 |
| `A013-SIM-001` | 推演 | 推演画布节点颜色按 family 分组，新增工具栏颜色图例 | P1 | 已进入代码树 |
| `A013-QA-001` | QA | `smoke-module-session-paths` 增加 video poetic binding 校验；3D M1 release gate 增加交付物动作打开工作台 E2E | P0 | 已进入代码树 |
| `A013-QA-002` | QA | Playwright worker / 端口可配置，3D release gate 默认启用 WASM preview 环境变量 | P1 | 已进入代码树 |
| `A013-COPY-001` | 文案 | 将“导出”类表达收敛为“生成 / 交付 / 派生格式”，减少未真实生成文件时的误导 | P1 | 已进入代码树 |
| `A013-DOCS-001` | 文档 | Skill 清单从 47/37 更新到 48/38，新增 poetic visual coding catalog 说明 | P1 | 已进入代码树 |

---

## 4. 重点能力说明

### 4.1 Artifact Manifest：从文件列表到可操作项目

`0.1.2-alpha` 已经把运行结果落到 `deliverables`，但交付物仍主要是文件列表。`0.1.3-alpha` 增加 manifest 层，用统一结构说明：

- 哪个文件是主产物；
- 哪些文件可预览；
- 哪些格式已经生成；
- 哪些转换能力未来可接入；
- 当前用户可执行哪些动作。

这让写作 / PPT / 3D 后续可以用同一张“项目交付卡”承载打开、预览、继续修改、生成格式等操作。

### 4.2 3D绘图：交付物动作直达工作台

3D 的关键变化不是增加新制图能力，而是把已有结果打开得更稳：

- 交付物主文件选择优先 `drawing.scad`，避免只打开 STL 而丢掉可编辑源文件。
- `openFileAt` 支持显式 `viewMode`，交付卡动作可以要求以预览模式打开。
- `DeliverablesCard` 会在 manifest action 中选择最合适的 CAD 路径，并在需要时先切换到正确工作区。
- E2E 覆盖“点击打开模型预览后看到 `drawing.scad` 和参数面板”的路径。

### 4.3 视频：从两条生产路径扩展到三条

视频模块从原来的“视频舞台 / 屏幕分镜”扩展为：

- `auto`：智能选择；
- `stage`：视频舞台，生成 `presentation/`；
- `screenplay`：屏幕分镜，生成 `studio/`；
- `poetic`：诗意短动画，生成 p5.js `sketch.html`。

前端底栏、首页建议、pending session、Hermes 请求、Companion binding 都会保留 `videoTemplateId`，避免用户已经选择的视频类型在创建会话或继续对话时丢失。

### 4.4 推演：节点颜色从逐类颜色改为 family 体系

推演画布节点颜色改为按节点家族分组：

- 边界 / 骨架；
- 证据；
- 推理；
- 风险 / 异常；
- 行动；
- 产出。

工具栏新增颜色图例，帮助用户理解节点类型，而不是只面对一组难以解释的散色。

---

## 5. 验收建议

### 5.1 最小必跑

```bash
pnpm contracts:build
pnpm runtime-core:build
pnpm skills:verify
pnpm -C web exec tsc --noEmit --pretty false
```

### 5.2 3D 交付物与 release gate

```bash
pnpm smoke:3d:quick
pnpm m1:3d:release-gate
pnpm -C web exec playwright test tests/e2e/3d-m1-release-gate.spec.ts
```

重点看：

- deliverables manifest 能正常出现在对话中；
- 点击“打开模型预览”后能打开工作区与 SCAD 预览；
- `drawing.scad`、参数面板、WASM preview 状态可见；
- `generatedFormats` 文案与参数 JSON 一致。

### 5.3 视频类型与 Skill 路由

```bash
pnpm smoke:video:module-routes
pnpm smoke:video
```

重点看：

- 选择 `poetic` 后，Companion binding 保留 `templateId: "poetic"`；
- process skill 解析为 `skill-vp-poetic-visual-coding`；
- 视频类型选择器可显示四类路径；
- poetic 路径至少要求真实 `sketch.html` 非空。

### 5.4 推演画布回归

```bash
pnpm smoke:simulation
pnpm smoke:simulation:ui
```

重点看：

- 节点 family 颜色稳定；
- 工具栏颜色图例可见；
- 原有节点点击、路径选择、报告回跳不回归。

---

## 6. 发布前必须整理

| 项 | 处理要求 |
|----|----------|
| 包版本号 | 根 `package.json`、`web`、`apps/desktop`、`companion`、`api`、`packages/contracts`、`packages/runtime-core`、`apps/video` 已统一升到 `0.1.3-alpha` |
| 文档索引 | `docs/README.md`、`docs/product/versioning.md` 已加入 `0.1.3-alpha` 候选口径 |
| Release note | `docs/release-notes/0.1.3-alpha.md` 已作为用户向版本说明草稿 |
| 交付协议 | 确认 `ArtifactManifest` 不破坏既有 `deliverables` part 兼容性 |
| 3D 验收 | 跑通 3D M1 release gate，尤其是交付卡 action 打开工作台 |
| 视频验收 | 跑通 video module routes，确认 `videoTemplateId` 在首页、底栏、继续对话中不丢失 |
| 术语口径 | 发布材料中避免把 planned conversion 说成已接入能力 |

---

## 7. 与相邻版本关系

- `0.1.2-alpha`：六模块入口收束、3D M1、视频 P0、懒工作区、Runtime parts、Desktop release gate 的 Alpha 补强版。
- `0.1.3-alpha`：交付物结构化、3D 交付卡动作、视频三路径与 poetic 短动画、推演图例、QA gate 补强。
- `0.2.0-beta`：继续收口写作 / PPT、对话增强、桌面本地工作区体验，3D / 视频 / 推演进入更完整真实闭环。

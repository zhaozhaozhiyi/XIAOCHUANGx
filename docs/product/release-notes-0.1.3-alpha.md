# 小窗 `0.1.3-alpha` 版本升级说明

| 属性 | 内容 |
|------|------|
| 平台版本 | `0.1.3-alpha` |
| 发布阶段 | Desktop Alpha 交付体验补强版 |
| 日期 | 2026-07-07 |
| 上一版本 | `0.1.2-alpha` |
| 后续目标 | `0.2.0-beta` / Desktop Beta |

---

## 1. 升级摘要

`0.1.3-alpha` 继续沿用 Desktop + 本地 Companion + 本地文件夹工作区的产品边界，不新增业务模块。它重点解决一个问题：AI 已经能写入真实文件后，用户如何更清楚地看到“这是什么项目、有哪些产物、能点什么动作、还能怎么继续改”。

因此这一版的核心是 **结构化交付物 + 模块化工作台动作**。写作、PPT、3D 等结果不再只是聊天里的文件列表，而开始具备统一的 artifact manifest、项目摘要、预览入口、已生成格式和继续迭代动作。

---

## 2. 主要升级内容

### 2.1 交付物卡片升级

- 新增 Artifact Manifest 协议，描述主产物、预览、已生成格式、可用动作和后续转换占位。
- 交付物卡片展示“文档项目 / PPT 项目 / 3D 项目”摘要。
- 支持在交付物卡片中直接打开预览、打开文件、继续修改。
- 如果交付物属于另一个工作区，前端会先切换工作区再打开文件。

### 2.2 3D绘图 M1 体验补强

- 3D 交付物优先识别可编辑 `drawing.scad`，避免只打开 STL 预览而丢掉源文件。
- 交付物动作可以直接打开 3D 工作台预览，并展示参数面板。
- 参数 JSON 从 `exports` 收敛为 `generatedFormats`，更准确地区分“已生成格式”和“派生预览文件”。
- Release gate 增加“从交付卡打开 3D 工作台”的 E2E 覆盖。

### 2.3 视频模块扩展为三条生产路径

- 视频底栏新增类型选择：智能选择、视频舞台、屏幕分镜、诗意短动画。
- `videoTemplateId` 会贯穿首页、会话、Hermes 请求和 Companion binding。
- 新增 `skill-vp-poetic-visual-coding`，支持把一个词、概念、情绪或参考画面变成 p5.js 诗意短动画。
- 视频基座 Skill 明确三条 P0 路径：`presentation/`、`studio/`、`sketch.html`。

### 2.4 推演画布更易读

- 推演节点颜色从逐类型散色，改为按节点家族分组。
- 新增颜色图例：边界/骨架、证据、推理、风险/异常、行动、产出。
- 让复杂推演图在第一眼更容易理解结构。

### 2.5 模块协议雏形

- 新增 Module Adapter 契约，开始统一描述模块生命周期、工作台类型、动作和验收 smoke。
- Web 侧新增 `MODULE_ADAPTERS`，为后续把写作、PPT、3D、视频、推演统一成标准工作台体验打基础。

### 2.6 QA 与文案口径

- 新增 video poetic binding smoke。
- Playwright worker、端口和 3D release gate 环境变量更可控。
- 多处文案从“导出”调整为“生成 / 交付 / 派生格式”，减少尚未真实生成文件时的误导。

---

## 3. 升级影响

| 影响面 | 说明 |
|--------|------|
| 交付物体验 | 用户能看到更像“项目”的交付摘要，而不是孤立文件列表 |
| 3D绘图 | 从交付卡直达可编辑 SCAD 工作台，减少打开错文件的概率 |
| 视频 | 用户可主动选择视频生产路径，新增 p5.js 诗意短动画能力 |
| 推演 | 画布节点颜色更有解释性 |
| 协议 | `deliverables` part 向后兼容，同时可携带 `manifest` |
| QA | 3D 和视频的关键绑定路径有更明确 smoke / E2E |

---

## 4. 建议验收命令

```bash
pnpm contracts:build
pnpm runtime-core:build
pnpm skills:verify
pnpm -C web exec tsc --noEmit --pretty false
pnpm smoke:3d:quick
pnpm m1:3d:release-gate
pnpm smoke:video:module-routes
pnpm smoke:video
```

---

## 5. 已知限制

- 当前包版本尚未统一升到 `0.1.3-alpha`。
- PDF 生成、PPT 转 PDF 等转换动作仍是 planned，不代表已接入真实生成服务。
- 视频自动 MP4、Remotion 渲染、TTS / BGM 库仍不属于本版本。
- Module Adapter 已有契约和基础映射，但尚未完整驱动所有模块页面。
- Web Sandbox、云端 Runtime、多用户后台不属于本版本。

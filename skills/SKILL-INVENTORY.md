# 小窗平台 Skill 全量清单

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 更新日期 | 2026-07-01 |
| 权威来源 | `skills/skill-*/SKILL.md`、`skills/chat-catalog.json`、`web/src/lib/module-registry.ts` |
| 关联文档 | [README.md](./README.md)、[chat-catalog.json](./chat-catalog.json)、[chat-core-architecture.md](../docs/technical/chat-core-architecture.md) |

本文档枚举仓库内**全部已落地 Skill**（含磁盘存在但尚未进入 Catalog 的条目）。维护新 Skill 时请同步更新本表、`chat-catalog.json`（若需对话可见）与 `skills/README.md` 落地状态表。

---

## 图例

| 标记 | 含义 |
|------|------|
| **Catalog** | 在 `chat-catalog.json` 中注册；摘要进入 system，全文由 Agent 按需经 Agent Kit Pull |
| **注入** | 每次 Run 硬注入（`processSkill` 或平台规范） |
| **基座** | 产品模块默认 `processSkill`：需求收敛、路由下游生产 Skill |
| **模板/生产** | 由基座、模板选择或 Agent 路由后交接执行 |
| **兼容** | 旧 API / 旧 UI 映射保留，非主路径 |
| **占位** | 已有 `SKILL.md`，模块入口尚未深度验收 |

---

## 统计摘要

| 维度 | 数量 |
|------|------|
| 磁盘 Skill 总数 | 47 |
| `chat-catalog.json` 条目 | 37 |
| workflow | 42 |
| tool | 5 |
| 不在 Catalog 中 | 10 |

---

## 模块默认注入

| 模块 `moduleId` | 默认 `processSkill` | 横切规范（每次 Run） |
|-----------------|---------------------|----------------------|
| `chat` | `skill-qa` | `skill-platform-research-norms` |
| `writing` | `skill-writing-base` | 同上 |
| `ppt` | `skill-ppt-base` | 同上 |
| `3d` | `skill-industrial-drawing-base` | 同上 |
| `video` | `skill-vp-base` | 同上 |
| `simulation` | `skill-simulation-base` | 同上 |

绑定实现：`web/src/lib/module-registry.ts` → `resolveSkills()`。

---

## 0. 横切（1）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 1 | `skill-platform-research-norms` | 规范 | — | **注入** | 平台研究写作规范、引用与交付约定 |

---

## 1. 对话 `chat`（3）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 2 | `skill-qa` | workflow | — | **注入** | 自动问答基座；按问题复杂度自决轻量回答、分步推理或完整研究 |
| 3 | `skill-qa-fast` | workflow | — | 兼容 | 旧「快速」模式映射 |
| 4 | `skill-qa-deep` | workflow | — | 兼容 | 旧「深度」模式；API 别名 `mode=research` 映射为此 Skill |

---

## 2. 写作 `writing`（9）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 5 | `skill-writing-base` | workflow | — | **基座** | 需求采集、摘要确认、写作 Skill 路由 |
| 6 | `skill-writing-general` | workflow | ✅ | 模板 `general` | 默认写作：产出 Markdown 文稿并写入工作区 |
| 7 | `skill-writing-official-doc` | workflow | ✅ | 模板 `official-doc` | 公文：通知、请示、报告、函等 |
| 8 | `skill-writing-meeting-minutes` | workflow | ✅ | 模板 `meeting-minutes` | 会议纪要：议题归纳、决议与待办 |
| 9 | `skill-wr-policy` | workflow | ✅ | 模板 `policy` | 政策解读：核心句 + 逐条解读 + 风险 |
| 10 | `skill-wr-topic` | workflow | ✅ | 模板 `topic` | 专题研究：多源整合、图表与情景 |
| 11 | `skill-wr-industry` | workflow | ✅ | 模板 `industry` | 行业研究：产业链、格局、驱动与制约 |
| 12 | `skill-wr-macro` | workflow | ✅ | 模板 `macro` | 宏观数据解读：CPI、社融、PMI 等 |
| 13 | `skill-wr-sector-data` | workflow | ✅ | 模板 `sector-data` | 行业数据：高频量价/库存周月度点评 |

写作 `templateId` → Skill 映射见 `WRITING_TEMPLATE_SKILL`（`module-registry.ts`）。

---

## 3. PPT `ppt`（18）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 14 | `skill-ppt-base` | workflow | — | **基座** | 需求采集、摘要确认、模版路由 |
| 15 | `skill-ppt-deck` | workflow | ✅ | 模板 `deck` | 默认 HTML 幻灯片生成与导出流程 |
| 16 | `skill-ppt-pitch-deck` | workflow | ✅ | 模板 `pitch-deck` | 路演 Pitch 十页结构与叙事 |
| 17 | `skill-ppt-weekly-report` | workflow | ✅ | 模板 `weekly-report` | 周报幻灯片：品种跟踪与数据摘要 |
| 18 | `skill-ppt-quarterly-review` | workflow | ✅ | 模板 `quarterly-review` | 季度回顾：复盘、路线图与关键指标 |
| 19 | `skill-ppt-tech-sharing` | workflow | ✅ | 模板 `tech-sharing` | 技术分享：方法论与案例结构 |
| 20 | `skill-ppt-fintech-swiss` | workflow | ✅ | 模板 `fintech-swiss` | 金融科技瑞系：数据驱动、瑞士网格 |
| 21 | `skill-ppt-knowledge-arch` | workflow | ✅ | 模板 `knowledge-arch` | 知识架构梳理与体系化呈现 |
| 22 | `skill-ppt-blue-professional` | workflow | ✅ | 模板 `blue-professional` | 专业蓝调机构研报风格 |
| 23 | `skill-ppt-guizang-editorial` | workflow | ✅ | 模板 `guizang-editorial` | 归藏编辑墨水：杂志风叙事 |
| 24 | `skill-ppt-swiss-international` | workflow | ✅ | 模板 `swiss-international` | 瑞士国际主义：极简网格与强排版 |
| 25 | `skill-ppt-editorial-burgundy` | workflow | ✅ | 模板 `editorial-burgundy` | 编辑工作室：文化叙事与原则清单 |
| 26 | `skill-ppt-open-canvas` | workflow | ✅ | 模板 `open-canvas` | 自由画布 1920×1080 自定义排版 |
| 27 | `skill-ppt-html-studio` | tool | ✅ | 按需 | HTML PPT Studio：多风格静态 HTML 主技能 |
| 28 | `skill-ppt-pptx` | tool | ✅ | 按需 | PPTX 读写与编辑（Anthropic 官方技能） |
| 29 | `skill-ppt-pptx-generator` | tool | ✅ | 按需 | PptxGenJS 生成原生 PPTX |
| 30 | `skill-ppt-slides` | tool | ✅ | 按需 | Markdown 转幻灯片（OpenAI Slides） |
| 31 | `skill-ppt-fidelity-audit` | tool | ✅ | 按需 | HTML 与 PPTX 导出保真度对照与修复 |

PPT `templateId` → Skill 见 `PPT_SKILL_CATALOG` / `PPT_TEMPLATE_SKILL`（`module-registry.ts`）。Open Design 同步见 `skills/ppt-sync-manifest.json`。

---

## 4. 3D / 工业制图 `3d`（3）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 32 | `skill-industrial-drawing-base` | workflow | ✅ | **基座** | 需求收敛、3D 摘要/结构方案、CAD 落盘与预览导出 |
| 33 | `skill-industrial-drawing-parametric` | workflow | ✅ | 生产 | 参数化 OpenSCAD：`drawing.scad` + 参数 JSON |
| 34 | `skill-industrial-drawing-export` | tool | ✅ | 生产 | STL/DXF 预览导出、工具链状态与质检 |

主资产：`drawing.scad`；参数索引：`drawing.parameters.json`。

---

## 5. 视频 `video`（3）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 35 | `skill-vp-base` | workflow | ✅ | **基座** | 收敛视频 brief；P0 路由到网页视频生产 Skill |
| 36 | `skill-vp-video-stage` | workflow | ✅ | 生产 | 视频舞台 → `presentation/`；`?reel=1` / `?auto=1` |
| 37 | `skill-vp-screenplay-canvas` | workflow | ✅ | 生产 | 屏幕叙事 → `studio/`；`?preview=1` / `?capture=1` |

Remotion / 自动 MP4 为 **P1**，非当前 Skill 路径承诺（见 `skill-vp-base`）。

---

## 6. 推演 `simulation`（2）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 38 | `skill-simulation-base` | workflow | ✅ | **基座** | 收敛边界；拆解主体、变量、假设、路径与推演报告 |
| 39 | `skill-world-model` | workflow | ✅ | 生产 | 按 wave 增量构建逻辑自洽的世界模型；节点、边、路径必须遵守本体论、推导语法并可追溯 |

---

## 7. 知识库 `knowledge`（1）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 40 | `skill-kb-qa` | workflow | ✅ | 按需 | 库内 RAG 问答；限定已上传文档，带引用锚点 |

---

## 8. 翻译 `translate`（3）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 41 | `skill-tr-text` | workflow | ✅ | 按需 | 片段中英互译；≥ 2 个备选译文 |
| 42 | `skill-tr-doc` | workflow | ✅ | 按需 | 整篇文档翻译；保留层级与表格 |
| 43 | `skill-tr-polish` | workflow | ✅ | 按需 | 译文润色；语气/术语/文体对照 |

---

## 9. 会议 `meeting`（4）

| # | Slug | 类型 | Catalog | 角色 | 说明 |
|---|------|------|---------|------|------|
| 44 | `skill-mm-summary` | workflow | — | 占位 | 通用会议纪要（5 区块结构） |
| 45 | `skill-mm-daily-standup` | workflow | — | 占位 | 站会 / 周会速记 |
| 46 | `skill-mm-client-review` | workflow | — | 占位 | 客户沟通纪要 |
| 47 | `skill-mm-internal-decision` | workflow | — | 占位 | 内部研讨 / 投决 |

---

## 不在 Catalog 中的 Skill（10）

以下 Skill **有 `SKILL.md`**，但**未**写入 `chat-catalog.json`（主要靠硬注入或尚未接入对话 Pull）：

| Slug | 原因 |
|------|------|
| `skill-platform-research-norms` | 横切规范，每次 Run 注入，非可选 Pull |
| `skill-qa` | 对话默认 `processSkill` |
| `skill-qa-fast` | 旧模式兼容映射 |
| `skill-qa-deep` | 旧模式兼容映射 |
| `skill-writing-base` | 写作模块基座 |
| `skill-ppt-base` | PPT 模块基座 |
| `skill-mm-summary` | 会议模块 V1.1 占位 |
| `skill-mm-daily-standup` | 同上 |
| `skill-mm-client-review` | 同上 |
| `skill-mm-internal-decision` | 同上 |

其余 **37** 个 Skill 中，**31** 个在 Catalog；**6** 个为模块基座或生产 Skill，基座本身不在 Catalog，其下游生产 Skill 在 Catalog 中。

---

## Catalog 索引（`chat-catalog.json`）

按 `slug` 字母序，便于与 JSON 对照：

| Slug | kind | scope |
|------|------|-------|
| `skill-industrial-drawing-base` | workflow | chat, 3d |
| `skill-industrial-drawing-export` | tool | chat, 3d |
| `skill-industrial-drawing-parametric` | workflow | chat, 3d |
| `skill-kb-qa` | workflow | chat, knowledge |
| `skill-ppt-blue-professional` | workflow | ppt |
| `skill-ppt-deck` | workflow | chat, ppt |
| `skill-ppt-editorial-burgundy` | workflow | ppt |
| `skill-ppt-fidelity-audit` | tool | ppt |
| `skill-ppt-fintech-swiss` | workflow | ppt |
| `skill-ppt-guizang-editorial` | workflow | ppt |
| `skill-ppt-html-studio` | tool | chat, ppt |
| `skill-ppt-knowledge-arch` | workflow | ppt |
| `skill-ppt-open-canvas` | workflow | ppt |
| `skill-ppt-pitch-deck` | workflow | chat, ppt |
| `skill-ppt-pptx` | tool | ppt |
| `skill-ppt-pptx-generator` | tool | ppt |
| `skill-ppt-quarterly-review` | workflow | ppt |
| `skill-ppt-slides` | tool | ppt |
| `skill-ppt-swiss-international` | workflow | ppt |
| `skill-ppt-tech-sharing` | workflow | ppt |
| `skill-ppt-weekly-report` | workflow | ppt |
| `skill-simulation-base` | workflow | chat, simulation |
| `skill-world-model` | workflow | chat, simulation |
| `skill-tr-doc` | workflow | chat, translate |
| `skill-tr-polish` | workflow | chat, translate |
| `skill-tr-text` | workflow | chat, translate |
| `skill-vp-base` | workflow | chat, video |
| `skill-vp-screenplay-canvas` | workflow | chat, video |
| `skill-vp-video-stage` | workflow | chat, video |
| `skill-writing-general` | workflow | chat, writing |
| `skill-writing-meeting-minutes` | workflow | writing |
| `skill-writing-official-doc` | workflow | writing |
| `skill-wr-industry` | workflow | chat, writing |
| `skill-wr-macro` | workflow | chat, writing |
| `skill-wr-policy` | workflow | chat, writing |
| `skill-wr-sector-data` | workflow | chat, writing |
| `skill-wr-topic` | workflow | chat, writing |

---

## 维护检查清单

新增或重命名 Skill 时：

1. 创建 `skills/<slug>/SKILL.md`（及可选 `references/`）
2. 若需对话可见：在 `chat-catalog.json` 增加 `entries` 条目
3. 若绑定产品模块：更新 `web/src/lib/module-registry.ts`
4. 更新 [README.md](./README.md) 落地状态表
5. 更新**本文档**对应分区与统计
6. 运行 `pnpm skills:verify`（若项目已配置）

---

## 快速命令

```bash
# 列出全部 Skill 目录
ls skills/skill-*/SKILL.md

# 查看 Catalog
cat skills/chat-catalog.json

# 校验 Catalog 与磁盘一致性
pnpm skills:verify
```

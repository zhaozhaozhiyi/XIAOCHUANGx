# 小窗 — 设计类文档审计与处理建议


| 属性       | 内容                                                                                                                                                                                                 |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 文档版本     | v1.7                                                                                                                                                                                               |
| 日期       | 2026-05-27                                                                                                                                                                                         |
| 用途       | 供产品/研发**逐项判断**是否采纳、何时处理                                                                                                                                                                            |
| 审计范围     | [PRD-小窗.md](../PRD-小窗.md)、[技术方案.md](../技术方案.md)、[功能清单.md](../功能清单.md)、[需求整理.md](../需求整理.md)、[web/docs/](../web/docs/)、[api/README.md](../api/README.md)、`module-registry` / Companion 契约、Skills 资产 |
| 权威顺序（建议） | **PRD 已决** > 模块子 PRD > 技术方案 / API 契约 > 路线图 / 收口清单 > 代码注释                                                                                                                                           |


**图例：**


| 标记    | 含义                |
| ----- | ----------------- |
| 🔴 P0 | 不处理会导致研发/验收各做各的   |
| 🟠 P1 | V1.1 前建议补齐        |
| 🟡 P2 | 可随实现推进            |
| ✅     | 已决 / 已同步 PRD      |
| ☐     | 待你勾选：采纳 / 暂缓 / 拒绝 |


---

## 一、必须先拍板的产品决策

### D-01 ✅ 分支会话：是否新建 XIAOCHUANG 任务目录？（已决 2026-05-27）


| 项        | 内容                                                                      |
| -------- | ----------------------------------------------------------------------- |
| **结论**   | **继承**父会话 `projectId`，**不**新建 `{YYYY-MM-DD}/{标题简写}/`                    |
| **语义**   | **新建对话/任务** → 新建 XIAOCHUANG 任务目录；**对话分支 / Handoff 开新对话** → 仍在同一任务文件夹内继续 |
| **PRD**  | [§5.3.2.1a「新建 vs 分支」表](../PRD-小窗.md)、§6.0.3、F-RT-007、OQ-15；差异 **D-26**  |
| **实现状态** | [api/README.md](../api/README.md)（已写继承，与 PRD 一致 ✅）；Nest `sessions.service.branch` ✅；Web `branchChatSession()` helper ✅；分支 UI 入口 **⬜ V1.1** |
| **你的决定** | ✅ 已采纳（继承方案）                                                             |


---

### D-02 ✅ UI 与平台默认任务目录展示（已决 2026-05-27）


| 项        | 内容                                                                               |
| -------- | -------------------------------------------------------------------------------- |
| **结论**   | 任务创建后 **展示绑定目录**；工作区与用户课题 **同一套逻辑**；侧栏平台默认任务归入 **「默认工作区（XIAOCHUANG）」**，不再长期「无项目」 |
| **目录命名** | `{module}/{YYYY-MM-DD}/{标题简写}/`，同日内重名 `_2`；见 PRD **§5.3.2.1b**、**D-27**          |
| **PRD**  | v3.6.3 §5.3.2.1b、§12.5.3                                                         |
| **实现状态** | C-01/C-02/C-06 均已落代码（2026-05-27）；`ProjectWorkPicker` 文案已改为「不绑定课题文件夹」✅；对话模块首条发送触发 `ensure-default-task-project` ✅ |
| **你的决定** | ✅ 已采纳                                                                            |


---

### D-03 ✅  `local_bound` 两种来源的安全语义


| 项        | 内容                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| **问题**   | PRD §5.3.2.2 写 `local_bound` 须用户**显式授权**；XIAOCHUANG 为 Companion **自动建目录**，也是 `local_bound`                    |
| **建议**   | 在 PRD / 技术方案区分 metadata：`bindingSource: user_picked | platform_default`；后者为产品预授权路径模板，**首次使用告知即可，新建任务不需每次弹授权** |
| **涉及文件** | PRD §5.3.2.2、§5.3.2.2.1、§7.6、`packages/contracts`、`companion/src/projects/store.ts`                           |
| **你的决定** | ✅ 已采纳（v3.6.4）                                                                                                 |


---

### D-04 ✅  翻译模块是否纳入 XIAOCHUANG？


| 项        | 内容                                                                            |
| -------- | ----------------------------------------------------------------------------- |
| **问题**   | PRD §5.3.2.1a 列了 `translate→翻译`，但 module-registry 标 translate **无 Agent 主路径** |
| **方案 A** | 仅当翻译产出**工作区文件**（如导出译文 docx）时进 `XIAOCHUANG/翻译/{任务}/`                           |
| **方案 B** | 翻译不进 XIAOCHUANG，仅存 DB/历史记录                                                    |
| **建议**   | 方案 A；注册表增加 `producesWorkspaceArtifacts: boolean` + `workspaceSegment`         |
| **涉及文件** | PRD §5.3.2.1a、§6.3.4、`module-registry.ts`、功能清单                                |
| **你的决定** | ✅ 方案 A（v3.6.5 / D-29）                                                         |


---

### D-05 🟠 模式 A（cloud）的 XIAOCHUANG 等价路径


| 项        | 内容                                                                                 |
| -------- | ---------------------------------------------------------------------------------- |
| **问题**   | §5.3.2.1a 只详细写了模式 B 本地路径；模式 A 仅「cloud projectId」一句                                 |
| **建议**   | OSS 虚拟前缀对齐：`tenants/{tenantId}/users/{userId}/XIAOCHUANG/{moduleSegment}/{YYYY-MM-DD}/{标题简写}/`，语义与本地 §5.3.2.1b 一致；工作区落 **OSS** |
| **涉及文件** | PRD §5.3.2.1a、§5.3.2.1c、[技术方案.md](../技术方案.md) §5.1.1 |
| **你的决定** | ✅ 已采纳（v3.6.6 / PRD D-30）；模式 A 工作区 = **OSS** |


---

### D-06 🟠 纪要/文稿历史权威源（OQ-19 / OQ-MM-03）


| 项        | 内容                                                                                |
| -------- | --------------------------------------------------------------------------------- |
| **问题**   | 「纪要历史 / 我的文稿」索引在 Nest，正文在工作区文件，未决以谁为准                                             |
| **建议**   | **正文以工作区 + 对象存储为准**；DB 为索引/状态/标题；打开详情以 `projectId` 拉树，DB 仅 fallback               |
| **涉及文件** | PRD §11 OQ-19、[meeting-module-prd.md](../web/docs/meeting-module-prd.md) OQ-MM-03 |
| **你的决定** | ✅ 已采纳（v3.6.7 / PRD D-31 §6.0.4）；关闭 OQ-19、OQ-MM-03 |


---

## 二、文档冲突同步（v3.6 XIAOCHUANG — 已传播 v1.5）

> PRD **v3.6.7** 已决项已回写下列文档；代码 C-01/C-02/C-05/C-06/C-07 均已落实（2026-05-27）。剩余开放项见 §四备注。


| ID       | 优先级 | 文档                                                                                       | 当前问题                                               | 建议改法                                               | 你的决定 |
| -------- | --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | ---- |
| **S-01** | 🔴  | [功能清单.md](../功能清单.md) L62、L205                                                           | 「B 默认 sandbox」「沙箱=模式 B 默认」                         | 改为「B 未选项目 → §5.3.2.1a 平台默认工作区」                     | ✅ |
| **S-02** | 🔴  | [mvp-closure-checklist.md](../web/docs/mvp-closure-checklist.md) W1                      | 验收「仍用 sandbox projectId」                           | 改为「按 §5.3.2.1a 创建任务目录」                             | ✅ |
| **S-03** | 🔴  | [companion-api.md](../web/docs/companion-api.md) §2                                      | `POST /v1/projects` 仅 sandbox；无 ensure-default API | 新增 `POST /v1/projects/ensure-default-task-project` | ✅ |
| **S-04** | 🔴  | [folder-import-and-desktop-shell.md](../web/docs/folder-import-and-desktop-shell.md) L75 | sandbox-default                                    | 指向 §5.3.2.1a / `ensure-default-task-project`       | ✅ |
| **S-05** | ✅   | PRD §6.1 L859                                                                            | 曾写沙箱 projectId                                     | **已改** v3.6.1                                      | ✅    |
| **S-06** | ✅   | PRD 分支规则                                                                                 | 曾新建 vs 继承冲突                                        | **已决** v3.6.1 §5.3.2.1a                            | ✅    |
| **S-07** | 🟠  | [chat-skill-orchestration-analysis.md](../web/docs/chat-skill-orchestration-analysis.md) | 沙箱项目定义过时                                           | 更新为平台默认工作区                                         | ✅ |
| **S-08** | 🟠  | [README.md](../README.md)                                                                | 仍写 PRD v3.5                                        | 改为 v3.6.7                                          | ✅ |
| **S-09** | 🟠  | [技术方案.md](../技术方案.md) 头信息                                                                | 关联 PRD v3.5                                        | 升 v1.5，关联 v3.6.7                                   | ✅ |
| **S-10** | 🟠  | [需求整理.md](../需求整理.md) L165                                                               | 分支继承（与 PRD 一致）                                     | 已同步为 XIAOCHUANG 平台默认                                | ✅ |
| **S-11** | 🟠  | PRD §11 OQ-17                                                                            | defaultWorkspaceRoot 候选                            | 标 **已决**（§5.3.2.1a；自动建目录 V1.1）                     | ✅ |


---

## 三、文档缺失（建议新建或扩充）


| ID       | 优先级 | 建议动作                                                | 说明                                           | 你的决定 |
| -------- | --- | --------------------------------------------------- | -------------------------------------------- | ---- |
| **N-01** | 🔴  | 新建 `web/docs/workspace-architecture.md`             | XIAOCHUANG 目录树、新建 vs 分支、UI 分组 vs projectId   | ✅ |
| **N-02** | 🔴  | 扩充 [companion-api.md](../web/docs/companion-api.md) | `ensure-default-task-project` 契约（**S-03 已写入**）             | ✅ |
| **N-03** | 🟠  | 新建 `web/docs/writing-module-prd.md`                 | 写作模块子 PRD                                    | ✅ |
| **N-04** | 🟠  | 新建 `web/docs/ppt-module-prd.md`                     | PPT 模块子 PRD                                  | ✅ |
| **N-05** | 🟠  | [web/docs/README.md](../web/docs/README.md) 索引      | 加入 meeting-module-prd、workspace-architecture | ✅ |
| **N-06** | 🟠  | [skills/README.md](../skills/README.md) 落地状态表       | PRD 引用 Skill vs 仓库是否存在                       | ✅（详表见审计 **§5**） |
| **N-07** | 🟡  | [UI设计规范-Claude风格.md](./UI设计规范-Claude风格.md)          | 默认工作区路径展示、空态                                 | ✅ |
| **N-08** | 🟡  | 会议子 PRD 文首                                          | F-MM ↔ F-ARA-003 映射表                         | ✅ |


---

## 四、代码与契约对齐（设计已写、实现未跟）


| ID       | 优先级 | 位置                                     | 现状                                              | 建议                                        | 你的决定 |
| -------- | --- | -------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ---- |
| ID       | 优先级 | 位置 | 实现结果（2026-05-27） | 遗留 |
| -------- | --- | --- | --- | --- |
| **C-01** | 🔴  | `web/src/lib/research-projects.ts` + `research-projects-server.ts` | `resolveCompanionWorkspaceProjectId` → `ensure-default-task-project`；Hermes/Mock 路径仍保留 `sandbox-default` 回退 | Hermes/Mock 演示路径 |
| **C-02** | 🔴  | `companion/src/projects/store.ts` + `routes/projects.ts` | `ensureDefaultTaskProject()` + `POST /v1/projects/ensure-default-task-project` ✅ | 其他模块（会议/写作/PPT）建任务时需各自接入 |
| **C-03** | 🟠  | `web/src/lib/module-registry.ts` | `producesWorkspaceArtifacts` + `workspaceSegment` ✅；`companion/src/module-segments.ts` 同步 | 两份需人工保持一致 |
| **C-04** | 🟠  | `packages/contracts` + Companion types | `bindingSource` schema / 类型 ✅；`ensureDefaultTaskProjectRequestSchema` 新增 ✅ | Nest Prisma `Project` 表无此字段（模式 A 用时再补） |
| **C-05** | 🟠  | `api/src/projects/projects.service.ts` | `createDefaultForNewChat` 默认改为 `cloud` ✅ | 模式 A OSS 工作区实现 ⬜ V1.1 |
| **C-06** | 🟠  | UI 文案（多处） | 「不绑定课题文件夹」「未绑定课题文件夹」「默认工作区（XIAOCHUANG）」✅；`ChatComposer`/`ChatHistorySidebar`/`ChatThread`/`WorkspaceProjectContext`/历史页 全部更新 | — |
| **C-07** | 🟠  | `api` 分支 + Web helper | Nest `sessions.service.branch` 继承 `projectId` ✅；`branchChatSession()` helper ✅ | 分支/Handoff **UI 入口** ⬜ V1.1 |

**Web BFF 补充**：新增 `GET /api/projects`（Companion 项目列表）、`POST /api/projects/ensure-default-task-project` BFF 路由 ✅

**备注**：`sandbox-default` 仅作历史迁移标识保留，用户新任务不再使用。


---

## 五、Skill 与模板资产（清单与编写优先级）

> **维护副本：** [skills/README.md](../skills/README.md) §落地状态表（N-06）；**绑定权威：** `web/src/lib/module-registry.ts` + PRD §6.10.1a。  
> **统计（2026-05-27）：** 注册表流程 Skill **24** 个 slug；仓库已有 `SKILL.md` **18** 个（含 PPT 工具类）；**缺失 10** 个流程 Skill；模板包 `tpl-mm-*` / `tpl-wr-*` **全部缺失**。

### 5.1 完整清单（注册表 ↔ 仓库）

**图例：** ✅ 已有 `skills/<slug>/SKILL.md`　❌ 缺失　🔶 已有但建议补强　— 不适用（无流程 Skill）

#### 横切 + L0 Prompt

| 资产 | 类型 | 仓库 | 阶段 | 说明 |
|------|------|------|------|------|
| `skill-platform-research-norms` | L4 横切 Skill | ✅ | MVP | 每次 Run 注入 |
| `prompts/platform/identity.md` | L0 | ✅ | MVP | 平台身份 |
| `prompts/platform/mode-hints.md` | L0 | ✅ | MVP | 与 `skill-qa-*` 叠加 |
| `prompts/platform/chat-orchestration.md` | L0 | ✅ | MVP | F-RT-008 混合编排 |
| `prompts/platform/workflow.md` | L0 | ✅ | MVP | 通用工作流 |
| `skills/chat-catalog.json` | Catalog 摘要 | 🔶 | MVP | **仅 3 条**，见 SK-04 |

#### 对话（MVP 深度验收）

| 流程 Skill | 绑定键 | 仓库 | 阶段 | 说明 |
|------------|--------|------|------|------|
| `skill-qa-fast` | `mode=fast` | 🔶 v1.0 | **MVP** | 缺 XIAOCHUANG 产出约定，见 SK-01 |
| `skill-qa-deep` | `mode=deep` | 🔶 v1.1 | **MVP** | 已有轻量/完整研究分支；需与 F-QA-002～005 验收对齐（V1.1 UI） |

#### 会议纪要（V1.1）

| 流程 Skill | templateId | 模板包 | Skill | Pack | 阶段 |
|------------|------------|--------|-------|------|------|
| `skill-mm-summary` | `default` | `tpl-mm-default` | ❌ | ❌ | **V1.1 P0** |
| `skill-mm-daily-standup` | `daily-standup` | `tpl-mm-daily-standup` | ❌ | ❌ | V1.1+ P1 |
| `skill-mm-client-review` | `client-review` | `tpl-mm-client-review` | ❌ | ❌ | V1.1+ P1 |
| `skill-mm-internal-decision` | `internal-decision` | `tpl-mm-internal-decision` | ❌ | ❌ | V1.1+ P1 |

**纪要 canonical 工作区文件（编写 Skill 时须约定）：** `transcript.json`、`summary.md`（可选 `outline.md`、待办节）。

#### 写作（V1.1）

| 流程 Skill | templateId | 模板包 | Skill | Pack | 阶段 |
|------------|------------|--------|-------|------|------|
| `skill-wr-policy` | `policy` | `tpl-wr-policy` | ❌ | ❌ | **V1.1 P0** |
| `skill-wr-topic` | `topic` | `tpl-wr-topic` | ❌ | ❌ | V1.1 P0 |
| `skill-wr-industry` | `industry` | `tpl-wr-industry` | ❌ | ❌ | V1.1 P1 |
| `skill-wr-macro` | `macro` | `tpl-wr-macro` | ❌ | ❌ | V1.1 P1 |
| `skill-wr-sector-data` | `sector-data` | `tpl-wr-sector-data` | ❌ | ❌ | V1.1 P1 |

**文稿 canonical 文件：** `outline.md`、章节 `sections/*.md` 或单文件 `draft.md`（子 PRD 定一种）。

#### PPT（V1.1 — Skill 齐套，验收靠联调）

| 流程 Skill | templateId | 仓库 | 阶段 |
|------------|------------|------|------|
| `skill-ppt-deck` | `default` | ✅ | V1.1 |
| `skill-ppt-pitch-deck` | `pitch-deck` | ✅ | V1.1 |
| `skill-ppt-weekly-report` | `weekly-report` | ✅ | V1.1 |
| `skill-ppt-quarterly-review` | `quarterly-review` | ✅ | V1.1 |
| `skill-ppt-tech-sharing` | `tech-sharing` | ✅ | V1.1 |
| `skill-ppt-fintech-swiss` | `fintech-swiss` | ✅ | V1.1 |
| `skill-ppt-guizang-editorial` | `guizang-editorial` | ✅ | V1.1 |
| `skill-ppt-swiss-international` | `swiss-international` | ✅ | V1.1 |
| `skill-ppt-open-canvas` | `open-canvas` | ✅ | V1.1 |
| `skill-ppt-knowledge-arch` | `knowledge-arch` | ✅ | V1.1 |
| `skill-ppt-blue-professional` | `blue-professional` | ✅ | V1.1 |
| `skill-ppt-editorial-burgundy` | `editorial-burgundy` | ✅ | V1.1 |

**PPT 工具类（不绑 templateId，由 deck Skill 引用）：** `skill-ppt-html-studio`、`skill-ppt-pptx`、`skill-ppt-pptx-generator`、`skill-ppt-slides`、`skill-ppt-fidelity-audit` — 均已 ✅。

#### 知识库 / 翻译

| 流程 Skill | 绑定 | 仓库 | 阶段 |
|------------|------|------|------|
| `skill-kb-qa` | `task=kb-qa` | ❌ | V1.1 P1 |
| `skill-tr-polish` | （可选） | ❌ | V1.1 P2，API 主路径可不建 |

---

### 5.2 重点编写优先级（建议排期）

| 优先级 | 资产 | 原因 | 建议动作 |
|--------|------|------|----------|
| 🔴 **P0 · MVP** | `skill-qa-fast` / `skill-qa-deep` | 唯一深度验收模块 | 补强工作区产出文件名、深度档 Activity 阶段文案（SK-01） |
| 🔴 **P0 · MVP** | `skill-platform-research-norms` | 全模块横切 | 补充 XIAOCHUANG / `projectId` 固定绑定一句（SK-02） |
| 🔴 **P0 · MVP** | `chat-catalog.json` | F-RT-008 Catalog 过窄 | 增加写作/纪要一行摘要，避免深度对话误加载全文（SK-04） |
| 🟠 **P0 · V1.1** | **`skill-mm-summary`** + **`tpl-mm-default`** | 会议模块首期唯一阻塞 | 概要/大纲/QA/待办结构 + `references/checklist.md`（**A-01 / SK-05**） |
| 🟠 **P0 · V1.1** | **`skill-wr-policy`**、**`skill-wr-topic`** | 写作最高频模板 | 大纲四步流程 + 图表嵌入指引 + `assets/template.md`（**A-02 / SK-06**） |
| 🟠 **P1 · V1.1** | `skill-wr-industry` / `macro` / `sector-data` | 写作其余模板 | 可复用 policy 骨架改章节（**A-02**） |
| 🟠 **P1 · V1.1** | `skill-mm-daily-standup` 等 3 个 | 会议可选类型 | 产品确认文案后写（**A-01**） |
| 🟡 **P1 · V1.1** | `skill-kb-qa` | 库内问答子场景 | RAG 引用格式、禁止编造片段（**A-03 / SK-07**） |
| 🟡 **P1 · V1.1** | PPT 流程 Skill 联调 | Skill 已有 | `pnpm skills:verify-ppt` + slide-engine 导出 PPTX 验收（SK-08） |
| ⚪ **P2** | `skill-tr-polish` | 翻译走 API | 仅当有术语表/润色 Agent 需求时再建 |

---

### 5.3 已有 Skill 建议完善项（非新建）

| ID | 优先级 | Skill / 资产 | 现状 | 建议完善 |
|----|--------|--------------|------|----------|
| **SK-01** | 🔴 | `skill-qa-fast` | v1.0，无落盘约定 | 增加：复杂回答可写 `report.md`；路径相对 `projectId` 根；快速模式默认不写长报告 |
| **SK-01** | 🔴 | `skill-qa-deep` | v1.1，已有 `report.md` | 与 §5.3.2.1a 对齐：产出默认写当前任务叶子目录；多信源节与 F-QA-004 验收勾对齐 |
| **SK-02** | 🔴 | `skill-platform-research-norms` | v1.1 | 增加：平台默认工作区 vs 用户课题仅路径不同，**禁止**写 `dataDir`/系统目录 |
| **SK-03** | 🟠 | `prompts/platform/mode-hints.md` | 简短 | 深度档补充「何时落盘 / 何时仅回复」与 `skill-qa-deep` 交叉引用 |
| **SK-04** | 🟠 | `chat-catalog.json` | 仅 3 条 PPT | 增补 `skill-mm-summary`、`skill-wr-policy` 等 **summary 一行**；`scope` 标注模块 |
| **SK-08** | 🟡 | PPT 工具链 | 已同步 OD | 验收 `skill-ppt-fidelity-audit` 是否在 deck 流程中被引用；HTML→PPTX 失败降级文案 |

---

### 5.4 待新建 Skill 最小交付物（编写 checklist）

新建任一流程 Skill 时，目录至少包含：

```text
skills/skill-<slug>/
├── SKILL.md          # frontmatter: slug, module, version
└── references/       # 可选：checklist、输出样例、章节结构
```

**`skill-mm-summary`（V1.1 首个会议 Skill）必须写清：**

- 输入：带说话人标签的转写 + 可选 `templateId`
- 输出结构：概要 / 要点大纲 / QA / 待办（与 PRD §6.4、meeting-module-prd §5.4 一致）
- 工作区：写入 `summary.md`（及 `transcript.json` 若 Agent 结构化阶段负责）
- 禁止：把 ASR 实现细节、厂商 API 写进 Skill

**`skill-wr-policy`（写作首个 Skill）必须写清：**

- 多步骤：参数 → 研究方向 → **大纲确认** → 分章撰写
- 每章可调用图表能力（引用 F-QA-003，不实现连接器）
- 工作区：`outline.md` + 分章文件；与 §6.0.4 正文权威一致

---

### 5.5 行动项汇总（原 A 系列 + Skill 专项）

| ID | 优先级 | 问题 | 建议 | 你的决定 |
|----|--------|------|------|----------|
| **A-01** | 🟠 | 无 `skill-mm-*` | **P0 先写** `skill-mm-summary` + `tpl-mm-default`；P1 再写三可选类型 | ☐ |
| **A-02** | 🟠 | 无 `skill-wr-*` | **P0** `policy` + `topic`；P1 其余三模板 | ☐ |
| **A-03** | 🟡 | 无 `skill-kb-qa` | V1.1 库内问答上线前编写 | ☐ |
| **A-04** | 🟡 | 会议 ASR 无设计 doc | meeting-module-prd 增 ASR BFF 节（**非 Skill**，领域服务） | ☐ |
| **SK-05** | 🟠 | 纪要模板包缺失 | 新建 `template-packs/tpl-mm-default/` 或 Skill 内 `references/` 版式 | ☐ |
| **SK-06** | 🟠 | 写作模板包缺失 | 五类 `tpl-wr-*` 至少 policy 含 `assets/template.md` | ☐ |
| **SK-07** | 🟡 | Catalog 与注册表不同步 | 每新增 Skill 同步 `chat-catalog.json` + `skills/README` 状态表 | ☐ |

---

## 六、叙述易误导项（非硬冲突）


| ID       | 优先级 | 问题                           | 建议                | 你的决定 |
| -------- | --- | ---------------------------- | ----------------- | ---- |
| **M-01** | 🟠  | Hermes Gateway 像默认路径         | 标注「仅原型 BFF 捷径」    | ☐    |
| **M-02** | 🟡  | meeting-module-prd 细、MVP 仅占位 | 文首标 V1.1 验收       | ☐    |
| **M-03** | 🟡  | PRD 修订表 v1.9 写分支继承           | v3.6.1 已统一，可不动历史行 | ✅    |
| **M-04** | 🟡  | `@` 在 `NO_PROJECT_ID` 时不拉树   | 任务创建后应允许 `@`      | ☐    |


---

## 七、已知遗留项（2026-05-27 快照）

> 本节记录 XIAOCHUANG 主链路落地后**仍开放**的技术债、产品缺口和文档资产缺失。
> 对话 + Companion 模式可按 W1/W2 做端到端验收；下列各项按优先级排期。

### 7.1 技术债（不影响对话主路径，需知悉）

| 项 | 说明 | 目标版本 |
|----|------|----------|
| **Hermes / 演示模式** | `resolveWorkspaceProjectId` 仍 `none → sandbox-default`；只有 **Companion** 执行路径走 `ensure-default-task-project` | V1.1 再评估 |
| **`COMPANION_USE_MOCK=true`** | Mock 流式不连真实 Companion，**不会**建 XIAOCHUANG 目录；演示/CI 须 Companion 进程在跑 | — |
| **`sandbox-default` 保留** | Companion `ensureDefaultSandbox()` 仅作迁移 / 内部托管用；**用户新任务不再依赖** | 清理 ⬜ V2 |
| **模块 segment 双份** | `companion/src/module-segments.ts` 与 `web/src/lib/module-registry.ts` 需人工对齐，改一处要同步另一处 | 考虑生成或 runtime 共享 |
| **Nest Prisma 无 `bindingSource`** | 该字段仅在 Companion + `@jlc/contracts`；DB 无列，`ProjectDto` 不返回；模式 A 走 Nest 建项目与本地 XIAOCHUANG 仍是两套 | V1.1 模式 A 联调时补 |
| **其他模块未接 ensure-default** | 会议 / 写作 / PPT / 翻译**创建任务**时尚未统一调 `ensure-default-task-project`；目前仅**对话 chat** 已接 | V1.1 各模块逐步接入 |

### 7.2 产品与体验缺口（审计开放项）

| ID | 内容 | 目标版本 |
|----|------|----------|
| **C-07（UI）** | Nest `branch` + `branchChatSession()` helper 已有；**「分支 / Handoff 开新对话」UI 入口未做** | V1.1 |
| **M-04** | 草稿态 `NO_PROJECT_ID` 时 `@` 仍不拉文件树；首条发送有 `projectId` 后才应可用（需验交互） | V1.1 |
| **D-05（模式 A）** | OSS 前缀 PRD 已写（§5.3.2.1c），**对象存储落盘未实现**，与本地路径等价性未闭环 | V1.1 模式 A |
| **D-06（OQ-19）** | 纪要 / 文稿「索引 DB、正文工作区」已决（PRD D-31）；**各模块列表 / 详情是否都按此实现需分模块验收** | V1.1 验收 |
| **MVP W3–W4** | 手填路径导入文件夹（W3）、对话内点击文件路径打开工作区（W4）**仍 ⬜** | MVP 收尾 |
| **桌面 E1–E3** | Electron 加载 Web（E1）、系统选目录（E2）、打包验证（E3）**仍 ⬜** | MVP 收尾 |

### 7.3 文档与资产缺失

| 项 | 说明 | 目标版本 |
|----|------|----------|
| **§五 Skill 缺失** | 约 **10 个**流程 Skill（`skill-mm-*` / `skill-wr-*` / `skill-kb-qa`）+ 全部 `tpl-mm-*` / `tpl-wr-*` 模板包缺失（A-01～SK-07）；影响会议 / 写作 V1.1 | V1.1 P0 先写 `skill-mm-summary` + `skill-wr-policy` |
| **M-01** | Hermes Gateway 注释像默认路径；应标「仅原型 BFF 捷径」 | 随 M-01 处理 |
| **M-02** | `meeting-module-prd.md` 细节 MVP 仅占位；文首需标「V1.1 验收」 | V1.1 前 |
| **M-04** | `@` 草稿态交互文档未写 | 随 M-04 实现时补 |

### 7.4 建议下一步优先级

```text
P0（V1.1 启动前必做）
  1. 会议 / 写作模块接 ensure-default-task-project（复用对话链路）
  2. 分支 / Handoff UI 入口（C-07）

P1（V1.1 主体）
  3. skill-mm-summary + tpl-mm-default（A-01）
  4. skill-wr-policy / skill-wr-topic（A-02）
  5. @ 草稿态文件树（M-04）
  6. Nest Prisma 补 bindingSource + 模式 A OSS（D-05）

P2（V1.1 后期 / 收尾）
  7. MVP W3–W4 / 桌面 E1–E3
  8. 其余 skill-mm-* / skill-wr-*；skill-kb-qa（A-03）
  9. Hermes/Mock 路径对齐（sandbox-default 清理）
```

---

## 八、原建议处理顺序（历史参考）

```text
第 1 批（已完成）
  D-01 / D-02 / D-27 / D-03 / D-04(D-29) / D-05(D-30) / D-06(D-31) / S-05 / S-06 ✅

第 2 批（文档冲突同步）✅
  S-01～S-11

第 3 批（文档缺失）✅
  N-01～N-08

第 4 批（架构落地）
  C-01/C-02 → C-05/C-06/C-07

第 5 批（Skill 资产 — 见 §5.2）
  MVP：SK-01～SK-04（对话补强 + Catalog）
  V1.1：SK-05 skill-mm-summary → SK-06 skill-wr-policy/topic → A-02 其余 → SK-07 kb-qa
```

---

## 九、处理记录


| 日期         | 条目 ID      | 决定   | 处理人 | 备注                    |
| ---------- | ---------- | ---- | --- | --------------------- |
| 2026-05-27 | D-27（两层目录） | ✅ 已决 | —   | `{日期}/{标题}/`，同日内 `_2` |
| 2026-05-27 | D-02、D-27  | ✅ 已决 | —   | UI 展示绑定目录             |
| 2026-05-27 | D-01       | ✅ 已决 | —   | 分支继承 projectId        |
| 2026-05-27 | D-03       | ✅ 已决 | —   | `bindingSource`；platform_default 预授权 |
| 2026-05-27 | D-04       | ✅ 已决 | —   | 翻译方案 A → PRD D-29     |
| 2026-05-27 | D-05       | ✅ 已决 | —   | 模式 A OSS XIAOCHUANG 等价路径 → PRD D-30 §5.3.2.1c |
| 2026-05-27 | D-06       | ✅ 已决 | —   | 纪要/文稿：索引 DB、正文工作区 → PRD D-31 §6.0.4 |
| 2026-05-27 | S-01～S-11 | ✅ 已同步 | —   | XIAOCHUANG 文档冲突回写；PRD 内「无项目」侧栏表述修正 |
| 2026-05-27 | N-01～N-08 | ✅ 已完成 | —   | workspace-architecture、写作/PPT 子 PRD、索引与 Skill 状态表 |
| 2026-05-27 | C-01～C-07 | ✅ 已落代码 | —   | 对话模块 XIAOCHUANG 主链路打通；分支 UI 入口、其他模块接入 ⬜ V1.1 |


---

## 十、相关链接

- 平台默认工作区：[PRD §5.3.2.1a](../PRD-小窗.md) · [workspace-architecture.md](../web/docs/workspace-architecture.md)
- 新建 vs 分支（已决）：PRD §5.3.2.1a 表格
- 不使用项目映射：[PRD §12.5.3](../PRD-小窗.md)
- 会议模块：[web/docs/meeting-module-prd.md](../web/docs/meeting-module-prd.md)
- 写作 / PPT：[writing-module-prd.md](../web/docs/writing-module-prd.md) · [ppt-module-prd.md](../web/docs/ppt-module-prd.md)
- Skill 库与状态表：[skills/README.md](../skills/README.md) · 本节 **§5**

---

*v1.9（2026-05-27）：新增 **§七「已知遗留项」**（7.1 技术债 / 7.2 产品缺口 / 7.3 文档资产 / 7.4 下一步优先级）；章节编号 §七→§八→§九→§十 顺移。v1.8：§二备注更新为「代码已落实」；§四改为「实现结果 + 遗留」；§八补 C-01～C-07 处理记录。v1.7：§5 扩充 Skill 全量清单、编写优先级 SK-01～SK-08。v1.6：N-01～N-08。*
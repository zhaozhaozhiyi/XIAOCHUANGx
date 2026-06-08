# 翻译模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-06-06 |
| 状态 | 草案（V1.1 启动） |
| 关联 | PRD-小窗 §6.3；[writing-module-prd.v2.md](./writing-module-prd.v2.md)；[ppt-module-prd.v2.md](./ppt-module-prd.v2.md)；[chat-core-architecture.md](./chat-core-architecture.md) |

> 本文档与写作 / PPT v2 完全对称。**PRD-小窗 §6.3 描述的"文档翻译 / 文本翻译 / 翻译历史" 3 个二级菜单已废止**，现行模式："翻译 = 对话 + 翻译 Skill + 交付物 + 导出"。本文档为现行设计，PRD-小窗 §6.3 仅保留作历史。

---

## 1. 概述

### 1.1 目标

翻译模块的本质是**对话的一个特化场景**，与写作 / PPT 模块完全对称：

> **翻译 = 对话 + 翻译 Skill + 交付物 + 导出**

翻译模块复用聊天模块的完整运行时（Companion + CLI、流式 parts、工具调用、交付物），区别仅在于：

1. 加载的 Skill 不同（`skill-tr-*` 替代 QA Skill）
2. 产出始终是"译文 + 备选 + 说明"格式，需要时落 Markdown 文件
3. 文档翻译 / 文本翻译 / 译文润色由对话内切换 Skill 触发，**不**走独立子页

### 1.2 设计原则

- **与写作 / PPT 模式对称** — 翻译、写作、PPT 三个产出型模块遵循完全相同的架构范式：点击 → 新建会话 → 加载默认 Skill → 对话切换其他 Skill
- **不重复造轮** — 交互、组件、API 全部复用聊天模块
- **不在 UI 层区分场景** — 文档/文本/润色只是不同的 Skill，不在导航/路由层暴露
- **交付物即译文** — 文档翻译产出的 `.md` 就是译文成果；文本翻译默认在对话中直接显示，按需保存
- **多备选 / 不直白机翻** — Skill 层强制要求 ≥ 2 个译文备选与必要时的术语对照表，避免低质量逐词机翻

### 1.3 非范围（明确不做）

| 项 | 原因 |
|----|------|
| 「文档翻译」「文本翻译」「翻译历史」3 个独立子页 | v1 PRD 描述，已废止；统一为「翻译」一项 |
| 翻译历史独立 UI 列表 | 工作区文件 + 对话历史侧栏即历史 |
| 上传文档表单 / 语言下拉 / 对照模式开关等独立设置面板 | 在对话中通过附件 + 自然语言表达 |
| 步骤向导（上传→选语言→对照→生成） | 遵循对话式交互 |
| BYOK 翻译 API（如 DeepL/Google）调度面板 | V1.1+；MVP 由 Agent + Skill 走通用模型路径 |
| 快速/深度模式切换 | 翻译按 Skill 自带的"快报/详细"分支即可，UI 不再区分 |
| 多人协作 / 翻译记忆库（TM）/ 术语库管理 | V2.0+ |

---

## 2. 用户流程

```
点击「翻译」→ 新建翻译会话，加载默认 skill-tr-text
              → 用户描述需求（粘贴文本 / 上传文档 / 贴现有译文 + 润色目标）
              → 用户可在 Composer 下拉切换 skill-tr-doc / skill-tr-polish
              → Agent 执行翻译，产出译文（对话内）与 .md（文档翻译时落工作区）
              → 用户预览 / 追加修改 / 让 Agent 给更多备选
              → 满意 → 复制 / 导出 / 加入知识库
```

与普通对话的唯一差异：加载的 Skill 不同 + Composer 下拉给出 3 个翻译 Skill 切换项。

---

## 3. 架构

### 3.1 模块注册

`web/src/lib/module-registry.ts`：

```
ModuleId 联合加 "translate"
DomainService 加 "translate-engine"

MODULE_REGISTRY.translate = {
  moduleId: "translate",
  label: "翻译",
  domainServices: ["translate-engine"],
  agentPrimaryPath: true,
  producesWorkspaceArtifacts: true,
  workspaceSegment: "翻译",
}

TRANSLATE_TEMPLATE_SKILL = {
  text:   "skill-tr-text",
  doc:    "skill-tr-doc",
  polish: "skill-tr-polish",
}

resolveSkills 加 "translate" 分支
```

### 3.2 路由

| 路径 | 说明 |
|------|------|
| `/translate` | 重定向到 `/translate/new` |
| `/translate/new` | 加载 `ChatHome`，`surfaceModuleId="translate"`，默认 `skill-tr-text` |
| `/translate/[id]` | 加载 `ChatThread`，同 surfaceModuleId |

与写作 / PPT 完全一致的 3 文件结构（page.tsx / new/page.tsx / [id]/page.tsx）。

### 3.3 导航

```
翻译  ← 一级导航仅一项 subNav：「翻译」，描述「对话式翻译」
```

icon 使用 `lucide-react` 的 `Languages`。

### 3.4 Composer 下拉（Skill 切换）

`web/src/lib/module-chat-config.ts` 的 `TRANSLATE_SKILL_OPTIONS`：

| templateId | label | description |
|------------|-------|-------------|
| `text`   | 文本翻译 | 粘贴片段，即时多备选译文（默认） |
| `doc`    | 文档翻译 | 整篇翻译，保留层级与表格，可选对照模式 |
| `polish` | 译文润色 | 已有译文 → 调整语气、术语、文体 |

下拉值持久化到 `localStorage`（与写作 / PPT 同样的 `moduleSkillStorageKey` 机制），key 前缀 `jlc-translate-skill`。

---

## 4. Skill 设计

3 个流程 Skill，全部 `kind: "workflow"`，全部 `scope: ["chat", "translate"]`，平级注册到 `skills/chat-catalog.json`。

### 4.1 `skill-tr-text`（默认）

- 面向短到中等长度（≤ 1000 字）的粘贴文本
- **必出 ≥ 2 个译文备选 + 说明段**（差异在直译/意译、口语/书面、正式/亲切等维度上可感）
- 默认在对话中直接回复，不强制写工作区；用户要求保存时落 `文本翻译-<摘要>-<源→目标>-<时间>.md`
- 禁止：机翻直白、单一译法、删减原意、忽略礼貌等级、对法律/财务条款做创造性翻译

### 4.2 `skill-tr-doc`

- 面向整篇文档（PDF / Word / Markdown / 长文）
- **保留 H1/H2/H3 层级、表格、列表、引用、代码块**
- 含**术语对照表（附录）** + **疑难点与备选方案**段
- 长文 > 2000 字先抽样校对（开头 + 含术语段）让用户确认风格；< 2000 字直接整篇
- 文件命名：`文档翻译-<标题简写>-<源→目标>-<YYYY-MM-DD>.md`，落工作区根（实际由 §5 任务目录解析）
- 禁止：机翻直白、歧义只给一种译法、自动改写事实、夹带解读（解读切到 `skill-wr-policy`）

### 4.3 `skill-tr-polish`

- 面向已有译文（机翻初稿 / 他人翻译 / 早先译稿）
- **先诊断（≤ 5 行）→ 确认方向（最多反问 1 次）→ 改写 → 自检（≥ 3 条具体修改点）**
- 用户提供原文时做忠实度核对，未提供时只能做语言层面修缮且必须显式声明限制
- 禁止：把润色做成重译、只换同义词冒充润色、为流畅性扭曲事实、自动改变语气强度、隐藏修改、加入新事实/新观点

### 4.4 SKILL.md frontmatter 约定

与写作 5 个 `skill-wr-*` 一致：

```yaml
---
slug: skill-tr-<x>
module: translate
task: translate
templateId: <text | doc | polish>
version: "0.1"
---
```

---

## 5. 工作区与产出

| 场景 | 工作区行为 |
|------|-----------|
| 文本翻译（默认）| 不强制创建任务目录；对话中显示译文 + 备选 |
| 文本翻译（用户要求保存 / 导出） | 触发 `ensure-default-task-project`，写入 `XIAOCHUANG/翻译/{YYYY-MM-DD}/{标题简写}/` |
| 文档翻译 | 创建任务即建 `XIAOCHUANG/翻译/…`，译文 `.md` 落该目录 |
| 译文润色 | 同文本翻译规则 |

文件命名约定见各 SKILL.md。

> 与 PRD-小窗 §5.3.2.1a / §6.3.4 / D-29 对齐：`workspaceSegment="翻译"`，落盘 / 导出时建任务目录，纯文本翻译且未导出时可仅在对话历史中保留。

---

## 6. UI 规格

### 6.1 入口

- 点击侧栏「翻译」 → 新建会话，加载 `skill-tr-text`
- 后续可在对话历史侧栏继续既有翻译会话

### 6.2 翻译对话页

与聊天 / 写作 / PPT 页面使用**同一组件**，差异点：

| 差异项 | 聊天 | 翻译 |
|--------|------|------|
| 默认 Skill | `skill-qa-fast` | `skill-tr-text` |
| 模式切换 | 快速/深度 | 无 |
| Composer 下拉 | 无 | 3 个翻译 Skill（text/doc/polish） |
| 交付物类型 | 多样 | 文档翻译为 `.md`；文本/润色按需 |
| 导出 | 无 | 复用工作区文件的复制 / 导出 / 加入知识库通道 |

### 6.3 交付物展示

文档翻译产出的 `.md` 通过 DeliverablesCard 展示，复用写作模块的下载 / 预览能力（MD 渲染已有）。

---

## 7. 验收清单

### P0（V1.1 启动）

| # | 项 | 验证 |
|---|-----|------|
| T1 | 点击「翻译」进入对话界面，**非表单页** | 目测 |
| T2 | 新建会话默认加载 `skill-tr-text` | `run.started` 元数据 `processSkill` |
| T3 | Composer 下拉可切换 text / doc / polish 三个 Skill，切换后再发会换 `processSkill` | 看下次 `run.started` |
| T4 | 翻译对话过程与聊天一致（流式 / parts / 工具） | 同聊天 D1-D4 |
| T5 | 文档翻译 Agent 产出 `.md` 文件到工作区翻译子目录 | 工作区可见 `XIAOCHUANG/翻译/…/*.md` |
| T6 | 翻译会话出现在历史侧栏中 | 侧栏可见 surfaceModuleId="translate" 的会话 |
| T7 | `pnpm skills:verify` 通过；`loadSkill` 3 个 `skill-tr-*` 均能加载 | CI / 本地脚本 |

### P1（体验优化）

| # | 项 | 说明 |
|---|-----|------|
| T8 | 文本翻译至少给 2 个备选译文 + 说明 | Skill 强制；可在样本对话中目检 |
| T9 | 文档翻译保留 H1/H2/H3 层级与表格 | 抽样文档对照 |
| T10 | 译文润色给出 ≥ 3 条具体修改点 + 修改对照 | 抽样润色任务目检 |
| T11 | 翻译任务目录命名符合 `XIAOCHUANG/翻译/{YYYY-MM-DD}/{标题简写}/` | 工作区检查 |

---

## 8. 与写作 / PPT 模块的差异对照

| 维度 | 写作 | PPT | 翻译 |
|------|------|-----|------|
| 默认 Skill | `skill-writing-general` | `skill-ppt-pitch-deck` | `skill-tr-text` |
| Composer 下拉 Skill 数 | 3（通用/公文/会议纪要） | 17+（与 Open Design 同步） | 3（文本/文档/润色） |
| 产出格式 | `.md` | `.pptx` / `.html` | 对话回复（默认）；`.md`（文档翻译/导出时） |
| 后处理 | MD → DOCX（Pandoc） | 直接下载原文件 | 复用工作区文件通道 |
| 工作区目录 | `写作` | `PPT` | `翻译` |
| 模板包 `tpl-*` | `tpl-wr-*` | `tpl-ppt-*` | 暂无；翻译不依赖外部模板包 |

---

## 9. 实施任务（V1.1 启动批次）

| # | 任务 | 状态 |
|---|------|------|
| 1 | 3 个 SKILL.md（`skill-tr-text/doc/polish`）| ✅ 本批次 |
| 2 | 路由 `/translate/{,new,[id]}/page.tsx` | ✅ 本批次 |
| 3 | `navigation.ts` 加 `translate` NAV_MODULES 项 | ✅ 本批次 |
| 4 | `module-registry.ts`：`ModuleId` / `DomainService` / `MODULE_REGISTRY` / `TRANSLATE_TEMPLATE_SKILL` / `resolveSkills` 分支 | ✅ 本批次 |
| 5 | `module-chat-config.ts`：`MODULE_CHAT_SURFACES.translate` / `TRANSLATE_SKILL_OPTIONS` / `skillPicker` | ✅ 本批次 |
| 6 | `companion/run.ts`：`surfaceModuleId="translate"` 分支、`processSkill`、`binding`、`timeoutProfile` | ✅ 本批次 |
| 7 | `chat-catalog.json` / `skills/README.md` 更新 | ✅ 本批次 |
| 8 | 全链路 `translateTemplateId` 透传（Composer→pending→sendMessage→hermes→companion）| ✅ 本批次 |
| 9 | PRD-小窗 §6.3 / §4.2 加 v2 替代头；功能清单同步 | ✅ 本批次 |
| 10 | `pnpm skills:verify` PASS + `loadSkill` 3 个新 skill 验证 | ✅ 本批次 |
| 11 | **端到端 SSE 真流验证** | ⏸️ 本批次不做（"V1.1 启动验证而非端到端集成"，留 P0 验收用） |
| 12 | 文档翻译 BYOK 接口（DeepL / Google API） | ⏸️ V1.1+ |
| 13 | 翻译记忆库 / 术语库管理 | ⏸️ V2.0+ |

---

## 10. 设计决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 翻译 UI 复用聊天组件 | 是 | 与写作 / PPT 模式一致 |
| 移除 v1 PRD 的 3 个二级菜单 | 是 | 模板只是不同 Skill，不在导航暴露 |
| 移除翻译历史独立 UI | 是 | 对话历史侧栏 + 工作区文件即历史 |
| 默认 Skill 选 `skill-tr-text` | 是 | 用户首次进入最高概率是粘贴文本翻译 |
| Skill 层强制 ≥ 2 个译文备选 | 是 | 避免机翻直白；翻译质量首位 |
| `agentPrimaryPath: true` | 是 | 与 PRD-小窗 §6.3.4 D-29 兼容；BYOK API 是 V1.1+ 增强而非替代 |
| `producesWorkspaceArtifacts: true` + `workspaceSegment="翻译"` | 是 | 与 §5.3.2.1a 注册表保持一致 |
| 不再为「文档翻译 / 文本翻译」分别建路由 | 是 | 由 Skill 切换承载；UI 一致性 |
| 端到端 SSE 真流验证留到 V1.1 验收 | 是 | 本批次为"启动验证"，先把绑定 / 注册 / 路由 / Skill 上齐 |

# 写作模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-05-31 |
| 状态 | Beta 收口中（代码与主流程已落地，持续做真实验收） |
| 关联 | PRD-小窗 §F-WR；[chat-core-architecture.md](../../technical/chat-core-architecture.md) |

---

## 1. 概述

### 1.1 目标

写作模块的本质是**对话的一个特化场景**，而非独立功能。其核心思路：

> **写作 = 对话 + 写作 Skill + MD 交付 + DOCX 导出**

写作模块复用聊天模块的完整运行时（Companion + CLI、流式 parts、工具调用、交付物），区别仅在于：

1. 加载的 Skill 不同（写作 Skill 替代 QA Skill）
2. 产出要求始终为 Markdown
3. 增加 MD → DOCX 导出能力

### 1.2 设计原则

- **不重复造轮** — 交互、组件、API 全部复用聊天模块
- **不在 UI 层区分模板** — 模板只是不同的 Skill，不在导航/路由层暴露
- **交付物即文稿** — Agent 产出的 `.md` 文件就是写作成果，不建独立文稿管理
- **导出为后处理** — DOCX 导出是工作区文件的后处理通道，非写作流程的必需环节
- **基座 Skill 管需求收敛，写作 Skill 管成稿** — 写作默认基座 Skill 负责 AI to UI 追问、需求摘要确认与大纲进入门槛；具体写作 Skill 负责文体、结构与成稿规范

### 1.3 非范围（明确不做）

| 项 | 原因 |
|----|------|
| 写作模板选择页 | 默认加载通用写作 Skill，用户可在对话中换 |
| 步骤向导（参数设置→方向→大纲→撰写） | 遵循对话式交互，不走分步表单 |
| 前端写死整张需求表单 | 需求问题由默认基座 Skill 根据用户输入动态生成，前端只负责渲染 |
| 我的文稿管理列表 | 工作区文件即文稿，桌面端创建会话时已建文件夹 |
| 政策解读、专题研究等独立子页面 | 统一写作入口，模板只是 Skill 差异 |
| 多人协作文稿 | Web Sandbox |
| 文档版本历史/比对 | Desktop Beta+ |
| 快速/深度模式切换 | 写作是深度产出任务，不需要两档模式 |

---

## 2. 用户流程

```
点击「写作」→ 新建写作会话，加载默认写作基座 Skill
              → 用户输入需求
              → 基座 Skill 判断信息是否充分
              → 若不足，则返回结构化问题给前端渲染
              → 用户填写回答并提交
              → 基座 Skill 生成需求摘要并请求确认
              → 基座 Skill 进入大纲阶段，并调用具体写作 Skill
              → Agent 执行写作
              → 产出 .md 交付物
              → 用户预览 / 追加修改
              → 满意 → 导出 DOCX
```

写作流程与普通聊天的关键差异，是写作会先经过默认基座 Skill 的要求收集与确认阶段。

---

## 3. 架构变更

### 3.1 模块注册

在 `module-registry.ts` 中，写作模块从独立组件改为指向聊天组件：

```
// 当前（简化前）
writing → 独立 WritingModuleContent + 子路由

// 目标
writing {
  component: ChatModuleContent,   // 复用聊天组件
  defaultSkill: 'skill-writing-base',
}
```

### 3.2 路由简化

**移除的路径：**

| 路径 | 说明 |
|------|------|
| `/writing/new` | 新建写作表单页 |
| `/writing/policy` | 政策解读模板 |
| `/writing/topic` | 专题研究模板 |
| `/writing/industry` | 行业研究模板 |
| `/writing/macro` | 宏观数据解读模板 |
| `/writing/sector-data` | 行业数据解读模板 |
| `/writing/mine` | 我的文稿列表 |

**目标路径：**

| 路径 | 说明 |
|------|------|
| `/writing` | 重定向到 `/writing/new` |
| `/writing/new` | 渲染聊天组件，预置 `skill-writing-base` |

`/writing/new` 与 `/chat` 使用同一页面组件，仅 `skillId` 参数不同。

### 3.3 导航简化

**当前（移除）：**
```
写作
├── 新建写作
├── 政策解读
├── 专题研究
├── 行业研究
├── 宏观数据解读
├── 行业数据解读
└── 我的文稿
```

**目标：**
```
写作  ← 一级导航仅一项，点击直接进入写作对话
```

---

## 4. Skill 设计

写作 Skill 建议分两层：

- 默认基座 Skill：负责流程控制
- 具体写作 Skill：负责文体、结构、输出方向

### 4.1 skill-writing-base（默认基座 Skill）

**职责：**

- 判断写作任务信息是否充分
- 信息不足时返回结构化问题
- 接收用户回答并汇总需求摘要
- 请求用户确认摘要
- 确认后按任务复杂度决定：直接进入成稿，或先进入大纲阶段
- 将确认后的需求交给具体写作 Skill 执行

### 4.2 AI to UI 需求采集协议

`skill-writing-base` 不直接要求前端写死一张表单，而是返回结构化问题，由前端动态渲染。

补充原则：

- 问题内容、问题数量、字段类型、选项内容由 AI 根据当前用户需求动态决定。
- 前端只实现通用的 `writing_requirements` 表单渲染协议，不拥有业务问题定义权。
- 是否需要发起追问、首轮信息是否已足够进入摘要阶段，优先由 AI 判断；前端、Companion、Runtime 不应通过硬编码业务规则预先裁决“该不该问”。
- 我们接受 AI 判断会持续演进这一事实，产品策略应优先提升 Skill 质量与真实链路验证，而不是不断追加业务型代码兜底。
- 若运行时暂时未返回结构化问题，可由 Companion 做文本退化解析，但这只是兼容路径，不应成为长期主路径。
- 验收必须以真实 Companion / Runtime / `parts[]` 输出为准，`mock` 仅用于开发联调。

建议协议支持的问题类型：

- `text`
- `textarea`
- `single_select`
- `multi_select`
- `date`
- `time`
- `datetime`
- `number`
- `file_pick`
- `file_upload`

建议前端对应渲染为：

- `writing_requirements`
- `writing_requirement_summary`
- `writing_outline`

补充说明：

- `writing_outline` 是按需阶段，不是固定必经阶段。
- 对于通知、邀请函、群公告、短说明等低结构任务，允许在摘要确认后直接进入成稿。
- 对于研究报告、政策解读、长篇专题稿、行业分析等高结构任务，优先先进入大纲阶段。

### 4.3 skill-writing-general（默认主写作 Skill）

**路径：** `skills/skill-writing-general/SKILL.md`

**职责：** 在基座 Skill 完成 brief 收敛后，引导 Agent 产出高质量 Markdown 文稿。

**SKILL.md 核心内容：**

```
# skill-writing-general

## 角色
你是小窗的写作助手，擅长研究报告、行业分析、政策解读等专业文稿。

## 产出规范
1. 所有产出必须为 Markdown 格式
2. 使用 file_write 将文稿写入工作区
3. 文件名格式：<主题>-<日期>.md
4. 包含完整标题层级、段落、必要时含表格

## 写作流程
1. 读取并承接已确认的写作需求摘要
2. 如需数据可调用工具检索
3. 完成后询问用户是否修改补充
4. 用户确认后定稿

## 引用规范
- 数据引用标注来源
- 格式：[来源名称](https://example.com)
```

### 4.4 扩展写作 Skill（后续可选）

以下 Skill 同为 `chat-catalog.json` 中的平级项，按需添加：

| Skill | 说明 |
|-------|------|
| `skill-writing-general` | 默认成稿 Skill，覆盖大多数场景 |
| `skill-writing-research` | 侧重数据分析的结构化研报 |
| `skill-writing-policy` | 侧重政策文本分析 |

用户可在对话中切换 Skill，**不强制**选模板。

---

## 5. UI 规格

### 5.1 入口

- 点击「写作」导航 → 新建会话，加载 `skill-writing-base`

### 5.2 写作对话页

与聊天页面使用**同一组件**，差异点：

| 差异项 | 聊天 | 写作 |
|--------|------|------|
| 默认流程 Skill | `skill-qa` | `skill-writing-base` |
| 问答策略 | 自动判断 | 无 |
| 交付物类型 | 多样 | 始终为 `.md` |
| 首轮流程 | 普通问答 | 先要求收集，再摘要确认；按需进入大纲或直接成稿 |
| 导出 | 无 | 增加「生成 DOCX 到工作区」操作 |

### 5.3 生成 DOCX 到工作区

在交付物卡片或工作区工具栏中增加「生成 DOCX」操作项。Desktop 主路径下，DOCX 是当前本地工作区中的派生文件，用户后续操作应是打开、在文件夹中显示、另存或导出副本，而不是“下载到本机”。

#### 流程

```
用户点击「生成 DOCX」
  → Web: POST /api/writing/export-docx { filePath }
  → BFF: 读取 .md 文件
  → BFF: 调用 Pandoc 转换
  → BFF/Companion: 将 .docx 写入当前工作区
  → Web: 刷新文件树并打开或定位 .docx
```

#### 实现方案（`0.1.0-alpha`）

选用 **Pandoc**：`pandoc input.md -o output.docx`。

BFF 新增 `POST /api/writing/export-docx` 接口，调用本机 pandoc 命令，并优先将结果写回当前工作区。浏览器下载只作为 Web Sandbox 或兼容入口，不作为 Desktop 主体验。

#### 导出选项（Desktop Beta）

| 选项 | 说明 |
|------|------|
| 模板选择 | 报告/简报/公文等样式模板 |
| 导出范围 | 整篇 / 选中章节 |
| 批量导出 | 多文件合并 |

---

## 6. 验收标准

> 状态更新（2026-06-24）：以下状态以当前仓库代码和真实 smoke 为准。已完成 `pnpm qa:writing-ppt-ai-ui`、首轮 F1/F2/F3 与连续流 T2/T3 验收；真实 `.md` 落盘已验证。DOCX 生成链路代码存在，但本轮未完整验证 Pandoc 环境、工作区写回、打开与定位体验。

### P0（`0.1.0-alpha` 必须通过）

| # | 项 | 验证 | 状态 |
|---|-----|------|------|
| W1 | 点击「写作」进入对话界面，非表单页 | 目测 | 已完成：`/writing/new` 渲染 `ChatHome surfaceModuleId="writing"` |
| W2 | 新建会话默认加载 `skill-writing-base` | `run.started` 元数据 | ✅ 已完成并已验证：`MODULE_CHAT_SURFACES.writing.defaultProcessSkill = WRITING_BASE_SKILL` |
| W3 | 信息不足时，基座 Skill 返回结构化问题 | 前端出现问题卡 | ✅ 已完成并已验证：F2 / T2 / T3 通过 |
| W4 | 用户提交回答后，生成需求摘要并可确认 | 时间线可见摘要卡 | ✅ 已完成并已验证：F1 / F3 / T2 / T3 通过 |
| W5 | 确认后进入大纲与成稿流程 | 时间线可见大纲卡 | ✅ 已完成并已验证：T2 走“无大纲直接成稿”，T3 走“有大纲再成稿” |
| W6 | Agent 产出 `.md` 文件到工作区 | 工作区可见 | ✅ 已完成并已验证：真实 `.md` 落盘已确认 |
| W7 | 交付物卡片或工作区工具栏可触发 DOCX 生成 | `.docx` 写入工作区并可打开 / 定位 | 代码已完成，待验收：`POST /api/writing/export-docx` 已实现；Pandoc 本机环境、工作区写回与打开 / 定位体验未在本轮验证 |
| W8 | 写作会话出现在历史侧栏中 | 侧栏可见写作历史 | 代码已完成，待验收：本轮未做 UI 手测 |

### P1（体验优化）

| # | 项 | 说明 | 状态 |
|---|-----|------|------|
| W7 | DOCX 保留标题层级 | 验证 H1/H2/H3 映射 | 代码已完成，待验收：依赖 Pandoc 默认转换，未做样式验收 |
| W8 | DOCX 保留表格 | 简单表格样式 | 代码已完成，待验收：依赖 Pandoc 默认转换，未做表格样式验收 |
| W9 | 中文排版优化 | 段首缩进、行距 | 未完成：当前导出接口未见中文排版模板或 Pandoc reference doc 配置 |

---

## 7. 实施任务

| # | 任务 | 状态 |
|---|------|------|
| 1 | 简化导航：移除写作子菜单 | 已完成：`navigation.ts` 写作仅保留一级「写作」入口 |
| 2 | 简化路由：移除 `/writing/policy` 等子路由 | 已完成：当前 `web/src/app/(main)/writing` 仅有 `/writing`、`/writing/new`、`/writing/[id]` |
| 3 | 模块注册表：写作指向聊天组件 | 代码已完成，待验收：路由层已复用 `ChatHome/ChatThread`；`module-registry.ts` 仍保留旧 template skill 映射，需后续清理 |
| 4 | 新增 `skill-writing-base`，编写 AI to UI 需求采集逻辑 | 已完成：`skills/skill-writing-base/SKILL.md` 与 references 已存在 |
| 5 | 编写或对接 `skill-writing-general/SKILL.md` | 已完成：`skills/skill-writing-general/SKILL.md` 已存在 |
| 6 | 前端支持 `writing_requirements` / `writing_requirement_summary` / `writing_outline` | 代码已完成，待验收：`PartRenderer` 与相关卡片已支持 |
| 7 | 注册写作 Skill 到 chat-catalog.json | 已完成：`skill-writing-base`、`skill-writing-general` 已注册 |
| 8 | 交付物卡片增加「生成 DOCX」入口 | 已完成：`DeliverablesCard` 对写作 `.md` 展示 DOCX 派生操作；后续文案需统一为工作区本地交付心智 |
| 9 | BFF `POST /api/writing/export-docx` 接口 | 已完成：接口已实现并支持 Companion/legacy 文件读取 |
| 10 | 集成 Pandoc | 代码已完成，待验收：接口调用本机 `pandoc`；未验证用户环境是否安装 |
| 11 | 验收 W1-W8 | 部分完成：W1-W6 已有真实 smoke / 落盘验收；W7-W8 仍待 UI / 本地工作区交付物手测 |
| 12 | 清理旧写作模板残留 | 不作为当前收口阻塞项：`WRITING_TEMPLATE_SKILL` 保留模板映射，当前代码仍在使用 |
| 13 | 工作区统一派生入口 | 未完成：DOCX 生成目前在交付物卡片，尚未收敛到 `FileViewer` 统一工具栏 |

---

## 8. 设计决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 写作 UI 复用聊天组件 | 是 | 一致体验 + 少维护成本 |
| 不作为独立模块开发 | 是 | 写作只是不同 Skill 的对话 |
| 移除模板选择页 | 是 | 不强制用户写作前选模板 |
| 移除文稿管理 | 是 | 工作区文件即文稿 |
| 移除快速/深度模式 | 是 | 写作不需要两档模式 |
| 保留模型/Skill 选择器 | 是 | 用户需能切换模型或写作 Skill |
| 导出用 Pandoc | `0.1.0-alpha` | 成熟免费，无需自研 |

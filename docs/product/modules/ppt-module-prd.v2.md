# PPT 模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-05-31 |
| 状态 | Beta 收口中（代码与主流程已落地，持续做真实验收） |
| 关联 | PRD-小窗 §F-PPT；[chat-core-architecture.md](../../technical/chat-core-architecture.md)；[writing-module-prd.v2.md](./writing-module-prd.v2.md) |

---

## 1. 概述

### 1.1 目标

与写作模块完全一致的模式：**PPT = 对话 + PPT Skill + 交付物 + 导出**。

PPT 模块复用聊天模块的完整运行时（Companion + CLI、流式 parts、工具调用、交付物），区别仅在于：

1. 加载的 Skill 不同（PPT Skill 替代 QA Skill）
2. Agent 产出 PPT 文件（`.pptx` / `.html` 等格式）
3. 增加 PPTX 预览与导出能力

### 1.2 设计原则

- **与写作模式对称** — 写作和 PPT 遵循完全相同的架构范式：点击 → 新建会话 → 加载默认 Skill
- **不建独立 UI** — 交互、组件、API 全部复用聊天模块
- **交付物即 PPT** — Agent 产出的文件就是 PPT 成果，不建独立管理列表
- **基座 Skill 管流程，模板 Skill 管风格** — PPT 默认基座 Skill 负责需求采集、AI 反问、需求摘要确认、页纲进入门槛；各 PPT 模版 Skill 负责内容结构、风格和输出规范

### 1.3 非范围（明确不做）

| 项 | 原因 |
|----|------|
| PPT 模板选择页 | 默认加载 PPT 基座 Skill，再由其调用或切换到具体 PPT 模版 Skill |
| 步骤向导（主题→大纲→生成→预览） | 遵循对话式交互，不走分步表单 |
| 前端写死整张需求表单 | 需求问题由默认基座 Skill 根据用户输入动态生成，前端只负责渲染 |
| 我的 PPT 管理列表 | 工作区文件即 PPT |
| 从文稿生成（独立页面） | 在对话中通过自然语言表达需求即可 |
| 路演模板（独立页面） | 只是不同的 PPT Skill |
| 快速/深度模式切换 | PPT 是深度产出任务，不需要两档模式 |

---

## 2. 用户流程

```
点击「PPT」→ 新建 PPT 会话，加载默认 PPT 基座 Skill
              → 用户描述需求（"帮我做一个关于…的PPT"）
              → 默认基座 Skill 判断信息是否充足
              → 若不足，则返回结构化问题给前端渲染
              → 用户填写回答并提交
              → 基座 Skill 生成需求摘要
              → 首轮信息充分时等待确认；表单补充后的连续流直接进入页纲与交付
              → 基座 Skill 进入页纲阶段，并调用具体 PPT 模版 Skill
              → Agent 执行 PPT 生成
              → 产出 .pptx / .html 交付物
              → 用户预览 / 追加修改
              → 满意 → 导出 PPTX
```

与普通对话的关键差异：PPT 会先经过默认基座 Skill 的要求收集与确认阶段。

---

## 3. 架构变更

### 3.1 模块注册

```
// 当前（简化前）
ppt → 独立 PptModuleContent + 子路由

// 目标
ppt {
  component: ChatModuleContent,                       // 复用聊天组件
  defaultSkill: 'skill-ppt-base',                    // 默认基座 Skill，负责流程
}
```

### 3.2 路由简化

**移除的路径：**

| 路径 | 说明 |
|------|------|
| `/ppt/new` | 新建 PPT 表单页 |
| `/ppt/from-writing` | 从文稿生成 |
| `/ppt/templates` | 路演模板 |
| `/ppt/mine` | 我的 PPT |

**目标路径：**

| 路径 | 说明 |
|------|------|
| `/ppt` | 重定向到 `/ppt/new` |
| `/ppt/new` | 渲染聊天组件，预置 `skill-ppt-base` |

### 3.3 导航简化

**当前（移除）：**
```
PPT
├── 新建 PPT
├── 从文稿生成
├── 路演模板
└── 我的 PPT
```

**目标：**
```
PPT  ← 一级导航仅一项，点击直接进入 PPT 对话
```

---

## 4. Skill 设计

### 4.1 模式

PPT Skill 分两层：

- 默认基座 Skill：负责流程控制
- 具体 PPT 模版 Skill：负责风格、结构、输出方向

具体来说：

- `skill-ppt-base` 负责需求采集、AI to UI 问题返回、需求摘要确认、页纲进入门槛
- 各模板 Skill 负责场景化内容结构、风格偏好、输出规范

各具体 PPT 模版 Skill 仍在 `chat-catalog.json` 中平级罗列，供基座 Skill 选择或供用户切换。

### 4.2 默认 Skill

**`skill-ppt-base`** 作为默认基座 Skill，原因：

- 需求采集与 AI 反问是 PPT 模块通用逻辑
- 不应绑死在某一个风格模版上
- 能保证所有 PPT 模版遵循统一的“先确认需求，再进入生成”流程

### 4.3 默认基座 Skill 职责

建议 `skill-ppt-base` 承担以下职责：

- 接收用户初始需求
- 判断信息是否足够开始生成 PPT
- 信息不足时输出结构化问题
- 接收用户回答并汇总需求摘要
- 请求用户确认摘要
- 进入页纲阶段
- 将确认后的需求交给具体 PPT 模版 Skill 执行

### 4.4 默认模版 Skill

**`skill-ppt-pitch-deck`** 仍作为默认风格模版，原因：

- 视觉干净通用，适合多数场景
- 已有完整 `SKILL.md` + `references/`
- 用户可在对话中切换其他 PPT 模版 Skill

### 4.5 chat-catalog 中的 PPT Skill 列表

项目目前已储备以下 PPT Skill，全部并列注册在 `chat-catalog.json`：

| skill slug | 场景 |
|-----------|------|
| `skill-ppt-pitch-deck` | 路演 / 默认 |
| `skill-ppt-weekly-report` | 周报 |
| `skill-ppt-quarterly-review` | 季度回顾 |
| `skill-ppt-tech-sharing` | 技术分享 |
| `skill-ppt-knowledge-arch` | 知识架构 |
| `skill-ppt-fintech-swiss` | 金融瑞士风格 |
| `skill-ppt-blue-professional` | 蓝调专业 |
| `skill-ppt-editorial-burgundy` | 酒红编辑 |
| `skill-ppt-guizang-editorial` | 硅藏编辑 |
| `skill-ppt-swiss-international` | 瑞士国际 |
| `skill-ppt-html-studio` | HTML 自由编辑 |
| `skill-ppt-open-canvas` | 自由画布 |
| `skill-ppt-deck` | HTML 幻灯片 |
| `skill-ppt-slides` | Markdown→幻灯片 |
| `skill-ppt-pptx` | PPTX 原生 |
| `skill-ppt-pptx-generator` | PPTX 生成器 |
| `skill-ppt-fidelity-audit` | 保真度审计 |

### 4.6 AI to UI 需求采集协议

`skill-ppt-base` 不直接要求前端写死一张表单，而是返回结构化问题，由前端动态渲染。

补充原则：

- 问题内容、问题数量、字段类型、选项内容由 AI 根据当前用户需求动态决定。
- 前端只实现通用的 `ppt_requirements` 表单渲染协议，不拥有业务问题定义权。
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

建议前端对应渲染为 `ppt_requirements` 类型的 `part`。

### 4.7 切换方式

用户可在对话中通过执行源/Skill 选择器切换 PPT Skill，不额外增加 UI 复杂度。写作/PPT 模块不展示快速/深度模式切换。

---

## 5. UI 规格

### 5.1 入口

- 点击「PPT」导航 → 新建会话，加载 `skill-ppt-base`

### 5.2 PPT 对话页

与聊天页面使用**同一组件**，差异点：

| 差异项 | 聊天 | PPT |
|--------|------|-----|
| 默认流程 Skill | `skill-qa` | `skill-ppt-base` |
| 问答策略 | 自动判断 | 无 |
| 交付物类型 | 多样 | 主要为 `.pptx` / `.html` |
| 首轮流程 | 普通问答 | 先要求收集，再页纲，再生成 |
| 交付物操作 | 无 | 增加「打开 PPTX / 在文件夹中显示 / 另存副本」入口 |

### 5.3 PPT 预览与本地交付物操作

在交付物卡片中增加操作项：

```
┌────────────────────────────────────┐
│ 📊 原油市场分析-20260531.pptx       │
│                                    │
│ [预览] [打开 PPTX] [在文件夹中显示] [复制路径] │
└────────────────────────────────────┘
```

- **预览：** 对于 `skill-ppt-html-studio` 产出的 HTML 幻灯片，直接在工作区打开预览；对于 `.pptx`，通过 BFF 转换为 PDF 预览（Desktop Beta 可选）
- **打开 / 定位 PPTX：** Desktop 主路径下 `.pptx` 已在本地工作区中，用户应直接打开、在文件夹中显示，或另存 / 导出副本；浏览器下载仅作为 Web Sandbox 或兼容入口

---

## 6. 数据流

```
用户点击「打开 PPTX」或「在文件夹中显示」
  → Web: 根据工作区文件路径调用打开 / 定位能力
  → Desktop: 通过系统默认应用打开，或在 Finder/资源管理器中显示
  → Web: 保持工作区文件树与交付物卡片状态一致
```

---

## 7. 验收标准

> 状态更新（2026-06-24）：以下状态以当前仓库代码和真实 smoke 为准。已完成 `pnpm qa:writing-ppt-ai-ui`、首轮 F4/F5/F6 与连续流 T5 验收；真实 `.html` / `.pptx` 落盘已验证。文件预览、本地打开、定位与另存 / 导出副本体验仍需完整 UI 手测。

### P0（`0.1.0-alpha` 必须）

| # | 项 | 验证 | 状态 |
|---|-----|------|------|
| P1 | 点击「PPT」进入对话界面，非表单页 | 目测 | 已完成：`/ppt/new` 渲染 `ChatHome surfaceModuleId="ppt"` |
| P2 | 新建会话默认加载 `skill-ppt-base` | `run.started` 元数据 | ✅ 已完成并已验证：`MODULE_CHAT_SURFACES.ppt.defaultProcessSkill = skill-ppt-base` |
| P3 | 信息不足时，基座 Skill 返回结构化问题 | 前端出现问题卡 | ✅ 已完成并已验证：F5 / T5 通过 |
| P4 | 用户提交回答后，生成需求摘要并可确认 | 时间线可见摘要卡 | ✅ 已完成并已验证：F4 / T5 通过 |
| P5 | 确认后进入页纲与生成流程 | 时间线可见页纲卡 | ✅ 已完成并已验证：F6 / T5 通过；表单补充后的连续流会继续交付，不再二次卡在摘要 / 页纲确认 |
| P6 | Agent 产出 `.pptx`/`.html` 文件到工作区 | 工作区可见 | ✅ 已完成并已验证：真实 `.html` / `.pptx` 落盘已确认 |
| P7 | 交付物卡片或工作区工具栏可打开 / 定位 PPTX | `.pptx` 可从本地工作区打开、在文件夹中显示，必要时另存 / 导出副本 | 代码已有部分能力，待验收：本轮未做完整本地打开 / 定位 / 另存手测；`POST /api/ppt/download` 仅作为 Web Sandbox 或兼容入口 |
| P8 | PPT 会话出现在历史侧栏中 | 侧栏可见 PPT 历史 | 代码已完成，待验收：本轮未做 UI 手测 |

### P1（体验优化）

| # | 项 | 说明 | 状态 |
|---|-----|------|------|
| P7 | HTML 幻灯片在工作区可预览 | HTML 渲染预览 | 代码已完成，待验收：`FileViewer` 支持 HTML Render/Code 与浏览器打开 |
| P8 | 多轮迭代修改 | 追加指令后重新生成 | 代码已完成，待验收：共享会话链路支持追加消息；真实 PPT 迭代未验收 |
| P9 | 深色/浅色主题切换 | Skill 参数控制 | 未完成：当前未看到 PPT 模块 UI 中稳定暴露主题参数控制 |

---

## 8. 实施任务

| # | 任务 | 状态 |
|---|------|------|
| 1 | 简化导航：移除 PPT 子菜单 | 已完成：`navigation.ts` PPT 仅保留一级「PPT」入口 |
| 2 | 简化路由：移除 `/ppt/from-writing` 等子路由 | 已完成：当前 `web/src/app/(main)/ppt` 仅有 `/ppt`、`/ppt/new`、`/ppt/[id]` |
| 3 | 模块注册表：PPT 指向聊天组件 | 代码已完成，待验收：路由层已复用 `ChatHome/ChatThread`；注册表仍保留完整 PPT skill catalog |
| 4 | 新增 `skill-ppt-base`，编写 AI to UI 需求采集逻辑 | 已完成：`skills/skill-ppt-base/SKILL.md` 与 references 已存在 |
| 5 | 编写或对接 `skill-ppt-pitch-deck/SKILL.md` | 已完成：`skills/skill-ppt-pitch-deck/SKILL.md` 已存在 |
| 6 | 前端支持 `ppt_requirements` / `ppt_requirement_summary` / `ppt_outline` | 代码已完成，待验收：`PartRenderer` 与相关卡片已支持 |
| 7 | 确保 chat-catalog.json 已注册所有 PPT Skill | 代码已完成，待验收：PPT skills 已在目录和 catalog 中存在；未在本轮跑 `pnpm skills:verify` |
| 8 | 交付物卡片增加 PPTX 本地操作入口 | 已完成部分：`DeliverablesCard` 对 PPT/HTML 展示交付物动作；后续文案需统一为打开 / 定位 / 另存 |
| 9 | 兼容 Web 的文件流接口 | 已完成：`POST /api/ppt/download` 已实现；Desktop 主路径不以下载为主 |
| 10 | 验证 P1-P8 验收项 | 部分完成：P1-P6 已有真实 smoke / 落盘验收；P7-P8 仍待 UI / 本地工作区交付物手测 |
| 11 | 工作区统一本地操作入口 | 未完成：PPT 打开 / 定位 / 另存仍未完全收敛到 `FileViewer` 统一工具栏 |

---

## 9. 与写作模块的差异对照

| 维度 | 写作 | PPT |
|------|------|-----|
| 默认流程 Skill | `skill-writing-base` | `skill-ppt-base` |
| 默认风格模版 | `skill-writing-general` | `skill-ppt-pitch-deck` |
| 产出格式 | `.md` | `.pptx` / `.html` |
| 后处理 | MD → DOCX（Pandoc 生成到工作区） | 原文件已在工作区，直接打开 / 定位 / 另存 |
| 预览 | MD 预览（工作区已有） | HTML 预览 / PDF 预览（Desktop Beta） |
| Skill 模式 | 默认 `skill-writing-general`，可按需新增 | 基座 Skill 管流程，模板 Skill 管风格 |

---

## 10. 设计决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| PPT UI 复用聊天组件 | 是 | 与写作模式一致 |
| 移除模板选择页 | 是 | 用户无需在生成前选模板 |
| 移除 PPT 管理列表 | 是 | 工作区文件即 PPT |
| 17+ 现有 Skill 全部平级 | 是 | Skill 即模板，无"通用/专用"层级 |
| 移除快速/深度模式 | 是 | PPT 是深度产出任务，不需要两档模式 |
| 保留模型/Skill 选择器 | 是 | 用户需能切换模型或 PPT Skill |
| 保留 PPTX 原文件操作（不转换） | `0.1.0-alpha` | 原文件已在工作区，打开 / 定位即可满足 Desktop 基本需求；下载仅用于 Web Sandbox 或兼容入口 |

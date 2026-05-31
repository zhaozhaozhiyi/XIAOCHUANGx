# PPT 模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-05-31 |
| 状态 | 草案 |
| 关联 | PRD-小窗 §F-PPT；[chat-core-architecture.md](./chat-core-architecture.md)；[writing-module-prd.v2.md](./writing-module-prd.v2.md) |

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
- **Skill 即模板，全部平级** — 所有 PPT Skill 在 `chat-catalog.json` 中平等罗列，无"通用/专用"层级之分。默认 Skill 只是其中一个，用户可在对话中自由切换

### 1.3 非范围（明确不做）

| 项 | 原因 |
|----|------|
| PPT 模板选择页 | 默认加载 `skill-ppt-pitch-deck`，用户可在对话中切换其他 PPT Skill |
| 步骤向导（主题→大纲→生成→预览） | 遵循对话式交互，不走分步表单 |
| 演示主题、页数建议等表单字段 | 在对话中由 Agent 引导用户提供 |
| 我的 PPT 管理列表 | 工作区文件即 PPT |
| 从文稿生成（独立页面） | 在对话中通过自然语言表达需求即可 |
| 路演模板（独立页面） | 只是不同的 PPT Skill |
| 快速/深度模式切换 | PPT 是深度产出任务，不需要两档模式 |

---

## 2. 用户流程

```
点击「PPT」→ 新建 PPT 会话，加载默认 PPT Skill（skill-ppt-pitch-deck）
              → 用户描述需求（"帮我做一个关于…的PPT"）
              → 用户可在对话中切换其他 PPT Skill（如周报模板、数据报告等）
              → Agent 执行 PPT 生成
              → 产出 .pptx / .html 交付物
              → 用户预览 / 追加修改
              → 满意 → 导出 PPTX
```

与普通对话的唯一差异：加载的 Skill 不同。

---

## 3. 架构变更

### 3.1 模块注册

```
// 当前（简化前）
ppt → 独立 PptModuleContent + 子路由

// 目标
ppt {
  component: ChatModuleContent,                       // 复用聊天组件
  defaultSkill: 'skill-ppt-pitch-deck',                // 默认 Skill，可在对话中切换
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
| `/ppt/new` | 渲染聊天组件，预置 `skill-ppt-pitch-deck` |

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

与 opendesign 一致：**所有 PPT Skill 在 `chat-catalog.json` 中平级罗列**，无"通用/专用"层级，无"编排/渲染"分工。每个 Skill 独立完整：

- 有自己的 `SKILL.md`（含角色定义、产出规范、制作流程）
- 有自己的 `references/`（含示例、checklist）
- 直接面向 Agent，而非被其他 Skill 编排

### 4.2 默认 Skill

**`skill-ppt-pitch-deck`**（路演风格）作为默认，原因：

- 视觉干净通用，适合多数场景
- 已有完整 `SKILL.md` + `references/`
- 用户可在对话中随时切换其他 PPT Skill

### 4.3 chat-catalog 中的 PPT Skill 列表

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

### 4.4 切换方式

用户可在对话中通过执行源/Skill 选择器切换 PPT Skill，不额外增加 UI 复杂度。写作/PPT 模块不展示快速/深度模式切换。

---

## 5. UI 规格

### 5.1 入口

- 点击「PPT」导航 → 新建会话，加载 `skill-ppt-pitch-deck`

### 5.2 PPT 对话页

与聊天页面使用**同一组件**，差异点：

| 差异项 | 聊天 | PPT |
|--------|------|-----|
| 默认 Skill | `skill-qa-fast` | `skill-ppt-pitch-deck` |
| 模式切换 | 快速/深度 | 无 |
| 交付物类型 | 多样 | 主要为 `.pptx` / `.html` |
| 导出 | 无 | 增加「下载 PPTX」按钮 |

### 5.3 PPT 预览与下载

在交付物卡片中增加操作项：

```
┌────────────────────────────────────┐
│ 📊 原油市场分析-20260531.pptx       │
│                                    │
│ [预览] [下载 PPTX] [复制路径]       │
└────────────────────────────────────┘
```

- **预览：** 对于 `skill-ppt-html-studio` 产出的 HTML 幻灯片，直接在工作区打开预览；对于 `.pptx`，通过 BFF 转换为 PDF 预览（V1.1 可选）
- **下载 PPTX：** 直接下载 `.pptx` 文件流

---

## 6. 数据流

```
用户点击「下载 PPTX」
  → Web: POST /api/ppt/download { filePath }
  → BFF: 读取工作区 .pptx 文件
  → BFF: 返回文件流
  → Web: 触发浏览器下载
```

---

## 7. 验收标准

### P0（MVP 必须）

| # | 项 | 验证 |
|---|-----|------|
| P1 | 点击「PPT」进入对话界面，非表单页 | 目测 |
| P2 | 新建会话默认加载 `skill-ppt-pitch-deck` | `run.started` 元数据 |
| P3 | PPT 对话过程与聊天一致（流式/parts/工具） | 同聊天 D1-D4 |
| P4 | Agent 产出 `.pptx`/`.html` 文件到工作区 | 工作区可见 |
| P5 | 交付物卡片可触发 PPTX 下载 | 下载 .pptx 文件 |
| P6 | PPT 会话出现在历史侧栏中 | 侧栏可见 PPT 历史 |

### P1（体验优化）

| # | 项 | 说明 |
|---|-----|------|
| P7 | HTML 幻灯片在工作区可预览 | HTML 渲染预览 |
| P8 | 多轮迭代修改 | 追加指令后重新生成 |
| P9 | 深色/浅色主题切换 | Skill 参数控制 |

---

## 8. 实施任务

| # | 任务 | 预估 | 依赖 |
|---|------|------|------|
| 1 | 简化导航：移除 PPT 子菜单 | 0.5d | - |
| 2 | 简化路由：移除 `/ppt/from-writing` 等子路由 | 0.5d | #1 |
| 3 | 模块注册表：PPT 指向聊天组件 | 1d | #2 |
| 4 | 编写 `skill-ppt-pitch-deck/SKILL.md` | 0.5d | - |
| 5 | 确保 chat-catalog.json 已注册所有 PPT Skill | 0.5d | #4 |
| 6 | 交付物卡片增加「下载 PPTX」按钮 | 0.5d | - |
| 7 | BFF 文件下载接口 | 0.5d | - |
| 8 | 验证 P1-P6 验收项 | 0.5d | #1-7 |

**总计：** 4d

---

## 9. 与写作模块的差异对照

| 维度 | 写作 | PPT |
|------|------|-----|
| 默认 Skill | `skill-writing-general` | `skill-ppt-pitch-deck` |
| 产出格式 | `.md` | `.pptx` / `.html` |
| 后处理 | MD → DOCX（Pandoc 转换） | 直接下载原文件 |
| 预览 | MD 预览（工作区已有） | HTML 预览 / PDF 预览(V1.1) |
| Skill 模式 | 默认 `skill-writing-general`，可按需新增 | 17+ 个平级 Skill 已就绪 |

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
| 保留 PPTX 下载（不转换） | MVP | 原文件下载已满足基本需求 |

# Agent 对话输出体验补充需求

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-05-21 |
| 状态 | **待实施（P1）** |
| 关联 | [chat-message-parts.md](./chat-message-parts.md)、[chat-execution-roadmap.md](./chat-execution-roadmap.md)、[agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md)、PRD **F-QA-007/010** |
| 参考竞品 | Open Design（交错流 + FileOps/成品区）、Cursor（Explored/Read/Grepped + Thought for Xs） |
| 原则 | **逻辑对齐竞品，UI 沿用小窗设计 token**（`bubble-assistant`、`--surface`、`--border`、`ToolBatchCard` 等） |

---

## 0. 背景与目标

在已完成 **时间序交错渲染**（`streamSeq` + `interleavedTimelineParts`）、**Pinned Todo**、**钉底滚动**（`useChatScrollPin`）的基础上，补齐三类高感知能力：

1. **思考耗时**：让用户感知 Agent 在步骤之间的思考/等待间隔（对齐 Cursor「Thought for Xs」）。
2. **探索摘要**：将零散工具调用收敛为可读的一行摘要 + 可展开明细（对齐 Open Design / Cursor「Explored / Read / Grepped」）。
3. **成品列表卡**：一轮 Run 的多文件交付物聚合展示，首行主交付 + 列表打开（对齐 Open Design 成品区截图）。

三者均不改变「结论与过程按发生顺序交错」的主线，仅增强**过程块的语义**与**交付物区**。

---

## 1. 思考耗时

### 1.1 用户价值

- 深度思考 / 深度研究模式下，用户能区分「Agent 在算」与「已经卡住」。
- 与 `turn_meta`（整轮总耗时）互补：`turn_meta` 答「这一轮一共多久」；思考耗时答「这一步之前想了多久」。

### 1.2 展示形态（JLC 风格）

| 场景 | UI | 样式约束 |
|------|-----|----------|
| 两段过程块之间插入 | 单行轻量文案，如 `思考 33s` | `text-xs text-[var(--fg-tertiary)]`，无卡片边框 |
| 流式进行中、尚无间隔 | 可选 `思考中…` 或省略 | 与 `LoadingBubble` 不重复；仅在有 reasoning 块流式时显示 |
| 极短间隔 (&lt; 3s) | `Thought briefly` 等价文案：`思考片刻` | 避免刷屏 |

**禁止：** 单独大卡片、与正文同字号抢焦点（竞品 Cursor 亦为小字灰字）。

### 1.3 插入位置（时间线）

```text
[turn_meta 已处理 …]          ← 保留现有 TurnMetaBar
阶段 chip
思考 12s                        ← 新增：上一事件结束 → 本事件开始 的间隔
tool_batch「已探索 4 个文件」
Read policy_brief.md · L1–80
思考 5s
reasoning 块（可折叠）
正文 summary 流式…
```

- 插入在 `interleavedTimelineParts` 排序之后、渲染之前，**不写入持久化 `parts[]` 亦可**（推荐 `kind: "thinking_gap"` 虚拟块或渲染层计算，见 §1.5）。

### 1.4 计时规则

| 输入 | 说明 |
|------|------|
| `runStartedAt` | 本轮开始时间（已有） |
| 每个 part 的 `completedAt` | 块完成时刻；流式块用「上一完成 → 下一开始」 |
| 首块之前 | 从 `runStartedAt` 到第一个可渲染 part 的间隔 → 可选显示「准备中 2s」 |
| 末块之后 | 到最后一个 activity 块完成 → 首个 `text` delta：可显示「思考 Ns」再出正文 |

**公式（渲染层）：**

```text
gapMs = nextPart.firstSeenAt - prevPart.completedAt
若 gapMs >= 3000ms → 在 nextPart 前渲染 ThinkingGapRow(gapMs)
```

流式时 `prevPart` 未完成则不计 gap。

### 1.5 数据与协议

**方案 A（推荐，P1）：** 渲染层计算，不扩展 SSE。

- `web/src/lib/chat-thinking-gap.ts`：根据 `parts[]` + `runStartedAt` 生成 `{ afterPartId, labelMs }[]`。
- `AssistantMessageBubble` 在 `timeline.map` 时插入 `ThinkingGapRow`。

**方案 B（P2）：** 显式 part

```ts
type ThinkingGapPart = ChatPartBase & {
  kind: "thinking_gap";
  zone: "activity";
  durationMs: number;
  label?: string; // 默认「思考」
};
```

- Companion 在 `tool.progress` 静默超过阈值时发 `part.append`（可选）。

**与 `turn_meta` 关系：**

| 组件 | 粒度 | 文案示例 |
|------|------|----------|
| `turn_meta` | 整轮 | `已处理 1m 42s` |
| `thinking_gap` | 步间 | `思考 33s` |
| `reasoning` 块标题 | 推理内容 | `推理过程`（已有） |

### 1.6 验收标准

- [ ] 深度模式下，工具批与 reasoning 之间可见 ≥3s 的「思考 Ns」行（mock 可调延迟验证）。
- [ ] 快速模式默认不插入 gap 行（或阈值提高到 8s）。
- [ ] 不影响 `streamSeq` 顺序；gap 行不参与排序键。
- [ ] 样式符合 JLC token，无新增重型边框组件。

### 1.7 实现触点（建议）

| 文件 | 改动 |
|------|------|
| `web/src/lib/chat-thinking-gap.ts` | 新建，纯函数 |
| `web/src/components/chat/parts/ThinkingGapRow.tsx` | 新建 |
| `web/src/components/chat/parts/AssistantMessageBubble.tsx` | 交错插入 |
| `web/docs/chat-execution-roadmap.md` | 登记 **S3.5a** |

---

## 2. 探索摘要

### 2.1 用户价值

- 将连续 `grep` / `Read` / `list_dir` / `choice_query` 收敛为**一行人话摘要**，避免裸工具名刷屏（对齐 Open Design `tool-group` pill、Cursor「Explored 6 files, 4 searches」）。
- 默认折叠明细，保持交错时间线紧凑；流式中可自动展开当前批。

### 2.2 展示形态（JLC 风格）

**摘要行（`tool_batch` 头部）：**

```text
▸  已探索 4 个文件 · 搜索 2 次 · 读取 1 个文件     [进行中]
```

| 元素 | 规范 |
|------|------|
| 图标 | 沿用 `ToolBatchCard` 的 `FolderSearch` 或按族切换（读=文件、搜=放大镜） |
| 标题 | 由工具族聚合生成，**禁止**直接拼接原始 `tool` 字段名列表 |
| 默认展开 | `streaming === true` → 展开；`complete` → **折叠**（与 Open Design 一致，调整现有默认 `useState(streaming)`） |
| 明细行 | `text-xs`；Read 行：`Read {path} · L{start}–{end}`（有 lineRange 时） |

### 2.3 工具族与文案映射

与 [agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md) 对齐，族 → 中文计数单位：

| 族 key | 包含 tool（示例） | 摘要片段 |
|--------|-------------------|----------|
| `explore` | `list_dir`, `glob`, `ls` | `探索 {n} 个目录` |
| `read` | `read_file`, `Read`, `read` | `读取 {n} 个文件` |
| `search` | `grep`, `search`, `web_search`, `web_extract` | `搜索 {n} 次` |
| `query` | `choice_query`, `mcp` | `检索 {n} 次` |
| `command` | `Bash`, `bash`, `run_terminal` | `运行 {n} 条命令` |
| `write` | `write_file`, `Write`, `edit_file` | `写入 {n} 个文件` |

**标题生成算法（替换/增强 `batchTitle`）：**

1. 对 `tool_batch.items` 按族计数。
2. 按固定优先级拼接：`读取` → `搜索` → `检索` → `探索` → `运行` → `写入`。
3. 仅 1 项且为 Read 时：`读取 context.md`（带 `message` 截断路径）。
4. 混合时：`已探索 4 个文件 · 搜索 2 次`（「已」前缀可选）。

### 2.4 与单条 `tool` / `file_read` 的关系

| 事件 | 展示策略 |
|------|----------|
| 连续同族 ≥2 | 合并为 `tool_batch`（已有 `compactToolParts`） |
| 单次 Read 且带路径 | 优先 `file_read` 行（可点击深链），**不**再进 batch |
| 单次 grep | 可单独 `tool` 或并入 batch（P1 统一并入 batch） |
| `file_read` / `file_edit` | 保持独立行（F-QA-010），参与族计数时也出现在 batch 标题统计 |

**过程块视觉降权（P1）：**

- `tool_batch` / 单行 `tool`：正文区保持 15px；过程区统一 `text-sm` → 明细 `text-xs`、`text-[var(--fg-tertiary)]`。
- 与交错正文对比符合截图「灰字过程 + 黑字结论」。

### 2.5 流式与 reducer

| 阶段 | 行为 |
|------|------|
| `tool.progress` running | 更新 batch 内 item 或追加；`streaming: true`；标题实时重算 |
| `tool.progress` success | 更新 item 状态；不新增 batch |
| `compactToolParts` | 合并时 `streamSeq = min(子项 seq)`（已实现） |
| 完成 | `streaming: false`；折叠 batch |

**扩展 SSE（可选 P2）：** `part.patch` 更新 `tool_batch.title`，避免整段替换。

### 2.6 验收标准

- [ ] 深度研究 mock 流中，摘要行出现「读取/搜索/检索」组合，而非 `grep` + `choice_query` 英文堆叠。
- [ ] Read 带路径时，明细或 `file_read` 行展示 `path` + 行号（若有）。
- [ ] 完成后 batch 默认折叠；流式中默认展开。
- [ ] 与 `interleavedTimelineParts` 顺序一致，batch 出现在对应时间位置。

### 2.7 实现触点（建议）

| 文件 | 改动 |
|------|------|
| `web/src/lib/chat-parts-normalize.ts` | `batchTitle` → `buildExploreSummaryTitle(items)` |
| `web/src/lib/tool-family.ts` | 新建，族归类 |
| `web/src/components/chat/parts/ToolBatchCard.tsx` | 默认折叠、样式降权 |
| `web/src/components/chat/parts/FileDiffRow.tsx` | 行号展示 |
| `web/docs/agent-cli-activity-mapping.md` | 补充族映射表 |

---

## 3. 成品列表卡（本轮交付物）

### 3.1 用户价值

- 一轮研究/写作 Run 常产出 **1 个主文件 + 多个附件**（研报 md、图表 png、pptx）。
- 用户需**先看到主交付链接**，再浏览附属文件；对齐截图「更新后的成品文件还是这个」+ 下方多行列表。

### 3.2 信息架构

```text
（时间线中，通常位于本轮 assistant 的**末尾**，仍在交错序内）

┌─ 成品 · 本轮交付 ─────────────────────────────┐
│  主交付：research_summary.md          [打开] │
├──────────────────────────────────────────────┤
│  [图] slide-01.png    图像 · PNG      [打开] │
│  [图] slide-02.png    图像 · PNG      [打开] │
│  [PPT] 汇报.pptx      幻灯片 · PPTX   [打开] │
└──────────────────────────────────────────────┘

上文可有正文：「更新后的成品文件如下：」
```

- **不**替代 Summary 正文；卡片是**可行动文件**的聚合，正文负责叙述与结论。
- 单文件仍可继续用 `artifact` 行；**≥2 个产出**或显式标记 `primary` 时升级为列表卡。

### 3.3 数据模型

**新增 kind（`@jlc/contracts`）：**

```ts
type DeliverableItem = {
  path: string;           // 工作区相对路径
  label?: string;         // 展示名，默认 basename
  mime?: string;          // 用于类型文案
  kind?: "primary" | "attachment";
  thumbnailUrl?: string;  // P2：缩略图
};

type DeliverablesPart = ChatPartBase & {
  kind: "deliverables";
  zone: "summary";
  /** 卡片上方一句引导，可选 */
  headline?: string;
  /** 主交付 path，须在 items 中存在 */
  primaryPath?: string;
  items: DeliverableItem[];
};
```

**与现有 `artifact` 关系：**

| 场景 | 使用 |
|------|------|
| 正文内单次提及 | `artifact` 或 `InlinePathText` |
| Run 结束批量产出 | `deliverables` |
| 迁移 | 连续多个 `artifact` part → `reduce` 合并为一条 `deliverables`（可选） |

### 3.4 交互规范

| 操作 | 行为 |
|------|------|
| 点击行 / [打开] | `openFileAt({ relativePath, line? })`（F-QA-010） |
| 主交付行 | 字体 `font-medium`；列表顶部固定，背景 `var(--accent-muted)/40` 可选 |
| 类型文案 | `图像 · PNG`、`幻灯片 · PPTX`、`文档 · Markdown`（由 mime/扩展名推断） |
| P2 [打开 ▾] | 下拉：工作区打开 / 复制路径 / 导出（按需） |

**样式（JLC）：**

- 外框：`rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]`
- 与 `TodoBlock` / `ToolBatchCard` 同级，**不**使用竞品截图中的重阴影大圆角（除非与全局 card 统一）。

### 3.5 产生时机

| 来源 | 说明 |
|------|------|
| **Mock / simulate** | `run.finished` 前 `part.append` 下发 `deliverables`（研究模式 seed） |
| **Companion CLI** | 解析 CLI 产出列表 / Agent Kit `runs/<runId>/` 索引；或扫描 workspace 新增文件 diff |
| **Hermes** | P2：结构化 JSON 附件 |

**Reducer：**

- `part.append` → `reduceAppendPart`（已有）。
- `run.finished` 时若仅有多个 `artifact`，可选合并为 `deliverables`（`finalizeDeliverables(parts)`）。

### 3.6 与「探索摘要」边界

| 类型 | 含义 | 组件 |
|------|------|------|
| `file_read` / `file_edit` | Agent **过程中**读改的文件 | `FileDiffRow`（activity） |
| `deliverables` | Agent **交付给用户**的成品 | `DeliverablesCard`（summary） |

同一 path 可既出现在探索摘要（读）又出现在成品卡（写后交付），时间线允许两次出现。

### 3.7 验收标准

- [ ] 研究模式 mock：正文结束后出现成品卡，≥2 行附件 + 1 主交付。
- [ ] 点击任一行在工作区打开对应文件。
- [ ] 卡片位于该轮时间线末尾（`streamSeq` 最大），而非置顶。
- [ ] 单 artifact 场景行为不变（向后兼容）。

### 3.8 实现触点（建议）

| 文件 | 改动 |
|------|------|
| `packages/contracts/src/chat.ts` | 新增 `deliverables` kind |
| `web/src/components/chat/parts/DeliverablesCard.tsx` | 新建 |
| `web/src/components/chat/parts/PartRenderer.tsx` | 分支 |
| `web/src/lib/companion/mock.ts` / `simulated-activity` | mock 数据 |
| `web/docs/chat-execution-roadmap.md` | **S3.5b/c** |

---

## 4. 实施分期与依赖

| ID | 能力 | 依赖 | 预估 |
|----|------|------|------|
| **S3.5a** | 思考耗时 | `streamSeq`、交错渲染 | 0.5d |
| **S3.5b** | 探索摘要文案 + 折叠策略 | `tool_batch`、`tool-family` | 1d |
| **S3.5c** | 成品列表卡 | `deliverables` 契约、`openFileAt` | 1.5d |

**建议顺序：** S3.5b → S3.5a → S3.5c（探索摘要改动面最小；成品卡需契约变更）。

---

## 5. 竞品对照（摘录）

| 能力 | Open Design | Cursor | 小窗目标 |
|------|-------------|--------|------------|
| 思考耗时 | Footer Working + 耗时 | Thought for Xs | 步间 `思考 Ns` + `turn_meta` |
| 探索摘要 | tool-group pill + 折叠 | Explored / Read / Grepped | `tool_batch` 中文摘要 + 明细 |
| 成品列表 | 链接 + 文件行 | 较少聚合 | `deliverables` 卡 + 主交付 |

---

## 6. 参考截图（产品输入）

- 交错正文与探索块：Open Design 对话流（图 1）
- 成品链接 + 列表卡：多文件交付截图（图 3）
- Explored / Read / Thought for：Cursor Agent  trace（图 5）

截图存放：对话记录附件；实现以本文为准，不以截图像素级复刻。

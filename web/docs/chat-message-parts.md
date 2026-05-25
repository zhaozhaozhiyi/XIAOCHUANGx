# 对话消息分块（`parts[]`）技术方案

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.1 |
| 创建日期 | 2026-05-21 |
| 状态 | **P0/P1 已落地**：时间序交错（`streamSeq`）、Pinned Todo、钉底滚动、节奏化块；**P1+ 待做**见 [chat-agent-output-ux.md](./chat-agent-output-ux.md) |
| 关联 | PRD §6.1 **F-QA-007/009/010**、[chat-agent-output-ux.md](./chat-agent-output-ux.md)、[companion-api.md](./companion-api.md)、[agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md)、[技术方案.md](../../技术方案.md) |
| 类型契约 | `packages/contracts/src/chat.ts`（`@jlc/contracts`） |
| 当前实现 | `web/src/lib/chat.ts` 仅 `content: string`；本方案为升级路径 |

---

## 1. 目标

在**对话区**内实现与 Cursor / Codex 一致的可观测体验：

1. **过程可见**：工具、命令、读改文件、阶段进度、推理链等以分类型 UI 展示。
2. **时间序交错**：正文与过程按 **SSE 到达顺序** 混排（`streamSeq`），禁止按 zone 把结论整体置顶、过程整体置底。
3. **过程可折叠（块级）**：`tool_batch`、推理块等**单块**默认折叠；无全局「执行过程」条（已移除）。
4. **协议统一**：Companion SSE、`runtime-core` 解析事件、Web reducer、持久化共用 `@jlc/contracts` 类型。
5. **体验增强（P1+）**：思考耗时、探索摘要、成品列表卡 — 详见 [chat-agent-output-ux.md](./chat-agent-output-ux.md)。

---

## 2. 会话与 Turn（PRD F-QA-009）

- **Session**：`sessionId`，含 **N 个 Turn**（多轮一问一答）。
- **Turn**：`userMessage` + `assistantMessage`（含 `parts[]`）。
- **滚动吸顶**：仅 **当前视口对应 Turn** 的 `user` 文案；滚到消息区**上沿**后 `sticky`；换 Turn 则切换吸顶条（**非**永远最新一问、**非**顶栏会话标题）。
- **本文件**主要定义 Turn 内 **assistant `parts[]`**；Turn 布局与吸顶由 `ChatTurnList`（待建）实现。

---

## 3. 信息架构（单 Turn 内 assistant 流）

**展示顺序（重要）：** 对话区内按 **`streamSeq` / `parts[]` 到达顺序** 自上而下渲染（阶段 → 工具/探索摘要 → 推理 → 正文 → 成品卡），与 Open Design / Cursor 交错流一致。

```
流式中（逐条出现，无全局折叠条）:
  turn_meta → 阶段 → tool_batch（探索摘要）→ file_read → 思考 12s → reasoning → 正文流式…

完成后:
  同上完整时间线；tool_batch 默认折叠；Todo 仅在 Composer 上 PinnedTodoBar
```

- **仍是一条** `ChatMessage` 气泡；Todo 从气泡时间线剔除，由 [PinnedTodoBar](../src/components/chat/PinnedTodoBar.tsx) 展示。
- `zone`（`summary` | `activity`）用于类型与统计，**不用于 DOM 重排**；渲染见 `interleavedTimelineParts()`。
- **思考耗时 / 探索摘要 / 成品列表卡** 产品细则见 [chat-agent-output-ux.md](./chat-agent-output-ux.md)。
- **可行动文件引用（F-QA-010）**：`file_read` / `file_edit` / `artifact` / `deliverables` 与 Summary 内联路径共用 `openFileAt`。

---

## 4. 数据模型

### 3.1 从 `content: string` 升级

```ts
// 目标形态（见 @jlc/contracts）
type AssistantMessage = {
  id: string;
  role: "assistant";
  status: "loading" | "streaming" | "complete" | "error" | "cancelled";
  parts: ChatPart[];
  activityCollapse?: ActivityCollapse;
  contentFallback?: string; // 旧数据 / 简易导出
  runId?: string;
};
```

用户消息短期可继续 `{ role: "user", content: string }`；assistant 以 `parts` 为准。

### 3.2 `ChatPart` 分区（zone）

| zone | 含义 | 默认展开 |
|------|------|----------|
| `summary` | 用户主要阅读内容 | 是 |
| `activity` | 过程、工具、推理 | 流式时是；完成后否 |

### 3.3 `ChatPart` 类型（kind）与 UI 组件

| kind | zone | UI 组件 | 优先级 |
|------|------|---------|--------|
| `summary` | summary | `SummaryMarkdown` | P0 |
| `text` | summary | 同 summary，流式合并 | P0 |
| `tool` | activity | `ToolCallRow`（图标+名称+状态） | P0 |
| `status` | activity | `PhaseChip` | P0 |
| `reasoning` | activity | `ReasoningBlock`（可折叠） | P1 |
| `command` | activity | `CommandBlock`（命令+exit+复制） | P1 |
| `file_read` | activity | `FileReadRow` → 工作区（**F-QA-010** `openFileAt`） | P1 |
| `file_edit` | activity | `FileEditRow`（+/- 行数）→ 工作区 diff Tab | P1 |
| `tool_batch` | activity | `ToolBatchCard`（**探索摘要**，见 output-ux §2） | P1 ✅ |
| `artifact` | summary | `ArtifactRow` → 打开 | P1 ✅ |
| `deliverables` | summary | `DeliverablesCard`（**成品列表卡**，见 output-ux §3） | P1 待做 |
| `thinking_gap` | activity | `ThinkingGapRow`（**思考耗时**，见 output-ux §1） | P1 待做 |
| `todo` | activity | 仅数据；UI 在 `PinnedTodoBar` | P1 ✅ |
| `error` | both | `InlineError` | P0 |
| `citation` | summary | `CitationCard`（works 溯源） | P1 |
| `turn_meta` | activity | `TurnMetaBar`（整轮耗时） | P1 ✅ |
| `json` | activity | `JsonTreePreview` | P2 |
| `image` | summary | `ImagePreview` | P2 |
| `chart` | summary | `ChartEmbed` | V1.1 |
| `research_map` | summary | `ResearchMap` | 深度档复杂任务 |

新增 kind 须：扩展 `chatPartKindSchema`、实现对应 React 组件、在 reducer 中注册映射。

---

## 5. 折叠策略（块级，2026-05 更新）

> 已移除全局「执行过程」折叠条；`activityCollapse` 字段保留兼容，默认 `expanded`。

| 块类型 | 流式中 | 完成后 |
|--------|--------|--------|
| `tool_batch` | 默认展开 | **默认折叠**（探索摘要，见 output-ux §2） |
| `reasoning` | 可展开 | 默认折叠 |
| `summary` / `text` | 始终可见 | 始终可见 |
| `PinnedTodo` | Composer 上常显 | 完成后可 dismiss |

---

## 6. SSE 与 Reducer

### 5.1 现有 Companion SSE（Phase 1 — 无需改 daemon）

| SSE event | payload | Reducer 行为 |
|-----------|---------|--------------|
| `run.started` | `{ runId, agentId, cwd }` | 新建 assistant 占位；`activityCollapse=expanded` |
| `message.delta` | `{ content }` | 追加/更新 `text` part（summary zone） |
| `tool.progress` | `{ tool, status, message }` | 追加或更新 `tool` part（activity） |
| `run.finished` | `{ runId }` | `text`→合并为 `summary`；`status=complete`；`activityCollapse=collapsed` |
| `run.error` | `{ code, message }` | 追加 `error` part；`status=error` |
| `run.cancelled` | `{ runId }` | `status=cancelled`；保留已有 parts |

实现位置建议：`web/src/lib/chat-parts-reducer.ts`（新建），由 `consumeChatSse` 回调驱动。

### 5.2 `runtime-core` 事件映射

`AgentStreamEvent`（`packages/runtime-core/src/types.ts`）→ `ChatPart`：

| AgentStreamEvent | ChatPart |
|------------------|----------|
| `text_delta` | 更新 `text`（同 `message.delta`） |
| `tool_progress` | `tool` |
| `status` | `status` |
| `error` | `error` |

Codex/Claude 解析器经 `@jlc/runtime-core` 发出 `tool_progress`（Bash、search、read_file 等）；映射表见 [agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md)。

### 5.3 扩展 SSE（Phase 2 — Companion 可选）

| SSE event | payload | 说明 |
|-----------|---------|------|
| `part.append` | `{ part: ChatPart }` | 直接下发强类型块，减少客户端猜测 |
| `part.patch` | `{ partId, patch }` | 流式更新单块（命令 exit、todo 勾选） |

Hermes Gateway / OpenAI 流无结构化工具时，Phase 1 仅 `message.delta` + 可选 `hermes.tool.progress`。

### 5.4 Reducer 伪代码

```ts
function reducePart(state: AssistantMessage, event: SseEvent): AssistantMessage {
  switch (event.type) {
    case "message.delta":
      return appendTextPart(state, event.delta);
    case "tool.progress":
      return upsertToolPart(state, event);
    case "run.finished":
      return finalizeSummary(state);
    // part.append / part.patch ...
  }
}
```

**合并规则：**

- 同一 `tool` + 相同 `tool` 名 + `status=running` → patch 同 id，不无限增行。
- `text` 流式：`streaming: true`；`run.finished` 设 `streaming: false`，`kind` 改为 `summary` 或保留 `text` 并标记完成。

---

## 7. 前端组件树（建议）

```
ChatMessageList
└── AssistantMessageBubble
    ├── SummaryZone
    │   └── parts.filter(zone===summary).map → PartRenderer
    └── ActivityZone
        ├── ActivitySummaryBar（折叠态可点击）
        └── parts.filter(zone===activity).map → PartRenderer
```

`PartRenderer`：`switch (part.kind)` → 各 `*Block` 组件。

**文件：** 建议目录 `web/src/components/chat/parts/`。

---

## 8. 模式与默认行为

| 对话模式 | Activity 默认 | reasoning |
|----------|---------------|-----------|
| 快速 | 完成后折叠 | 通常无 |
| 深度（轻量） | 完成后折叠；推理块默认展开 | 有 |
| 深度（完整研究） | 阶段条 + 导图在 summary；过程折叠 | 有 + `research_map` |

与 PRD §6.1 模式表一致；设置页可增加「始终展开 Agent 过程」开关（`settings.ts` 扩展）。

---

## 9. 持久化与历史

| 存储 | 字段 | 说明 |
|------|------|------|
| `sessionStorage` / 内存 | 完整 `parts[]` | 原型阶段 |
| API `ChatSession.messages` | `parts` JSON | MVP 与 `@jlc/contracts` 对齐 |
| 旧记录迁移 | 仅 `content` | 渲染为单个 `summary` part |

`contentFallback`：导出 Markdown / 分享时由 `parts` 拼接生成，不双写业务逻辑。

---

## 10. 实施分期

| 阶段 | 交付 | 改动面 |
|------|------|--------|
| **P0** | `parts` 模型 + reducer + `text`/`tool`/`status`/`error` UI + Activity 折叠 | `chat.ts`、`ChatMessageList`、`chat-stream.ts`、`useChatSend.ts` |
| **P0** | Turn 分组 + scroll-spy + user 条 sticky（F-QA-009） | `ChatTurnList`、`useActiveTurn`、`chat-turns.ts` ✅ |
| **P1** | 节奏化块、`streamSeq`、Pinned Todo、钉底滚动 | ✅ 见 roadmap S3.1 |
| **P1+** | **思考耗时**、**探索摘要**、**成品列表卡** | [chat-agent-output-ux.md](./chat-agent-output-ux.md) · S3.5 |
| **P2** | SSE `part.patch` 增强；`deliverables` 自动合并 | `companion-api.md` |
| **P3** | `citation`/`chart`/`research_map` 与数据源、深度研究闭环 | 各业务模块 |

---

## 11. 验收标准（P0）

- [x] 流式回复时 Activity 区实时出现 `tool` 行，Summary 区同步追加正文（`smoke:companion` + 交错 timeline）。
- [x] `run.finished` 后过程块折叠：`activityCollapse=collapsed`；`tool_batch` 非 streaming 时默认收起。
- [ ] 用户点击摘要条可展开/收起，刷新页面后保持 `user_*` 状态（session 级即可）。
- [ ] 旧种子数据（仅 `content`）仍可正常渲染。
- [ ] `CHAT_EXECUTION=companion` 与 Hermes/Mock 两路 SSE 均走同一 reducer。

---

## 12. 参考

- [chat-agent-output-ux.md](./chat-agent-output-ux.md) — 思考耗时、探索摘要、成品列表卡（详细需求）
- Open Design `AssistantMessage` / `ToolBatchCard` / `FileOpsSummary`
- 当前实现：`AssistantMessageBubble`、`interleavedTimelineParts`、`useChatScrollPin`
- Companion 契约：`web/docs/companion-api.md` §4

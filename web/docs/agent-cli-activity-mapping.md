# Agent CLI 执行过程映射（Activity / `tool.progress`）

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-05-21 |
| 状态 | **P0 已在 `runtime-core` + Companion 落地**（Claude `tool_use`、Codex 阶段/命令、启动 `phase`） |
| 关联 PRD | **F-QA-007**、**F-RT-005**、**F-RT-003** |
| 关联实现 | `packages/runtime-core/src/map-tool-progress.ts`、`parsers/claude-jsonl.ts`、`parsers/codex-json.ts`、`companion/src/runs/manager.ts`、`web/src/lib/chat-parts-reducer.ts` |
| 消息分块契约 | [chat-message-parts.md](./chat-message-parts.md) |

---

## 1. 目标

研究员在对话区（F-QA-007）应能看到 Agent CLI **真实执行过程**（搜索、读文件、命令等），并在 Turn 结束后默认折叠；不得仅显示「工具 1」而看不到 CLI 内部步骤。

**原则：**

1. **不自研工具循环** — 过程来自 CLI stdout 结构化流，经 Companion 归一为 SSE `tool.progress`。
2. **协议统一** — Web `chat-parts-reducer` 与 Mock/simulate 共用同一套 `tool` 名。
3. **可扩展** — 新增 CLI 事件类型时，先更新本文档映射表，再改解析器。

---

## 2. 端到端链路

```text
Agent CLI stdout (JSONL)
  → @jlc/runtime-core 解析器 (codex-json | claude-jsonl | plain)
  → AgentStreamEvent (text_delta | tool_progress | status | error)
  → Companion SSE tool.progress / message.delta
  → Web reduceToolProgress → ChatPart (activity zone)
  → PartRenderer (ToolCallRow | FileReadRow | …)
```

---

## 3. Companion SSE → Web UI

| SSE `event` | `data` | Reducer | UI |
|-------------|--------|---------|-----|
| `message.delta` | `{ content }` | `reduceTextDelta` | `SummaryMarkdown` |
| `tool.progress` | `{ tool, status, message }` | `reduceToolProgress` | 见 §5 |
| `part.append` | `{ part }` | `reduceAppendPart` | `PartRenderer` |
| `todo.update` | `{ items }` | `reduceTodoItems` | `TodoBlock` |
| `run.finished` | `{ runId }` | `reduceStreamFinished` | Activity 默认折叠 |

`status` 取值：`running` | `pending` | `success` | `error`（`completed`→`success`）。

---

## 4. CLI stdout → `tool.progress`（按 Agent）

### 4.1 Codex（`codex exec --json`）

| stdout `type` | 条件 | `tool.progress` |
|---------------|------|-----------------|
| `thread.started` | `thread_id` | phase「初始化」+ 可选写入 `cli-threads/`（观测用；续跑走全量 transcript stdin，不用 resume） |
| `turn.started` | — | `{ tool: "phase", message: "运行中" }` |
| `item.started` | `item.type === command_execution` | `{ tool: "Bash", status: "running", message: command≤200 }` |
| `item.completed` | `command_execution` | `{ tool: "Bash", status: success\|error, message: command }` |
| `item.completed` | `agent_message` | **不发** tool → `message.delta` |
| `error` / `turn.failed` | 非 Reconnecting | `error` 事件 |
| `error` | Reconnecting… | `{ tool: "phase", message }` |

> Codex **内置联网搜索**若未出现在 JSON `item.*` 中，对话区无法展示；需抓真实 stdout 补 `item.type` 映射（P1）。

### 4.2 Claude Code（`claude -p --output-format stream-json`）

| stdout | 条件 | `tool.progress` |
|--------|------|-----------------|
| `system` init | `subtype: init` | `{ tool: "phase", message: "初始化 · {model}" }` |
| `stream_event` | `thinking_delta` | `{ tool: "reasoning", status: running\|success, message≤160 }` |
| `stream_event` / `assistant` | `tool_use` 完成 | 见 §4.3 |
| `user` | `tool_result` | 对应用具 `{ status: success\|error }` |
| `stream_event` | `text_delta` | → `message.delta`（不发 tool） |

### 4.3 Claude `tool_use.name` → 规范 `tool` 名

| CLI `name` | `tool.progress.tool` | `message` 来源 | Reducer → `kind` |
|------------|----------------------|----------------|------------------|
| `WebSearch`, `web_search` | `search` | `input.query` / `q` | `tool` → `tool_batch` |
| `Read`, `read_file` | `read_file` | `file_path` / `path` | `file_read` |
| `Write`, `create_file` | `write_file` | 路径 | `file_edit` |
| `Edit`, `str_replace_edit`, `MultiEdit`, `multi_edit` | `edit_file` | 路径 | `file_edit` |
| `Bash`, `bash` | `Bash` | `command` / `input` | `command` + `tool` |
| `Grep`, `grep`, `Glob`, `glob` | `grep` | 模式或路径摘要 | `tool` |
| `WebFetch`, `web_extract` | `web_extract` | URL | `tool` |
| `TodoWrite`, `todowrite` | `todo` | 任务条数摘要 | `tool`（P1 可改 `todo.update`） |
| `mcp__*` | `mcp` | server + tool | `tool` |
| 其它 | 原名 | JSON input 摘要 | `tool` |

实现：`packages/runtime-core/src/map-tool-progress.ts`。

### 4.4 Hermes

| 路径 | 过程可见性 | 实现 |
|------|------------|------|
| **Companion CLI + Gateway**（优先） | `web_search` / `terminal` 等 → `tool.progress` | `runHermesGateway` 消费 `hermes.tool.progress` |
| `CHAT_EXECUTION=hermes`（Web BFF） | 同上 | `chat-stream.ts` → `hermesGatewayEventToProgress` |
| **CLI 回退**（Gateway 不可用） | 仅最终正文；Mock/simulate 可演示 `web_search` | `hermes chat` 非 `-Q`，`--max-turns 30` |

Gateway SSE 样本：

```json
event: hermes.tool.progress
data: {"tool":"web_search","label":"gold price May 2026","toolCallId":"call_1","status":"running"}

event: hermes.tool.progress
data: {"tool":"web_search","toolCallId":"call_1","status":"completed"}
```

环境：`HERMES_API_URL`、`HERMES_API_KEY`；Companion 另支持 `COMPANION_HERMES_GATEWAY=true`（默认开启）。

### 4.5 Companion Run 生命周期（非 CLI stdout）

| 时机 | 旧行为 | **现行为** |
|------|--------|------------|
| CLI Run 开始 | `tool.progress { tool: "codex" }` 占「工具 1」 | `tool.progress { tool: "phase", message: "正在运行 {agentId}…" }` |

---

## 5. `tool.progress` → `ChatPart`（Web reducer）

| `tool` | Reducer 行为 | UI 组件 |
|--------|--------------|---------|
| `phase` | `status` 阶段芯片 | `StatusChip` |
| `reasoning` | 合并 `reasoning` | `ReasoningBlock` |
| `read_file` | `file_read` | `FileReadRow` |
| `write_file` / `edit_file` | `file_edit` | `FileEditRow` |
| `Bash` / `bash` / `shell` | `command` + `tool` | 命令行 + `ToolCallRow` |
| `search` / `grep` / `choice_query` / `web_extract` | `tool` → `compactToolParts` | `ToolBatchCard` |
| `todo` | `tool`（或未来 `todo.update`） | `ToolCallRow` / `TodoBlock` |

---

## 6. 验收标准（F-QA-007 / F-RT-005）

- [ ] **Claude**：提问触发 `WebSearch` 时，Activity 可见「search · running → success」或 batch「N 次搜索」
- [ ] **Codex**：执行 shell 时可见 `Bash` / `command` 行；可见「初始化 / 运行中」阶段
- [ ] Run 结束后折叠条摘要为「搜索 N · 命令 M…」，而非误导性「工具 1」（仅 phase）
- [ ] simulate 模式仍展示 `choice_query` / `grep`（与本文档 §4 规范名一致）
- [ ] 取消/错误保留已有 parts（既有 reducer 行为）

---

## 7. 抓样本（扩展 Codex 搜索映射）

```bash
cd "<工作区>" && codex exec --json --skip-git-repo-check -C . "最近黄金价格" 2>codex.stderr.log | tee codex.stdout.jsonl
```

将含 `"type":"item.` 的行提交到本仓库，用于补充 §4.1 未覆盖的 `item.type`。

---

## 8. 探索摘要（`tool_batch` 标题）

> 完整产品/UI 需求见 [chat-agent-output-ux.md](./chat-agent-output-ux.md) §2。

Web 侧将 §4 归一化后的 `tool` 名再按**族**聚合计数，生成 `tool_batch.title`（如「已探索 4 个文件 · 搜索 2 次」）。族与 `tool` 对应关系以 output-ux 文档 §2.3 为准；实现落点 `web/src/lib/tool-family.ts`（待建）+ `chat-parts-normalize.ts`。

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-21 | 初版；P0 实现 Claude tool_use、Codex 阶段/命令、Companion phase |
| v1.1 | 2026-05-21 | Hermes Gateway `hermes.tool.progress`；Claude `--include-partial-messages` |
| v1.2 | 2026-05-21 | 交叉引用探索摘要需求（chat-agent-output-ux §2） |

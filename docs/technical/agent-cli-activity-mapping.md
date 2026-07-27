# Agent CLI 执行过程与助手分段映射

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.3 |
| 创建日期 | 2026-05-21 |
| 最近修订 | 2026-07-21 |
| 状态 | **0.1.6-rc.2 已落地**：Codex / Claude / Hermes 过程、动作与 final 边界统一 |
| 关联 PRD | **F-QA-007**、**F-RT-005**、**F-RT-003** |
| 关联实现 | `packages/runtime-core/src/parsers/`、`packages/runtime-core/src/run-hermes-gateway.ts`、`companion/src/runs/manager.ts`、`web/src/lib/chat-parts-reducer.ts` |
| 消息分块契约 | [chat-message-parts.md](./chat-message-parts.md) |

---

## 1. 目标与原则

对话区应展示 Agent CLI 的真实业务过程：它说明了什么、读取或修改了什么、运行了什么，以及何时开始最终回答。实现遵守以下原则：

1. **保留来源语义**：结构化 stdout 先归一为 Runtime 事件，不根据中文/英文关键词猜测 process 或 final。
2. **双通道互补**：助手文本使用 `assistant.segment`；工具证据继续使用 `tool.progress`。
3. **canonical 隔离**：只有 final 文本进入正式回答；process 仅进入过程时间线。
4. **兼容旧消费者**：没有分段回调时，Runtime 只把 final 回退到 `onText`；既有 `message.delta` 继续可用。
5. **不暴露隐藏思维链**：过程文本是供应商明确标注或由工具边界确定的业务旁白，reasoning 单独归类并默认收起。

---

## 2. 端到端链路

```text
Agent CLI / Gateway structured stream
  → @jlc/runtime-core parser
  → AgentStreamEvent
       assistant_segment(start | delta | commit, pending | process | final)
       tool_progress(start | progress | end)
       narration / status / error
  → Companion SSE
       assistant.segment / tool.progress / ...
  → Runtime store + session persistence
  → Web reducer
  → ProcessTimelineNode[] + ResultItem[]
  → ActivitySection + ResultSequence
```

`assistant.segment` 与 `tool.progress` 各自有稳定 id，可独立流式更新，再由 `streamSeq` 在前端恢复业务顺序。

---

## 3. Companion SSE 到 Web

| SSE `event` | 关键数据 | Web 行为 |
|-------------|----------|----------|
| `assistant.segment` | `segmentId`、`operation`、`role`、`text?` | 原位追加或定类为 narration / result |
| `message.delta` | `content` / `text` / `delta` | 旧协议兼容，直接追加 final result |
| `tool.progress` | `tool`、`status`、`callId?`、`message?`、`input?`、`output?` | upsert 动作生命周期 |
| `part.append` / `part.patch` | 强类型 Part | 追加或修补 checkpoint / 业务卡 |
| `todo.update` | Todo items | 更新 Pinned Todo |
| `run.finished` | run id / canonical output | seal streaming；不重复覆盖折叠选择 |

助手分段角色：

| role | 意义 | 前端落位 |
|------|------|----------|
| `pending` | 来源暂时无法判断文本用途 | 暂存为可原位定类的过程 Part |
| `process` | 工具前说明、阶段总结、下一步旁白 | 过程时间线 narration |
| `final` | 面向用户的最终回答 | ResultSequence；首次出现触发一次性收起 |

---

## 4. Codex 映射

来源：`codex exec --json`。

| stdout 事件 | 条件 | Runtime 输出 |
|-------------|------|--------------|
| `thread.started` | 有 `thread_id` | `thread_started` + phase「初始化」 |
| `turn.started` | - | phase「运行中」 |
| `item.started` | 非 `agent_message` | 对应 `tool_progress(start)` |
| `item.completed` | 非 `agent_message` | 对应 `tool_progress(end)` |
| `item.completed` | `agent_message.phase === commentary` | `assistant_segment commit(process)` |
| `item.completed` | 其他 `agent_message` | `assistant_segment commit(final)` |
| `error` / `turn.failed` | 非 reconnect | `error` |
| reconnect 提示 | - | phase 过程事件 |

`segmentId` 优先使用 Codex item id；没有 id 时使用单调递增的匿名 id。Codex agent message 已是完成块，因此通常直接发 `commit` 并携带完整文本。

Codex 未在 JSON 流中提供的内置行为无法可靠展示，不能通过推测补造工具事件。

---

## 5. Claude Code 映射

来源：`claude -p --output-format stream-json --include-partial-messages`。

Claude 文本与工具的先后关系决定同一 assistant message 的角色：

```text
message_start
→ text_delta: assistant_segment delta(pending)
→ 若同一 message 出现 tool_use: commit(process)
→ 若 message 结束且没有 tool_use: commit(final)
```

| stdout | 条件 | Runtime 输出 |
|--------|------|--------------|
| `system/init` | 有 model | phase「初始化 · model」 |
| `stream_event/text_delta` | assistant message 内 | `assistant_segment delta(pending)` |
| `content_block_start/stop` | `tool_use` | 标记该 message 为 process；发 `tool_progress(start)` |
| `message_delta/stop` | message 有 tool | `assistant_segment commit(process)` |
| `message_delta/stop` | message 无 tool | `assistant_segment commit(final)` |
| `thinking_delta` | reasoning block | reasoning `tool_progress`，不进入 assistant final |
| `user/tool_result` | 对应 tool id | `tool_progress(end)` |

### 5.1 Claude 工具名归一

| Claude `tool_use.name` | 规范 `tool` | Web 动作族 |
|------------------------|-------------|------------|
| `WebSearch` / `web_search` | `search` | search |
| `Read` / `read_file` | `read_file` | read |
| `Write` / `create_file` | `write_file` | edit |
| `Edit` / `MultiEdit` / `str_replace_edit` | `edit_file` | edit |
| `Bash` / `bash` | `Bash` | command |
| `Grep` / `Glob` | `grep` | search |
| `WebFetch` / `web_extract` | `web_extract` | search |
| `TodoWrite` | `todo` | tool / Todo |
| `mcp__*` | `mcp` | tool |
| 其他 | 原名 | tool |

工具 block 可能在 partial 和完整 assistant 事件中重复出现，parser 通过 tool id 去重。

---

## 6. Hermes 映射

Hermes Gateway 的普通文本 delta 在到达时还不能确定角色，因此 Runtime 维护 pending segment：

1. 首个文本 delta 建立 pending segment。
2. 后续文本持续追加到相同 segment。
3. 若出现 `hermes.tool.progress` running，先把 pending segment `commit(process)`，再发工具事件。
4. 工具之后的新文本建立新 segment。
5. 收到 `[DONE]` 或正常 EOF 时，把最后的 pending segment `commit(final)`。

Gateway 工具样本：

```text
event: hermes.tool.progress
data: {"tool":"web_search","label":"query","toolCallId":"call_1","status":"running"}

event: hermes.tool.progress
data: {"tool":"web_search","toolCallId":"call_1","status":"completed"}
```

CLI 回退若没有结构化工具信息，只能保守输出 final，不虚构过程动作。

---

## 7. `tool.progress` 到过程动作

| 规范 `tool` | ChatPart / occurrence | 展示 |
|-------------|-----------------------|------|
| `phase` | `status` | 阶段信息；内部噪音下沉技术详情 |
| `reasoning` | `reasoning` | 独立思考业务说明；运行中展开，final 后随过程收起 |
| `read_file` | `file_read` | 读取动作 |
| `write_file` / `edit_file` | `file_edit` | 修改动作 |
| `Bash` / `bash` / `shell` | `command` + 原 tool 事实 | 合并为一个 command occurrence |
| `search` / `grep` / `web_extract` | `tool` | 搜索动作 |
| `todo` | `tool` / `todo.update` | Todo 或工具证据 |

动作状态由 `callId`、工具族和资源标识合并：running / success / error 不应显示成多条独立动作；跨阶段的同一文件仍分别保留。

---

## 8. 持久化与回放

- Runtime store 将 `assistant.segment` 保存为正式 Run Event。
- Companion session persistence 按 `segmentId` 缓冲文本；仅在 role 为 final 时追加尚未写入的部分。
- `commit` 不要求重复携带文本，重放端使用之前 delta 的缓冲内容完成定类。
- process 分段不进入 `assistantContent`，避免历史会话把过程旁白拼进最终回答。
- SSE 回放端根据 final segment 合成带 `compatibility: "assistant.segment"` 的 `message.delta`；该镜像不进入 Run Events 或 Session，新版 Web 忽略它。
- 没有兼容标记的旧 `message.delta` 仍追加到 assistant content，并由 Web 当作 final 处理。

---

## 9. 验收标准

- [x] Codex commentary 进入过程，final agent message 进入最终回答。
- [x] Claude 工具前 pending 文本原位提交为 process，无重复正文。
- [x] Claude 无工具的最后一条 assistant message 提交为 final。
- [x] Hermes 工具前文本为 process，结束文本为 final。
- [x] Runtime 在缺少新回调时只回退 final 文本。
- [x] Companion 可持久化和回放无文本 commit。
- [x] Web 运行中展开动作，首个 final 一次性收起，finish 不二次覆盖。
- [x] error / cancelled 保留已产生的过程和结果。
- [x] 旧 `message.delta` 与历史会话继续可用。
- [x] 新旧双事件在新版只渲染一次，旧客户端仍可读取 final delta。

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-21 | Claude tool_use、Codex 阶段/命令、Companion phase |
| v1.1 | 2026-05-21 | Hermes Gateway 与 Claude partial messages |
| v1.2 | 2026-05-21 | 探索摘要与动作族 |
| v1.3 | 2026-07-21 | 0.1.6-rc.2：三 provider assistant.segment 角色映射、持久化和回放 |

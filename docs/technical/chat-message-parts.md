# 对话消息分块（`parts[]`）技术方案

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.3 |
| 创建日期 | 2026-05-21 |
| 最近修订 | 2026-07-21 |
| 状态 | **0.1.6-rc.2 已落地**：助手分段协议、业务过程时间线、final 一次性收起、历史兼容 |
| 关联 | PRD **F-QA-007/009/010**、[chat-process-display-spec.md](../design/chat-process-display-spec.md)、[agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md)、[companion-api.md](./companion-api.md) |
| 类型契约 | `packages/contracts/src/chat.ts`、`packages/contracts/src/runtime.ts` |
| 当前实现 | `web/src/lib/chat-parts-reducer.ts`、`web/src/lib/chat-activity-view-model.ts`、`web/src/lib/chat-turn-view-model.ts` |

---

## 1. 目标与边界

助手 Turn 需要同时满足两个阅读目标：

1. **运行中可观察**：业务旁白、读取、搜索、命令、修改和阶段性业务产出按真实发生顺序直接可见。
2. **结果可定位**：最终回答开始输出时，过程自动收起一次；完成后用户可重新展开复盘。
3. **证据可追溯**：完成态一级展开保留业务时间线，具体文件、命令和工具载荷进入局部 disclosure。
4. **协议统一**：Runtime、Companion、SSE、持久化、回放和 Web 共用 `@jlc/contracts`。
5. **历史兼容**：旧 `message.delta`、content-only 消息和没有新增字段的 `parts[]` 继续渲染。

过程区显示业务旁白、provider 允许展示的独立 reasoning 摘要与工具证据，不把隐藏 chain-of-thought 当成普通用户功能。每次 reasoning 生命周期按 `streamSeq` 原位显示，不跨动作汇总。

---

## 2. Turn 与稳定 DOM 顺序

- **Session**：`sessionId`，包含多个 Turn。
- **Turn**：一条用户消息和对应的一条 assistant 消息。
- **Turn 内 DOM 顺序**固定为：

```text
waiting_user 提示（如有）
→ 处理过程
→ Outcome（完成 / 空结果 / 失败 / 取消）
→ 最终回答及结构化结果
→ deliverables / artifact
```

过程和结果不因折叠状态互换 DOM 位置。`streamSeq` 只负责过程区内部的真实业务顺序；结果区由 `ResultItem[]` 保留自己的业务顺序。

---

## 3. `ChatPart` 数据模型

```ts
type AssistantMessage = {
  id: string;
  role: "assistant";
  status: "loading" | "streaming" | "complete" | "error" | "cancelled";
  parts: ChatPart[];
  activityCollapse?: ActivityCollapse;
  finalCollapseRevision?: number;
  contentFallback?: string;
  runId?: string;
};
```

`ChatPart` 的 0.1.6 可选字段：

| 字段 | 作用 | 兼容规则 |
|------|------|----------|
| `streamSeq` | SSE 到达顺序 | 缺失时使用数组下标稳定回退 |
| `segmentId` | 关联同一助手文本分段 | 仅新协议使用；旧记录无需迁移 |
| `presentationRole` | `process`、`result`、`checkpoint` | 缺失时按 `zone` / `kind` 确定性回退 |
| `streaming` | 分段仍在更新 | 完成或 commit 后置为 `false` |

`zone` 继续作为分类与兼容字段：

| zone | 含义 | 默认呈现 |
|------|------|----------|
| `summary` | 最终回答、结构化结果、交付物 | 始终可见 |
| `activity` | 业务旁白、动作证据、状态、技术信息 | 按 Turn 状态与用户选择展开 |

---

## 4. `assistant.segment` 协议

### 4.1 事件结构

```ts
type AssistantSegmentPayload = {
  segmentId: string;
  operation: "start" | "delta" | "commit";
  role: "pending" | "process" | "final";
  text?: string;
};
```

| 字段 | 语义 |
|------|------|
| `segmentId` | 同一段文本在流式、定类和回放过程中的稳定标识 |
| `start` | 建立空分段；允许后续 delta |
| `delta` | 向该分段追加文本 |
| `commit` | 提交分段并确定或修正展示角色；可不携带重复文本 |
| `pending` | 供应商尚未给出足够信号判断是过程还是最终回答 |
| `process` | 业务过程旁白，进入过程时间线 |
| `final` | 最终回答，进入结果序列并触发一次性自动收起 |

### 4.2 原位定类

Reducer 通过 `segmentId` 更新同一个 Part，不复制文本：

```text
pending delta
  → 暂存为未定类 activity Part
  → commit(process): 原位保留在过程区
  → commit(final): 原位转为 text/result，并开始最终回答
```

这解决 Claude/Hermes 在工具调用出现前无法确定文本角色的问题，也避免 provisional 文本先出现在结果区、随后又在过程区重复。

### 4.3 旧事件兼容

- `message.delta` 继续视为 final 文本，保持旧消费者和历史流可用。
- Companion 的实时 SSE 回放会从 final `assistant.segment` 合成 `{ compatibility: "assistant.segment" }` 的 `message.delta`，供旧客户端读取。
- 兼容镜像不写入 Run Events，也不重复写入 Session；新版 Web 遇到该标记时忽略，避免最终回答重复。
- `part.append` / `part.patch` / `tool.progress` 等既有事件不变。
- 新字段全部可选，不提升 `CHAT_PARTS_PROTOCOL_VERSION`，不做数据库迁移。
- Runtime 在消费者没有 `onAssistantSegment` 回调时，只把 final 分段回退到原 `onText`，不把 process 写入 canonical answer。

---

## 5. Provider 角色映射

| 来源 | 识别规则 | 输出 |
|------|----------|------|
| Codex | `agent_message.phase === commentary` | `commit(process)` |
| Codex | 其他 `agent_message` | `commit(final)` |
| Claude | 文本流开始且尚未看到同消息工具 | `delta(pending)` |
| Claude | 同一 assistant message 出现 `tool_use` | `commit(process)` |
| Claude | 消息结束且没有 `tool_use` | `commit(final)` |
| Hermes | 文本先进入 pending 缓冲；后续工具开始 | 工具前 `commit(process)` |
| Hermes | 流正常结束且没有后续工具 | `commit(final)` |

Companion 原样转发、持久化并重放 `assistant.segment`。只有 `role=final` 的文本进入 `assistantContent` / canonical answer；commit 不带文本时使用运行时与持久化层按 `segmentId` 已缓冲的内容。

---

## 6. 过程时间线

`buildProcessTimeline()` 输出 `ProcessTimelineNode[]`：

```ts
type ProcessTimelineNode =
  | { type: "narration"; streamSeq: number; part: NarrationPart }
  | { type: "reasoning"; streamSeq: number; part: ReasoningPart }
  | { type: "actions"; streamSeq: number; occurrences: ActivityOccurrence[] }
  | { type: "checkpoint"; streamSeq: number; part: ChatPart };
```

构建规则：

1. narration、独立 reasoning、动作 occurrence 和 checkpoint 合并后按 `streamSeq` 排序。
2. 两条业务说明或 checkpoint 之间的连续动作组成一个 action group。
3. 同一工具生命周期按 call id / 资源标识合并为 occurrence；不删除跨阶段的重复动作。
4. requirements、需求摘要、outline、simulation 等阶段性业务产出进入 checkpoint。
5. final answer 与 deliverables 不进入过程时间线。

常用 `kind` 与归属：

| kind | 展示归属 |
|------|----------|
| `narration` | 过程时间线业务叙述 |
| `reasoning` | 按生命周期独立的过程时间线业务说明 |
| `file_read` / `document_read` / `command` / `file_edit` / `tool` | action group |
| requirements / requirement summary / outline / simulation 阶段产出 | checkpoint |
| `text` / `summary` | 最终结果 |
| `artifact` / `deliverables` | 结果之后的交付区 |
| `skill` / 原始 `status` | 默认收起的技术详情 |

---

## 7. 折叠状态机

| Turn 状态 | 过程一级 | 动作明细 | 说明 |
|-----------|----------|----------|------|
| preparing / running / restoring | 默认展开 | 默认展开 | 用户实时看到具体执行内容 |
| final 首次出现 | 系统自动收起一次 | 不挂载 | `finalCollapseRevision + 1` |
| complete 后用户重开 | 按用户选择 | 默认收起 | 先看业务时间线，再按组核查文件/命令 |
| waiting_user / error / cancelled | 默认展开 | 默认展开 | 阻塞原因和已有证据不能隐藏 |

优先级规则：

1. 新的 final 首次出现时，系统收起优先于此前运行态展开。
2. 同一 revision 内，`user_expanded` / `user_collapsed` 优先于后续 SSE、finish 和回放事件。
3. finish 本身不能二次覆盖用户偏好。
4. 没有 final 的空结果完成态可收束，但错误、等待和取消保持展开。

---

## 8. SSE 与 Reducer

| SSE event | Reducer 行为 |
|-----------|--------------|
| `run.started` | 初始化 assistant，占位为 expanded，重置 final 状态 |
| `assistant.segment` | 按 `segmentId` 追加并原位定类；final 首次出现触发一次性收起 |
| `message.delta` | 兼容路径：追加 result text，并视为 final 已开始 |
| `tool.progress` | upsert 动作生命周期，保留 input/output 证据 |
| `part.append` / `part.patch` | 追加或修补强类型 Part |
| `run.finished` | seal streaming Part；有 final 时不重复触发收起 |
| `run.error` / `run.cancelled` | 保留已有 Parts 与用户折叠偏好 |

前端关键实现：

```text
consumeChatSse
→ reduceAssistantSegment / reduceTextDelta / reduceToolProgress
→ buildTurnViewModel
→ buildActivityViewModel + buildProcessTimeline
→ AssistantMessageBubble
```

---

## 9. 组件树

```text
AssistantMessageBubble
├── OutcomeCallout(waiting_user，可选)
├── ActivitySection
│   ├── ActivitySummaryBar（运行中 sticky）
│   ├── ActivityEvidenceList(ProcessTimelineNode[])
│   │   ├── Narration
│   │   ├── Reasoning（按生命周期原位显示）
│   │   ├── ActionGroup（完成复盘时局部折叠）
│   │   └── Checkpoint → PartRenderer
│   └── 技术详情（默认折叠）
├── OutcomeCallout(terminal，可选)
├── ResultSequence
└── DeliverablesSection
```

旧路径由 `CHAT_ACTIVITY_V2_ENABLED=false` 切换到 `LegacyAssistantMessageBubble`；开关不改变消息事实数据。

---

## 10. 持久化与安全

- Companion runtime store 保存 segment Run Event，session persistence 按 segment 缓冲，仅追加 final 文本到 canonical assistant content。
- 历史回放走同一 reducer，commit 可无文本。
- `contentFallback` 只作为旧数据、导出和无结构化结果时的回退。
- 工具 input/output 在 UI 前必须脱敏、限深、限长；隐藏技术详情不是安全边界。
- summary / 整体折叠态不挂载大型 JSON、reasoning 或完整工具 output。

---

## 11. 验收标准

- [x] 运行中过程和动作明细默认展开，并按 `streamSeq` 交错显示。
- [x] 每次 reasoning 生命周期独立成段，并与前后动作保持原始顺序。
- [x] final 首次出现时只自动收起一次；之后用户选择不被 finish 或增量覆盖。
- [x] 完成后重开显示业务时间线，动作证据按组折叠。
- [x] waiting_user、error、cancelled 保持展开并保留已有结果。
- [x] Codex、Claude、Hermes 映射到统一分段角色。
- [x] `message.delta`、content-only 和旧 Parts 无需迁移可回放。
- [x] DOM 顺序固定为过程、Outcome、最终回答、交付物。
- [x] checkpoint 结构化卡在过程时间线保持业务交互能力。
- [x] 原生 button、focus-visible、reduced motion 和 390px 无横向溢出。

---

## 12. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-05-21 | 时间序交错、Pinned Todo、块级折叠 |
| v1.2 | 2026-07-21 | 0.1.6-rc.2：assistant.segment、业务时间线、final 一次性收起与兼容回放 |
| v1.3 | 2026-07-21 | 可见 reasoning 生命周期独立分段并原位进入业务时间线 |

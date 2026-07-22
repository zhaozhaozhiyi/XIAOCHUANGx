# 小窗 XIAOCHUANGx 会话业务时间线标准与事件协议

| 属性 | 内容 |
| --- | --- |
| 文档版本 | `v1.1` |
| 冻结日期 | 2026-07-22 |
| 适用版本 | `0.1.6` / `0.1.6-rc.*` |
| 状态 | **已冻结，作为 0.1.6-T01 唯一基准** |
| 适用范围 | Runtime、Companion、SSE、持久化、历史回放、Web 对话展示 |
| 关联需求 | [requirements-0.1.6.md](../product/requirements-0.1.6.md) |
| 关联实施 | [chat-process-collapse-implementation-plan.md](../plans/chat-process-collapse-implementation-plan.md) |

## 0. 目标与结论

小窗的过程展示必须回答一个问题：**AI 在这一刻为什么做这件事，做完得到了什么，接下来为什么继续。**

因此，标准不是要求每个任务都套用固定模板，而是要求所有实际发生的事件遵循同一套语义、生命周期和时间顺序。任务可以只有思考和回答，也可以循环多次“说明 → 动作 → 结果”，但不能因为展示聚合而改变真实发生顺序。

统一用户阅读顺序为：

```text
思考
→ 思考结论 / 下一步业务说明
→ 动作开始
→ 动作执行结果
→ 阶段总结或业务检查点
→ 下一轮思考或动作（可重复）
→ 最终结论
→ 最终产物
```

这条顺序描述的是**事件语义**，不是提示词模板。模型、CLI 和任务复杂度可以不同，系统不能靠关键词猜测或事后重排来补齐缺失事件。

## 1. 事件分类

| 类型 | 用户语义 | 一级时间线 | 关键标识 |
| --- | --- | --- | --- |
| `reasoning` | 本次独立思考，以及对已有证据的判断 | 显示 | `segmentId` |
| `narration` | 思考结论、下一步业务说明、工具前后说明 | 显示 | `segmentId` |
| `action` | 查询、读取、命令、编辑、写入等执行动作 | 显示摘要，证据二级展开 | `callId` |
| `observation` | 动作返回的事实、数据或执行结果 | 显示 | `callId` / `eventId` |
| `checkpoint` | 阶段性总结、需求摘要、大纲、结构化业务卡 | 显示 | `eventId` |
| `error` | 在实际发生位置上的失败或中断 | 显示 | `eventId` / `callId` |
| `final` | 面向用户的最终回答 | 结果区 | `segmentId` |
| `deliverable` | 最终文件、报告、图片或其他产物 | 最终回答之后 | `eventId` / 路径 |

`reasoning` 与 `narration` 必须分开：前者是一个独立思考生命周期，后者是思考得出的业务行动说明。两者不能把整轮内容汇总成一个“思考过程”节点。

平台只展示来源明确标记为可展示的 reasoning 事件，并在渲染前执行脱敏、限长和限深；平台不自行猜测或生成隐藏思维链。

## 2. Canonical 时间线事件

Runtime 归一后的事实至少要具备以下字段。字段可以映射到现有 `assistant.segment`、`tool.progress`、`part.append` 和 `part.patch`，不要求一次性替换现有协议。

```ts
type TimelineEventKind =
  | "reasoning"
  | "narration"
  | "action"
  | "observation"
  | "checkpoint"
  | "error"
  | "final"
  | "deliverable";

type TimelineEventPhase =
  | "start"
  | "delta"
  | "progress"
  | "end"
  | "commit";

type TimelineEventStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "cancelled";

type TimelineEvent = {
  eventId: string;
  runId: string;
  turnId: string;
  streamSeq: number;
  kind: TimelineEventKind;
  phase: TimelineEventPhase;
  status?: TimelineEventStatus;
  segmentId?: string;
  callId?: string;
  parentId?: string;
  source: "codex" | "claude" | "hermes" | "mock" | "legacy";
  content?: string;
  payload?: unknown;
};
```

### 2.1 标识规则

- `streamSeq` 是同一 Turn 内的全局单调递增序号，由 Runtime/Companion 在事实事件进入统一流时分配。
- `segmentId` 标识同一段助手文本或 reasoning 的生命周期；增量和 commit 必须复用它。
- `callId` 标识同一个工具动作的开始、进度和结束；同一个 `callId` 只能产生一个动作节点。
- `parentId` 用于关联“根据哪次思考/哪次动作得出的说明或检查点”，没有可靠父级时可以为空。
- `eventId` 必须稳定，可用于 Run Event 持久化、重放和调试。

## 3. 生命周期与顺序

### 3.1 思考和说明

```text
reasoning.start
reasoning.delta × n
reasoning.end
narration.commit
```

每次 `reasoning.end` 都结束一个独立段。下一次 `reasoning.start` 必须创建新的 `segmentId` 和时间线节点，即使两段内容相邻或属于同一个 provider message。

### 3.2 动作

```text
action.start(callId)
action.progress(callId) × n
action.end(callId, status)
observation(callId, 可选)
```

动作结束时必须按 `callId` 原位更新开始节点，不能因为收到结束事件而追加第二个“已读取/已运行”节点。并发动作必须允许逆序结束，结束哪个动作只由 `callId` 决定。

### 3.3 文本角色

沿用现有 `assistant.segment`：

```ts
type AssistantSegmentPayload = {
  segmentId: string;
  operation: "start" | "delta" | "commit";
  role: "pending" | "process" | "final";
  text?: string;
};
```

- `pending`：来源尚未足以判断是过程说明还是最终回答，暂存于原位置。
- `process`：确定为业务过程，原位保留为 `narration`。
- `final`：确定为最终回答，原位转换为结果区文本，并触发一次性收起。
- `commit` 不要求重复携带文本；消费方必须使用已按 `segmentId` 缓冲的内容。

## 4. 聚合与展示规则

### 4.1 允许的聚合

- 连续的同一 `segmentId` 增量合并为一个文本节点。
- 同一 `callId` 的动作生命周期更新为一个动作节点。
- 连续动作可以形成视觉上的 action group，但 group 内必须保留每个动作的 `streamSeq` 和原始子顺序。
- 重复资源可以显示次数，但次数合并不能删除动作节点的时间位置。

### 4.2 禁止的聚合

- 不得把多个 reasoning 生命周期合并成一个底部“思考过程”。
- 不得把 `读取 A → 查询 B → 再读取 A` 变成 `读取 A ×2 → 查询 B`。
- 不得按 `read/search/edit/command` 工具族全局排序。
- 不得用最后一次状态覆盖第一次发生位置。
- 不得把 process/narration 写入 final answer 或 canonical final。
- 不得把动作结束事件当成新的动作追加。

### 4.3 时间线构建

时间线构建器只做三件事：收集事实、按 `streamSeq` 排序、建立不改变子顺序的视觉分组。

```text
parts/events
  → 保留 eventId/callId/segmentId
  → 按 streamSeq 稳定排序
  → 只把相邻动作包装为 action group
  → 输出 reasoning / narration / actions / checkpoint 节点
```

如果历史事件没有 `streamSeq`，使用保存顺序作为保守回退，不能凭空推断真实时间。

## 5. Provider 映射

### Claude Code

```text
thinking block
→ reasoning 生命周期
text + 后续 tool_use
→ narration(process)
tool_use start/end
→ action(callId)
下一次 thinking block
→ 新 reasoning 生命周期
无 tool_use 的最终 assistant message
→ final
```

Claude 的 `thinking_delta` 不得与下一次 thinking block 合并。Read/Edit/Bash 的完成事件必须复用原始 tool use id。

### Codex

```text
agent_message.phase=commentary → narration(process)
agent_message.phase=final_answer → final
未标注 phase 的 agent_message → pending
后续动作开始 → 前置 pending 原位 commit(process)
turn.completed → 剩余 pending 原位 commit(final)
turn.failed / error → 剩余 pending 原位 commit(process)
item.started/completed → action(callId)
```

Codex 没有提供的内置行为不能由平台推测补造。`pending` 只延迟角色提交，不改变文本第一次出现的 `streamSeq` 和时间位置。

### Hermes

```text
Gateway：
  普通文本先进入 pending
  工具开始 → pending commit(process)
  工具结束 → action end/observation
  流结束 → pending commit(final)

CLI fallback：
  非交互 oneshot 正文 → final
  明确 API / 鉴权失败 → error
```

Hermes Agent 0.18.2 Gateway 的 `hermes.tool.progress` 提供真实的 `tool`、`toolCallId`、`status` 和起始 `label`，可以验证工具生命周期与时间顺序；该上游事件当前明确不发送原始参数和执行结果，因此小窗不得从 label 或最终回答反推、补造 `input` / `output`。Hermes CLI fallback 连结构化工具生命周期也不提供。真实 Hermes 工具回归必须以 Gateway 的 callId 生命周期为门槛；只有 Provider 原生提供载荷的来源才要求 input/output 完整。Gateway 或外部 Provider 不可用时必须记录残余风险，错误文本不得伪装为成功 final。

## 6. UI 状态

| Turn 状态 | 过程区 | 动作证据 | 结果区 |
| --- | --- | --- | --- |
| `preparing/running` | 默认展开 | 默认展开 | final 尚未出现时不显示 |
| `waiting_user` | 展开 | 展开 | 已有部分结果保留 |
| `final started` | 系统只收起一次 | 随过程收起 | 连续显示 final |
| `complete` | 默认收起，用户展开可复盘 | 默认按组收起 | final 与产物显示 |
| `error/cancelled` | 保持展开 | 保持可解释 | 部分结果和错误保留 |

最终 DOM 顺序固定为：

```text
处理过程 → Outcome → 最终回答 → 交付物
```

折叠只改变可见性，不改变 DOM 顺序和 `streamSeq` 顺序。最终回答开始后，后续 `run.finished`、错误、取消和历史回放都不能覆盖用户手动展开/收起选择。

## 7. 持久化与回放

- Run Events 必须保存 `assistant.segment`、`tool.progress`、`part.append`、`part.patch` 的事实顺序。
- Session 不能只保存最终正文；必须保存完整 `parts/timeline`，或能稳定从 Run Events 重建它。
- 兼容镜像 `message.delta` 只供旧消费者使用，不得重复持久化或重复渲染。
- Companion 不可用时，历史会话仍应使用本地已保存的过程事实；无法恢复的旧记录只能按 content-only 保守显示并明确属于历史能力限制。

## 8. 0.1.6 验收矩阵

必须覆盖以下顺序和异常，而不是只覆盖单一 provider 的简单样例：

| 编号 | 场景 | 必须得到 |
| --- | --- | --- |
| T01 | reasoning → narration → action → observation → final | 每类节点按原序显示 |
| T02 | 两次相邻 reasoning 生命周期 | 两个独立 reasoning 节点 |
| T03 | 同一 `callId` start/end | 一个动作，状态被更新，不重复计数 |
| T04 | 两个动作并发、逆序结束 | 各自按 `callId` 正确结束 |
| T05 | 相同资源跨不同动作重复出现 | 保留两个时间位置，可显示次数但不重排 |
| T06 | action error 后仍有 final | 错误留在原位置，部分结果和 final 保留 |
| T07 | final 开始后继续收到 finish/replay | 只收起一次，用户选择不被覆盖 |
| T08 | 历史重载且 Companion 暂不可用 | 使用本地时间线事实，不能只丢过程 |
| T09 | Claude / Codex / Hermes / Mock | 映射到同一时间线语义 |
| T10 | 旧 `message.delta` / content-only | 不迁移即可保守回退 |

## 9. 后续实施工作包

| 工作包 | 目标 |
| --- | --- |
| `0.1.6-T02` | Contracts / Runtime 输出 canonical 时间线事件，补齐 `callId` 和 `streamSeq` |
| `0.1.6-T03` | Reducer 按生命周期原位更新 Read/Edit/Command/Tool，移除错误重复追加 |
| `0.1.6-T04` | ViewModel 取消破坏顺序的资源聚合，改为保序 action group |
| `0.1.6-T05` | Session 保存完整过程事实并完成历史回放 |
| `0.1.6-T06` | Web 展示、折叠、错误和滚动按本标准验收 |
| `0.1.6-T07` | 用真实 Claude、Codex、Hermes 和历史会话完成候选版回归 |

当前执行进度：`T01` 标准冻结，`T02-T07` 已完成候选实现与可控范围回归。73 个活动时间线 fixture、23 条 Chat Playwright、Codex 0.144.3 与 Claude Code 2.1.161 真实只读工具任务通过；安装版重启后仍使用固定 Origin `127.0.0.1:51247`，近期任务入口和完整过程可恢复，Companion 晚于 Web 就绪时会自动重试 Agent 探测。Hermes Agent 0.18.2 已验证 Gateway 降级、CLI HTTP 404 错误语义和单一终端错误，成功态真流因外部 Gateway/Provider 不可用保留为 RC 残余风险。

## 10. 变更控制

任何会改变事件分类、顺序、生命周期、持久化或折叠边界的修改，都必须先更新本标准和验收矩阵，再修改代码。实现文档、provider 映射和测试 fixture 与本文件冲突时，以本文件为准。

# 对话过程与最终结果展示实施方案

| 属性 | 内容 |
| --- | --- |
| 文档版本 | v1.9 |
| 日期 | 2026-07-22 |
| 状态 | `0.1.6-T01` 已冻结；`T02-T07` 已完成候选实现与可控范围回归；Hermes 外部 Provider 成功态保留为 RC 风险 |
| 目标平台版本 | `0.1.6` |
| 版本边界 | `docs/product/requirements-0.1.6.md` |
| 适用范围 | Web 对话页、桌面壳、Companion、Runtime、历史回放 |
| 核心决策 | 运行中过程与动作证据展开；首个 final 到达时自动收起一次；完成后按业务时间线复盘 |
| 视觉方向 | Open Design `openai`：内容优先、克制层级、状态清晰，复用现有 token 与组件 |
| 关联文档 | `docs/technical/chat-timeline-contract-v1.md`（唯一业务顺序基准）、`docs/design/chat-process-display-spec.md`、`docs/technical/chat-message-parts.md`、`docs/technical/agent-cli-activity-mapping.md` |

> 本文中的勾选项表示候选实现已完成；正式发布仍受内部长任务、release-gated 制品和 Hermes 外部 Provider 可用性约束。事件顺序与验收边界以 [`chat-timeline-contract-v1.md`](../technical/chat-timeline-contract-v1.md) 为准。

---

## 1. 最终目标

本版本只解决一个系统级体验问题：

> 用户在 AI 执行期间能直接读懂“正在做什么”，最终回答开始后又能立即把注意力移到结果；需要复盘时，仍可按真实业务顺序找到每一步证据。

验收后的稳定结构：

```text
运行中：
处理过程 · 正在验证 · 已读取 3 个文件 · 42 秒               [收起]
  我先确认协议，再检查现有 reducer。
  已读取 3 个文件
  我已经定位问题，接下来修改并验证。
  已编辑 4 个文件 · 已运行 2 条命令

final 开始后：
已处理 · 42 秒                                                   [展开]

Outcome（如有）
最终回答正文
交付物 / 文件

完成后重新展开：
已处理 · 42 秒                                                   [收起]
  我先确认协议，再检查现有 reducer。
  已读取 3 个文件                                                [展开]
  我已经定位问题，接下来修改并验证。
  已编辑 4 个文件 · 已运行 2 条命令                             [展开]
```

---

## 2. 锁定决策

| # | 决策 | 结论 |
| --- | --- | --- |
| D1 | DOM 顺序 | 过程 → Outcome → 最终回答 → 交付物，折叠不重排 |
| D2 | 运行态 | preparing / running / restoring 默认展开过程与动作明细 |
| D3 | 收起时机 | 首个 final 开始时只自动收起一次，不等 run.finished |
| D4 | 用户优先 | 一次性收起后，SSE、finish、error、cancel、回放不得覆盖用户选择 |
| D5 | 异常态 | waiting_user / error / cancelled 保持展开 |
| D6 | 过程顺序 | narration、独立 reasoning、actions、checkpoint 按 `streamSeq` 交错，不按工具族全局重排 |
| D7 | 完成复盘 | 业务时间线一级可见，具体文件/命令按动作组二级折叠 |
| D8 | 文本角色 | 使用 `assistant.segment` 明确 pending / process / final |
| D9 | 结果边界 | 只有 final 进入 canonical answer；process 不与最终回答重复 |
| D10 | 思考边界 | 每次可见 reasoning 生命周期独立成业务说明节点，不跨动作合并；不暴露隐藏思维链 |
| D11 | 兼容 | 旧 message.delta、content-only 和旧 Parts 无迁移可回放 |
| D12 | 回滚 | `CHAT_ACTIVITY_V2_ENABLED=false` 恢复 0.1.5 渲染器 |

---

## 3. 技术评估

### 3.1 为什么必须改协议

仅在 Web 侧根据到达顺序或文本内容分类不可行：

- Codex 有明确的 commentary / final phase，可直接使用；
- Claude 在文本流开始时，只有看到同一 assistant message 后续是否出现 `tool_use`，才能确定该文本是工具前过程还是最终回答；
- Hermes 普通 SSE 文本也需要等后续 tool event 或流结束才能定类。

因此采用向后兼容的分段生命周期：

```ts
type AssistantSegmentPayload = {
  segmentId: string;
  operation: "start" | "delta" | "commit";
  role: "pending" | "process" | "final";
  text?: string;
};
```

这个改动不升级数据库和协议版本。新事件是可选事实；Runtime 缺少新回调时只将 final 回退到 `onText`，Companion SSE 回放根据 final segment 合成带兼容标记的 `message.delta`。镜像 delta 不进入 Run Events 或 Session 正文，新版 Web 忽略镜像，旧消费者仍可读取 final。

### 3.2 可行性结论

| 维度 | 评估 | 说明 |
| --- | --- | --- |
| Provider 可识别性 | 可行 | Codex 有 phase；Claude 使用 pending + commit；Hermes Gateway 可输出工具事件，CLI fallback 为 final-only |
| 历史兼容 | 可行 | 新字段可选，旧 kind/zone 有确定性回退 |
| 数据迁移 | 不需要 | Runtime event 与 ChatPart 均为向后兼容扩展 |
| 前端复杂度 | 中等 | 需要 reducer 原位定类、一次性 revision、双序列 ViewModel |
| 滚动风险 | 中高 | final 收起和 disclosure 会改变高度，需现有 scroll intent 保护 |
| 性能风险 | 可控 | O(n) 聚合，折叠态不挂载重型详情 |
| 回滚风险 | 低 | 保留 legacy renderer，事实数据不分叉 |
| 安全风险 | 可控 | 工具载荷先脱敏、限深、限长，默认不挂载 |

### 3.3 未选择的方案

| 方案 | 不采用原因 |
| --- | --- |
| 始终只显示单行过程摘要 | 不满足运行中看到具体执行内容的目标 |
| 完成后把过程移动到结果下方 | 破坏 DOM/阅读顺序，产生布局重排 |
| 根据“我将/接下来”等关键词识别过程 | 多语言不可靠，会误判正常回答 |
| 只在 `run.finished` 收起 | final 已开始时过程仍占主视图，且 finish 会覆盖用户选择 |
| 将所有 Part 保持一条交错时间线 | 最终回答被工具和旁白打断 |
| 把整轮 reasoning 汇总成一个折叠区 | 脱离动作发生位置，破坏业务时间顺序并造成多次思考混合 |

---

## 4. 目标架构

```text
Codex / Claude / Hermes
        │
        ▼
runtime-core parser
  assistant_segment + tool_progress
        │
        ▼
Companion manager
  SSE 转发 + segment 缓冲 + canonical 隔离
        │
        ├── runtime store（Run Event 回放）
        └── session persistence（仅 final 写 assistantContent）
        │
        ▼
Web reducer
  segmentId 原位定类
  finalCollapseRevision 一次性收起
        │
        ▼
Turn ViewModel
  ├── ActivityViewModel / ProcessTimelineNode[]
  ├── Outcome
  ├── ResultItem[]
  └── Deliverables
        │
        ▼
AssistantMessageBubble
  ActivitySection → Outcome → ResultSequence → Deliverables
```

---

## 5. 工作包与实施状态

### A. 契约与 Runtime

目标：让三类 provider 产生一致的助手文本角色。

- [x] Contracts 新增 segment operation / role / payload。
- [x] Run Event schema 新增 `assistant.segment`。
- [x] Runtime `AgentStreamEvent` / callback 新增 assistant segment。
- [x] Adapter 缓冲 segment；没有新 callback 时只回退 final。
- [x] Codex commentary → process，其他 agent message → final。
- [x] Claude pending 文本在 tool_use 出现后 commit(process)，否则 final。
- [x] Hermes Gateway 工具前 commit(process)、流结束 commit(final)；CLI fallback 使用非交互 oneshot，只产生 final 或明确 error。

退出条件：process 不进入 canonical answer，final 文本不丢失、不重复。

### B. Companion 转发、持久化与回放

目标：实时和历史会话使用相同事实。

- [x] manager 转发 `assistant.segment`。
- [x] Runtime store writer 解析并保存 segment Run Event。
- [x] Session persistence 按 `segmentId` 缓冲文本。
- [x] commit 无文本时仍可从缓冲完成 final 写入。
- [x] 只有 final 未写入部分进入 `assistantContent`。

退出条件：重连/回放后角色和文本与实时流一致，无数据库迁移。

### C. Web Reducer 与 ViewModel

目标：过程、结果和 checkpoint 得到稳定分类与顺序。

- [x] `reduceAssistantSegment()` 按 segmentId 原位更新。
- [x] pending/process → narration/activity；final → text/result。
- [x] 旧 `reduceTextDelta()` 作为 final 兼容路径。
- [x] `finalCollapseRevision` 保证系统只收起一次。
- [x] `ProcessTimelineNode[]` 合并 narration、独立 reasoning、actions、checkpoint。
- [x] action occurrence 合并 running/success 与 command/tool 双记录。
- [x] ResultItem、Outcome 和 deliverables 与过程分离。

退出条件：原始 `message.parts` 不被修改；1000 Part 仍为 O(n) 级处理。

### D. 对话 UI 与状态

目标：实现用户确认的运行、final、完成复盘三态。

- [x] 运行中一级过程与 action details 默认展开。
- [x] final 首次出现自动收起并显示“已处理 + 耗时”。
- [x] 完成后重开显示业务时间线；动作组默认收起。
- [x] waiting_user / error / cancelled 保持展开。
- [x] checkpoint 复用现有 PartRenderer 和交互回调。
- [x] 可见 reasoning 按生命周期原位显示；技术详情保持独立、默认收起。
- [x] 过程摘要在最新运行消息内 sticky。
- [x] DOM 固定为过程、Outcome、结果、交付物。

退出条件：运行中无需点击即可看到具体动作，完成后最终回答连续可读。

### E. 响应式、无障碍与设置稳定

目标：避免新 disclosure 和 sticky 破坏原产品操作。

- [x] 原生 button、`aria-expanded`、`aria-controls` 与可读 label。
- [x] focus-visible 和至少 24px 操作目标。
- [x] reduced motion 停止旋转与非必要动画。
- [x] 390px 自动收起侧栏，移除主区固定 480px 最小宽度。
- [x] 设置 hydration 与 Agent 选择同步修复。

退出条件：桌面、窄桌面、移动端无遮挡、重叠和页面横向滚动。

### F. 文档与候选版

目标：代码、规格、版本号和发布说明表达同一套行为。

- [x] 统一版本为 `0.1.6-rc.2`。
- [x] 更新 PRD、更新说明、版本管理和文档中心。
- [x] 原独立旁白纠偏范围并入 0.1.6，后续 0.1.7 重新规划。
- [x] 更新消息分块、CLI 映射和过程展示规格。
- [x] 完成全部候选版自动门禁、Codex/Claude provider smoke，并记录 Hermes 外部 Provider 残余风险。
- [x] 完成本机 macOS arm64 解包候选构建与包内资源核对。
- [ ] 完成 release-gated macOS / Windows 候选包与内部长任务验收。

退出条件：自动门禁通过；外部发布阻断项有明确记录；不创建正式 tag。

---

## 6. 状态机与所有权

### 6.1 系统状态

`resolveTurnDisplayState()` 统一派生：preparing、running、restoring、waiting_user、complete、complete_empty、error、cancelled。

### 6.2 折叠所有权

| 信号 | 所有者 | 优先级 |
| --- | --- | --- |
| run started 默认展开 | 系统 | 低 |
| final 首次出现自动收起 | 系统 revision | 仅触发一次 |
| `user_expanded` / `user_collapsed` | 用户 | revision 触发后最高 |
| finish / replay / late delta | 系统 | 不覆盖用户选择 |
| waiting / error / cancelled 默认展开 | 状态策略 | 保护阻塞与错误可见性 |

`applyPartsStateToMessage()` 只在发现新的 `finalCollapseRevision` 时允许系统收起覆盖旧运行态状态。其余更新合并用户选择。

---

## 7. 数据与兼容不变量

1. 展示聚合函数不得原地修改 `message.parts`。
2. process 分段不得写入 canonical final answer。
3. final segment 的 delta + commit 不得产生两份正文。
4. commit 可不带文本，消费者必须按 segmentId 使用已缓冲内容。
5. 旧 `message.delta` 继续视为 final。
6. 缺少 `presentationRole` 时按 kind/zone 保守回退。
7. 未知 summary 内容继续显示；未知 activity 进入技术详情。
8. 回滚渲染器和新渲染器共享同一消息事实数据。
9. error / cancelled 不删除已生成正文、checkpoint 或 deliverables。
10. 技术详情隐藏不是安全边界，载荷必须先脱敏。

---

## 8. 滚动与性能策略

### 8.1 滚动

- `stream_growth`：仅在用户贴底时跟随。
- `user_disclosure`：展开/收起时保持触发控件的视口位置。
- `answer_reconcile`：final 替换 pending 时优先复用 Markdown 块锚点。
- disclosure 与 SSE 并发时，先保护用户锚点，再重新计算 pinned。
- sticky 过程条只在最新运行消息边界内工作。

### 8.2 性能

- ViewModel 聚合保持单次或有限次数线性遍历。
- 整体折叠态不挂载动作明细、reasoning、大型 JSON 和原始 output。
- 工具 input/output 只在用户打开技术详情后格式化。
- 1000 Part fixture 作为回归门槛。

---

## 9. 安全与无障碍

- 工具载荷递归脱敏 token、secret、cookie、authorization、私钥等字段。
- 限制对象深度、数组长度、字符串长度和二进制输出。
- disclosure 使用原生 button，不使用伪按钮 div。
- 键盘焦点顺序与 DOM 阅读顺序一致。
- 错误使用图标和文字，不仅使用颜色。
- focus-visible 对相邻状态具有足够对比。
- `prefers-reduced-motion` 下取消旋转和位移动画。
- 移动端路径、命令和长标题不能造成页面横向溢出。

---

## 10. 验证矩阵

### 10.1 纯函数与协议 fixture

- Segment start / delta / commit 与原位定类。
- Codex commentary/final、Claude tool 前文本、Hermes 工具边界。
- final 一次性收起与用户偏好。
- 旧 message.delta、content-only、旧 Parts。
- segment + 兼容 message.delta 在新版只渲染一次，纯旧 delta 仍正常渲染。
- narration/reasoning/actions/checkpoint 顺序与相邻 reasoning 生命周期分段。
- waiting/error/cancelled/complete_empty。
- command/tool 去重、跨阶段重复保留、1000 Part。
- 载荷脱敏和限长。

### 10.2 Web E2E

- 运行中全展开。
- final 开始自动收起一次。
- 完成后一级复盘和动作二级展开。
- 用户折叠偏好不被迟到事件覆盖。
- sticky 用户问题 + sticky 过程条。
- disclosure 滚动锚点。
- requirements、outline、clarification、simulation checkpoint。
- 390px 无页面横向滚动。
- 附件、工作区链接和长正文。

### 10.3 构建与 Provider

- `pnpm chat-activity:verify`
- Web lint / TypeScript / production build
- Contracts、Runtime Core、Companion、API、Desktop、Video typecheck/build
- `pnpm release:version:verify`
- legacy flag E2E
- Codex / Claude smoke
- Hermes / companion-any smoke（环境可用时）
- SSE 新旧事件、Run Events 无镜像、Session 与 canonical final 一致性
- 写作/PPT、3D、视频、推演结构化 UI 门禁
- macOS arm64 解包目录、版本、签名结构与包内资源核对

### 10.4 视觉矩阵

- 1440×900 桌面。
- 1024×768 窄桌面。
- 390×844 移动端。
- running、final streaming、complete review、waiting、error、cancelled。
- 长旁白、长路径、长命令、多个 checkpoint 和多个 deliverable。

---

## 11. 风险与控制

| 风险 | 影响 | 控制 |
| --- | --- | --- |
| Provider 无法及时确定角色 | 过程与 final 重复 | pending + segment commit 原位定类 |
| commit 不带文本 | final 丢失 | Runtime、Companion、Web 按 segmentId 缓冲 |
| finish 再次收起 | 用户交互失效 | `finalCollapseRevision` 一次性门控 |
| 过程聚合破坏顺序 | 复盘不可读 | ProcessTimelineNode 按 streamSeq 交错 |
| action details 过高 | 运行/历史占屏 | 运行中展开，完成复盘局部折叠 |
| final 收起引起跳动 | 阅读位置丢失 | disclosure/answer_reconcile 锚点策略 |
| 结构化 checkpoint 失去交互 | 业务流程阻断 | 复用 PartRenderer 与原回调 |
| 技术载荷泄密 | 本地截图或分享泄露 | 渲染前脱敏、限深、限长 |
| 旧历史渲染失败 | 升级不可用 | 确定性回退 + legacy renderer |
| 移动端宽度锁死 | 页面横向滚动 | 小屏侧栏折叠 + 主区 min-width 修复 |

---

## 12. 发布策略

1. `0.1.6-rc.2` 保持候选版，不创建正式 tag。
2. 自动门禁通过后，生成 macOS / Windows 内部候选包。
3. 使用 5～8 个真实长任务验证“运行可理解、结果好定位、复盘可追溯”。
4. 候选期只修复本范围缺陷，不新增业务能力。
5. 出现结果丢失/重复、异常状态隐藏、旧会话失败、结构化流程阻断、敏感载荷泄露、桌面候选包失败时阻断发布。
6. 正式验收后再统一从 `0.1.6-rc.N` 更新为 `0.1.6`，创建 tag 和发布产物。

---

## 13. 完成定义

`0.1.6` 对话过程改造完成必须同时满足：

- 运行中无需点击即可看到 AI 的业务过程和具体动作。
- final 出现时过程仅自动收起一次。
- 最终回答连续、完整、不重复。
- 完成后按真实业务顺序复盘，动作证据可二级展开。
- waiting、error、cancelled 保持可解释和可恢复。
- Codex、Claude、Hermes、旧协议与历史回放遵循同一前端规则。
- 桌面、移动、键盘、reduced motion 和滚动行为可用。
- 新旧路径可回滚，数据无需迁移。

本方案提升的是信息层级、可观察性和结果定位，不提升模型答案正确率或 CLI 本身能力。

---

## 14. `0.1.6-T02-T07` 执行记录

### 14.1 已完成

- Contracts / Runtime Event 支持可选 `streamSeq`，并兼容旧 Run Event。
- `tool.progress` 同时保留规范 `callId` 与历史 `toolCallId`，并持久化 input/output。
- Companion 在统一事件入口分配单调 `streamSeq`，SSE、Run Event 和 `part` 载荷保持同一序号。
- Read / Edit / Command / Tool 生命周期按 `callId` 原位更新；没有 `callId` 的旧事件只按同资源 running 动作保守回退。
- 强类型文件和命令 Part 保留 `callId`、`status` 与首个 `streamSeq`，错误/取消不再被当成成功。
- Bash command/tool 配对优先使用同一 `callId`，兼容旧资源匹配。
- 活动时间线 fixture 新增生命周期、并发逆序完成和重复资源场景。
- 连续 action group 只对相邻同资源 occurrence 做 run-length 聚合，`A → B → A` 保留三个时间位置。
- 跨资源聚合时清除不再唯一的代表 `callId`，避免把多个调用误识别为一个生命周期。
- Run Events 历史重放恢复完整业务时间线，`part.patch` 保留首次出现的时间位置。
- Session API 保存 `finalCollapseRevision`，历史重放不再覆盖用户折叠选择。
- 运行、final、完成复盘、waiting、error、cancelled 和移动端顺序通过 Web 验收。
- Provider smoke 校验严格递增且唯一的 `streamSeq`、工具 `callId` 生命周期、持久化 input/output，以及 SSE、Run Events、Run record、Session、canonical final 的一致性。
- Codex 0.144.3 的命令 `aggregated_output` 已映射为工具 output。
- Hermes 0.18.2 CLI fallback 改用非交互 oneshot；明确的 API 失败不再被误存为成功回答。

### 14.2 验证结果

- `pnpm contracts:build` 通过。
- `pnpm runtime-core:build` 通过。
- Companion 与 Web TypeScript 检查通过。
- `pnpm chat-activity:verify` 通过，71 个 fixture 全部通过。
- Chat Playwright 20 条全部通过；应用内浏览器确认完成态为 `complete / expanded=false`，过程位于最终回答之前。
- Codex 0.144.3 与 Claude Code 2.1.161 真实只读工具任务通过；工具 input/output、Run Events、Session 与 canonical final 一致。
- Hermes Agent 0.18.2 已验证 Gateway 不可用时进入 CLI fallback；外部 Provider 返回 HTTP 429，现按 `run.error` 保存和展示，不再伪成功。
- `pnpm release:version:verify` 通过，版本仍为 `0.1.6-rc.2`。

### 14.3 残余范围

`T05-T07` 的代码与可控回归已关闭。正式发布前仍需完成 5～8 个内部长任务、release-gated macOS/Windows 制品；Hermes 外部 Provider 恢复后补一条成功态真实回归，恢复前按 PRD 记录为残余风险。

---

## 15. 修订记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-07-14 | 初版：过程在上、结果在下 |
| v1.1-v1.4 | 2026-07-15 | 历史方案：单行摘要、ViewModel、滚动、回滚与候选门禁 |
| v1.5 | 2026-07-21 | 并入旁白可见性、运行展开、assistant.segment 与 checkpoint |
| v1.6 | 2026-07-21 | 移除冲突历史正文，冻结 0.1.6-rc.2 唯一有效方案与验收口径 |
| v1.7 | 2026-07-22 | 完成 T02/T03：统一 streamSeq/callId，修复动作生命周期重复与错误配对 |
| v1.8 | 2026-07-22 | 完成 T04：连续 action group 采用相邻资源聚合，修复 `A → B → A` 顺序破坏 |
| v1.9 | 2026-07-22 | 完成 T05-T07：历史回放、Web 20 条 E2E、Codex/Claude 真流通过；记录 Hermes 外部 Provider 风险并修正 fallback 错误语义 |

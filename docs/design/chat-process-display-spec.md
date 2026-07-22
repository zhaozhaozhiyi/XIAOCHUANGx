# 对话模块过程展示规格

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.2 |
| 创建日期 | 2026-05-23 |
| 最近修订 | 2026-07-21 |
| 状态 | **0.1.6-rc.2 已实施，候选验证中** |
| 关联 | [chat-message-parts.md](../technical/chat-message-parts.md)、[agent-cli-activity-mapping.md](../technical/agent-cli-activity-mapping.md)、[0.1.6 requirements](../product/requirements-0.1.6.md) |
| 适用范围 | Web 对话页、桌面壳对话页、Companion / Agent 运行过程 |
| 设计基准 | Open Design `openai`：内容优先、克制层级、单一强调色、清晰状态 |

---

## 1. 问题定义

旧对话虽然按事件到达顺序展示，但仍有四个核心问题：

1. 运行中常把具体读取、搜索和命令收起，用户看不到 AI 正在做什么。
2. 过程旁白、最终回答和结构化卡仅靠文本顺序猜测，可能重复或落错区域。
3. 完成态把结果与过程混排，长回答中难以快速定位最终结论。
4. 展开后按工具类型聚合，破坏“先读取、再编辑、最后验证”的业务时间顺序。

本规格的目标不是隐藏过程，而是让过程在正确的时间以正确的层级出现。

---

## 2. 体验目标

### 2.1 用户目标

1. 任务运行时，无需点击即可看到 AI 的业务说明和具体动作。
2. 最终回答出现时，界面自动把注意力交给结果。
3. 完成后重新展开，可按真实发生顺序复盘，而不是阅读按工具类型重排的日志。
4. 需要核查时，再展开某个动作组查看具体文件、命令、状态和载荷。
5. 等待、失败或取消时，原因、恢复动作和已有成果保持可见。

### 2.2 工程目标

1. 由协议明确 `pending / process / final`，不依赖关键词或最终完成事件猜测。
2. 过程时间线使用稳定的 `streamSeq`，并保留旁白、独立思考、动作、checkpoint 的交错关系。
3. 自动收起只发生一次，之后尊重用户手动选择。
4. 新旧消息无需数据迁移，并可用单一功能开关回滚。
5. 过程与结果 DOM 分离，视觉顺序、键盘顺序和屏幕阅读顺序一致。

### 2.3 非目标

- 不重做整个聊天页、侧栏或工作区。
- 不新增业务模块、Agent、CLI、Skill 或模型供应商。
- 不把隐藏 chain-of-thought 暴露为普通用户功能。
- 不用语言关键词猜测“这句话是不是过程”。
- 不在本版本增加全局“始终展开”设置。

---

## 3. 核心心智模型

助手 Turn 分为三层：

| 层级 | 回答的问题 | 默认策略 |
|------|------------|----------|
| 业务过程 | AI 正在/曾经做什么，为什么继续下一步；包括允许展示的思考摘要 | 运行中展开；final 出现后收起 |
| 最终结果 | 最终结论、建议和结构化结果是什么 | final 开始后连续可见 |
| 技术证据 | 具体文件、命令和工具 input/output | 运行中动作可见；完成复盘时局部折叠 |

业务过程不是“少展示一些日志”，而是一条按时间顺序组织的可阅读叙事：

```text
我先确认现有协议和消息模型。
  已读取 3 个文件

现有前端把所有文本都当成最终回答，我会补充角色协议。
  已编辑 4 个文件 · 已运行 2 条命令

[需求摘要 checkpoint]

我已经完成实现，正在运行回归。
  已运行 5 条命令
```

---

## 4. 稳定信息架构

单条 assistant 消息的 DOM 顺序固定为：

```text
1. 等待用户提示（仅 waiting_user）
2. 处理过程
3. Outcome（完成、空结果、失败或取消）
4. 最终回答 / 结构化结果
5. 交付物卡片
```

规则：

1. 过程始终位于最终回答上方，展开/收起不改变位置。
2. 最终回答内部连续，不被旁白、工具、reasoning 或命令打断。
3. deliverables / artifact 继续位于最终结果之后，不进入过程折叠层。
4. waiting_user 的动作提示在过程之前，保证用户第一时间知道需要介入。
5. error / cancelled 的 Outcome 位于已有部分结果之前，但不删除结果或交付物。

---

## 5. 状态行为

### 5.1 状态矩阵

| 状态 | 一级过程 | 动作明细 | 标题 | 设计意图 |
|------|----------|----------|------|----------|
| preparing | 展开 | 展开 | 处理过程 · 正在准备 | 不让空白等待 |
| running | 展开 | 展开 | 处理过程 · 当前阶段 / 动作摘要 / 耗时 | 实时可观察 |
| restoring | 展开 | 展开 | 处理过程 · 正在恢复 | 回放恢复可解释 |
| final 首次出现 | 自动收起一次 | 不挂载 | 已处理 · 耗时 | 把注意力交给结果 |
| complete | 保持一次性收起后的状态 | 完成复盘时默认收起 | 已处理 · 耗时 | 快速阅读结果 |
| waiting_user | 展开 | 展开 | 处理过程 · 等待你… | 阻塞不能隐藏 |
| error | 展开 | 展开 | 处理过程 · 失败摘要 | 保留排查依据 |
| cancelled | 展开 | 展开 | 处理过程 · 已中断 | 保留已完成部分 |
| complete_empty | 收束过程并显示 Outcome | 复盘时折叠 | 已处理 · 耗时 | 明确“没有结果”而非空白 |

### 5.2 一次性自动收起

自动收起的触发条件是**首个确定为 final 的分段开始**，不是 `run.finished`：

1. 运行开始时过程展开。
2. 首个 final segment 或旧 `message.delta` 到达时，`finalCollapseRevision` 增加一次并收起。
3. 后续 final delta、tool finish、run finish、回放事件不得再次收起。
4. 用户在此后展开或收起时，其选择保持权威。
5. error / cancelled / waiting_user 的状态规则可让过程重新保持可见。

这样既保证用户能看到完整执行过程，也避免最终回答已经开始后过程持续占据主阅读面。

---

## 6. 过程时间线

### 6.1 节点类型

| 节点 | 内容 | 展示形式 |
|------|------|----------|
| narration | 业务进展、已确认信息、下一步 | 直接正文；超长时段内展开 |
| reasoning | provider 允许展示的本次思考摘要 | 独立业务说明；不得与前后思考合并 |
| actions | 连续读取、搜索、命令、编辑和其他工具 | 聚合摘要 + 动作证据 |
| checkpoint | requirements、需求摘要、outline、simulation 阶段产出 | 原业务组件，保留交互能力 |

### 6.2 顺序规则

1. 四类节点合并后按 `streamSeq` 排序。
2. 连续动作仅在两条业务说明或 checkpoint 之间聚合。
3. 不把整轮所有 read、search、edit、command 分别搬到一起。
4. 同一动作的 running / success / error 生命周期合并为一个 occurrence。
5. 同一文件跨阶段再次读取或编辑仍分别保留，避免丢失复盘语义。
6. checkpoint 留在产生它的时点，不进入 final result 与其争夺结果位置。

### 6.3 过程旁白要求

旁白应是供应商明确标注或通过结构化工具边界确定的业务文本，建议回答：

- 我刚确认了什么；
- 这意味着什么；
- 下一步做什么。

不展示无业务增量的连接状态、run id、skill slug、原始 accepted/requesting 等内部字段。narration 与 reasoning 保留各自 Part 身份，但在同一业务时间线中按发生位置阅读。

---

## 7. 动作证据层级

### 7.1 运行中

运行时用户明确要求看到具体在做什么，因此：

- 一级过程默认展开；
- action group 的具体资源/命令默认展开；
- running 状态持续更新，不新增重复行；
- 错误动作使用图标与文字共同表达，不只依赖颜色；
- 未完成动作保留 spinner，但 reduced-motion 下停止旋转。

### 7.2 完成后复盘

用户点击“已处理”重新展开时：

- narration、reasoning 和 checkpoint 直接显示；
- action group 先显示“已读取 3 个文件 · 已运行 2 条命令”；
- 具体文件名、命令和状态默认折叠；
- 用户点击该动作组后展开二级证据；
- 工具原始 input/output 继续留在“技术详情”。

这对应用户参考图中的两级阅读：先看“AI 做了哪些步骤”，再按需看“读取了哪些文件、运行了哪些命令”。

---

## 8. 摘要条与文案

### 8.1 运行态

格式：`处理过程 · 当前阶段 / 高优先动作摘要 / 耗时`

示例：

- `处理过程 · 正在核对消息协议 · 已读取 3 个文件 · 42 秒`
- `处理过程 · 正在运行回归 · 已运行 5 条命令 · 1 分 12 秒`
- `处理过程 · 等待你选择目录`

### 8.2 final / 完成态

格式：`已处理 · 耗时`

完成态不再在摘要条堆叠全部动作计数。动作摘要属于展开后的业务时间线，主条只承担状态和入口职责。

### 8.3 响应式取舍

- 摘要片段按业务优先级选择，不拼完整长句后做 CSS 截断。
- 桌面最多显示主要四项；移动端保留最高优先两项。
- 最终回答开始后只保留耗时，避免“已处理”条与正文争夺注意力。
- 长单词、路径和命令不得撑破容器；具体值在二级证据中换行或截断。

---

## 9. 思考与技术详情

provider 明确输出且允许展示的每次 reasoning 生命周期属于业务说明，必须在发生位置形成独立时间线节点。过程底部只保留一个“技术详情”入口：

| 入口 | 内容 | 默认 |
|------|------|------|
| 技术详情 | Skill、原始 status、工具 input/output、调试时间线 | 收起 |

要求：

1. reasoning start/delta/end 只合并当前生命周期；下一次 start 必须新建节点。
2. reasoning 与前后 actions 按 `streamSeq` 原位交错，不生成整轮汇总块。
3. 不将隐藏 chain-of-thought 或技术详情描述为“业务过程”。
4. 折叠时不挂载大型 JSON 或工具 output。
5. 所有载荷在进入 React 前完成敏感字段遮盖、限深和限长。

---

## 10. 结构化业务卡与交付物

### 10.1 Checkpoint

以下结构化 Part 默认视为过程 checkpoint：

- clarification；
- writing / ppt / 3d / video / simulation requirements；
- 各模块 requirement summary；
- writing / ppt / 3d / video outline；
- simulation scenario / summary / next action / suggestion。

checkpoint 通过现有 `PartRenderer` 渲染，提交、继续、草稿和大纲确认回调必须继续工作。

### 10.2 最终结果

`text` / `summary` 以及真正的结果型结构化 Part 进入 `ResultSequence`。相同 final segment 原位更新，不能同时显示 provisional 和 canonical 两份答案。

### 10.3 交付物

`artifact` / `deliverables` 规范化路径后去重，并固定在结果序列之后。即使过程收起，交付物也始终直接可见。

---

## 11. 滚动与 Sticky

1. 最新运行消息的过程摘要条在该消息边界内 sticky。
2. sticky 用户问题与过程条组成动态堆叠，不遮挡顶栏，也不跨入下一 Turn。
3. 用户展开/收起过程、动作组、长业务说明或技术详情时，触发控件保持在原视口位置。
4. final 协调造成正文替换时，优先复用 Markdown 块锚点；找不到锚点再回退像素补偿。
5. SSE 增长和用户 disclosure 同时发生时，先保护用户阅读位置，再恢复 pinned 判断。

---

## 12. 视觉与无障碍要求

基于 Open Design `openai` 方向，沿用项目现有组件与 token：

- 内容层级通过留白、字重和低噪音 hairline 建立，不新增装饰卡片或渐变。
- 产品 UI 保持 sans 字体与零字距；过程正文使用正常阅读行高。
- 颜色以中性背景和文本为主，强调色只用于焦点或关键状态。
- 卡片圆角不超过现有设计系统约束；不嵌套装饰卡。
- disclosure 使用原生 `<button>`，提供 `aria-expanded`、`aria-controls` 和可读 label。
- 键盘 `focus-visible` 明确可见；最小操作目标为 24×24 CSS px。
- `prefers-reduced-motion: reduce` 下取消旋转、位移和非必要过渡。
- 1440×900、1024×768、390×844 均不得出现遮挡、文本重叠或横向页面滚动。
- 小于 768px 自动收起侧栏，聊天主区不能保留固定 480px 最小宽度。

---

## 13. 兼容与回滚

- 新路径默认启用 `CHAT_ACTIVITY_V2_ENABLED`。
- 设置为 `false` 时切换到 `LegacyAssistantMessageBubble`，恢复 0.1.5 交错时间线。
- 功能开关只改变渲染器，不改变 SSE、消息存储、Parts 或 canonical output。
- 旧 content-only、旧 `message.delta` 和缺少 `presentationRole` 的历史 Parts 使用确定性回退。
- 未知 summary 保守显示；未知 activity 进入技术详情，不能静默丢弃。

---

## 14. 验收场景

### 场景 A：正常长任务

1. 运行开始，过程与动作全部展开。
2. 旁白、独立思考、读取、编辑、checkpoint 和命令按真实顺序出现。
3. 首个 final 到达，过程自动收起并显示“已处理 · 耗时”。
4. 用户展开过程，看到业务时间线；动作细节默认收起。
5. 用户展开某动作组，看到具体文件/命令。
6. 后续 finish 或迟到事件不改变用户选择。

### 场景 B：等待用户

过程保持展开，等待原因与可执行动作位于消息最前；此前动作、部分结果和交付物保留。

### 场景 C：错误或取消

过程与动作明细保持展开；Outcome 解释发生了什么；已生成结果和交付物继续显示。

### 场景 D：历史与旧协议

content-only、旧 Parts 和 `message.delta` 能正常渲染；无需迁移；关闭功能开关可恢复旧 UI。

### 场景 E：Provider 边界

- Codex commentary 为 process，final message 为 result；
- Claude 工具前文本由 pending 原位提交为 process；
- Hermes 工具前文本为 process，结束文本为 final；
- 三者均不得把过程旁白拼入 canonical final answer。

---

## 15. 发布门槛

- Activity / Turn / parser / segment fixture 全部通过。
- Web chat E2E 覆盖运行展开、一次性收起、完成复盘、sticky、移动端和结构化 checkpoint。
- Web lint、TypeScript 和 production build 通过。
- Contracts、Runtime Core、Companion、API、Desktop 和 Video 的类型检查/构建通过。
- `CHAT_ACTIVITY_V2_ENABLED=false` 的 legacy E2E 通过。
- Codex、Claude 真实或 soft smoke 有明确结果；Hermes 无环境时记录残余风险。
- 三档视口完成视觉评审；无页面横向溢出。
- `git diff --check` 与版本一致性检查通过。
- RC 验收前不创建正式 `v0.1.6` 标签。

---

## 16. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-23 | 结果优先、过程折叠的初版方向 |
| v1.1 | 2026-07-21 | 0.1.6-rc.2：运行全展开、final 一次性收起、业务时间线与动作二级证据 |
| v1.2 | 2026-07-21 | 可见 reasoning 按生命周期独立分段并原位进入业务时间线 |

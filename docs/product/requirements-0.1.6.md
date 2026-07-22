# 小窗 XIAOCHUANGx 0.1.6 版本边界

| 属性 | 定义 |
| --- | --- |
| 目标版本 | `0.1.6` |
| 版本名称 | Desktop Alpha 对话结果与过程体验收口版 |
| 当前基线 | `v0.1.5` |
| 当前状态 | `0.1.6-rc.3` 修复真机回归阻断项，进入候选验证 |
| 核心规格 | [`docs/technical/chat-timeline-contract-v1.md`](../technical/chat-timeline-contract-v1.md) v1.0；实施细节见 [`docs/plans/chat-process-collapse-implementation-plan.md`](../plans/chat-process-collapse-implementation-plan.md) |
| 发布形态 | Web 对话体验 + Electron Desktop 安装包；monorepo 统一版本号 |
| 协议策略 | 向后兼容扩展 `assistant.segment`；不升级数据库或破坏旧事件 |
| 预计实施 | 8～12 个工程日，另预留 2～3 个工作日做候选版验证 |

---

## 1. 版本定义

`0.1.6` 的过程与结果输出必须遵守冻结版 [会话业务时间线标准与事件协议](../technical/chat-timeline-contract-v1.md)。该标准定义事件语义、生命周期、保序聚合、历史回放和 UI 折叠边界；本文件只定义版本范围，不再重复解释 provider 的事件顺序。

`0.1.6` 只解决一个系统级问题：

> 把助手消息从“过程、思考、工具和结果混在一起的技术时间线”，收束为“上方可追溯过程、下方连续结果”的稳定阅读结构。

它是 `0.1.5` 对话运行态展示补强的下一步，不是新的业务模块版本：

- `0.1.5` 已让运行状态、工具状态和桌面交互更清楚。
- `0.1.6` 完成整条 assistant Turn 的信息架构、折叠层级、去重、滚动稳定和结果定位。
- `0.1.6` 不扩展模型能力、CLI 能力、工作区媒体能力或六大业务模块能力。

对用户最直接的完成效果：

```text
处理过程 · 运行中                                              [收起]
  我先读取设计约束，再运行现有验证。
  已读取 3 个文件 · 已运行 4 条命令

已处理 · 42 秒                                                 [展开]

最终回答正文

交付物 / 截图 / 文件
```

运行中直接看到业务时间线与动作证据；最终回答开始时过程自动收起一次。完成后重新展开时，动作证据默认收起，继续点击才显示具体文件、命令和工具载荷。

---

## 2. 版本目标

### 2.1 用户目标

1. 完成后可以立即定位最终结论，不再穿过大段工具日志和“思考”卡片。
2. 运行中无需额外点击即可看见 AI 正在做什么，而不只是一个抽象阶段名。
3. 需要核查时，可以按真实发生顺序追溯旁白、读取、搜索、运行、修改和阶段产出。
4. 错误、中断、等待确认和空结果不会被折叠隐藏。
5. 展开、收起和最终正文替换不会把阅读位置强行拉走。

### 2.2 工程目标

1. 用向后兼容的 `assistant.segment` 打通 Runtime、Companion、SSE、持久化、重放和 Web 展示；不要求数据库迁移。
2. 用纯 ViewModel 统一分类、状态、去重、阶段和结果选择规则。
3. 保留原始 `message.parts`，展示聚合不破坏历史证据。
4. Codex、Claude Code、Hermes、Mock、旧历史会话和推演模块继续可用。
5. 新旧渲染路径可通过单一功能开关回切。

### 2.3 非目标

`0.1.6` 不承诺提升回答正确率、推理质量或 CLI 执行能力。它提升的是结果可读性、过程可追溯性、交互稳定性和长任务体验。

---

## 3. 必须交付范围

以下内容全部属于 `0.1.6` 发布必需项。缺少任一核心链路，不应以正式 `v0.1.6` 标签发布。

### 3.1 Turn 展示模型

- 新增统一 `TurnDisplayState`，覆盖 preparing、running、waiting_user、complete、complete_empty、error、cancelled、restoring。
- 新增有序 `ResultItem[]`，保留 summary zone 中正文、图片、大纲、引用和结构化卡片的业务顺序。
- 区分 provisional 与 final answer；完成态优先使用 canonical final，没有时回退 parts/content。
- 新增 `ActivityOccurrence`，把 running/success 生命周期和 command/tool 双记录还原成真实动作。
- 新增 `ActivityEpisode`，阶段间保留时序，阶段内聚合重复文件、命令和工具动作。
- 新增 `ProcessTimelineNode[]`，按 `streamSeq` 交错保留 narration、独立 reasoning 说明、连续动作组和业务 checkpoint。
- 新增 `assistant.segment` 的 `start | delta | commit` 生命周期与 `pending | process | final` 展示角色。
- 全局摘要按唯一资源计数；跨 Episode 的同一资源不得在一级展开态被误删。
- 未知 summary 内容保守显示，未知 activity 内容进入技术详情。

### 3.2 助手消息信息架构

- DOM 顺序固定为：等待用户提示 → 处理过程 → Outcome → 结果序列 → 交付物。
- running、preparing、restoring、waiting_user、error、cancelled 默认展开；final 开始时系统只自动收起一次。
- 完成态标题显示“已处理 + 耗时”；用户重新展开后，动作组默认收起并可逐组查看证据。
- 一级展开显示按真实流顺序生成的业务时间线，不按 read/search/edit/command 类型重新排序。
- 二级技术详情默认收起，包含 Skill、原始状态、工具 input/output 和调试时间线。
- 最终正文连续显示，不被 narration、reasoning、文件或命令行打断。
- artifact 与 deliverables 按规范化路径去重，正式交付物仍位于结果之后。

### 3.3 过程摘要与展开体验

- 摘要支持读取、图片、搜索、编辑、命令、失败和耗时等语义片段。
- 响应式摘要按状态优先级取舍，不能先拼整句再盲目截断。
- 一级展开保留“先读取、再编辑、再验证”的阶段顺序。
- 有效 narration 与 provider 允许展示的 reasoning 摘要作为一级业务说明显示；每次 reasoning 生命周期独立成段，不跨动作汇总，超长说明可在段内二次展开。
- requirements、需求摘要、outline 和推演阶段产出作为 checkpoint 保留在业务时间线中。
- 同一步骤内的重复动作显示次数；跨步骤的再次读取或编辑分别保留。
- 大量 Episode 和动作使用局部 disclosure，不能无限撑高整条消息。

### 3.4 状态与错误体验

- waiting_user 必须由现有信号统一派生，不修改 `ChatMessage.status` 枚举。
- error、cancelled、complete_empty 在部分结果之前显示明确 Outcome。
- 中断和错误保留已生成正文、结构化内容和交付物。
- 普通非阻断 error Part 不得错误地把整轮任务判定为失败。
- final 开始触发一次性系统收起；此后的 SSE、finish、error、cancel 和历史事件重放不得覆盖用户手动折叠偏好。

### 3.5 滚动与运行态可见性

- `useChatScrollPin` 区分 stream_growth、user_disclosure、answer_reconcile 三类布局变化。
- 用户展开/收起过程、技术详情或工具详情时，触发控件保持在原视口位置。
- disclosure 与 SSE 同时发生时，用户布局意图优先，结束后重新测量 pinned 状态。
- `pending` 文本可在原位置提交为 `process` 或 `final`；provisional/final 协调优先恢复可复用 Markdown 块锚点。
- 最新运行消息的过程摘要在消息范围内 sticky，不跨越消息边界。
- sticky 过程摘要与现有 sticky 用户问题组成动态堆叠，不得重叠或遮住顶栏。

### 3.6 安全、性能与可访问性

- 技术载荷在渲染和复制前完成敏感字段遮盖、限深、限长和二进制摘要。
- summary 模式不挂载完整过程、reasoning、JSON 或工具 output。
- 未展开工具卡不能提前 `JSON.stringify` 大型 input/output。
- Activity 聚合目标复杂度为 O(n)，1000 个 Part 不应造成明显输入或滚动阻塞。
- disclosure 使用原生 button、ARIA、键盘操作和明确 focus-visible。
- 支持 reduced motion；桌面、窄桌面和 390px 移动宽度无溢出、遮挡和文本重叠。

### 3.7 兼容与回归

- Codex CLI 正常显示命令、阶段、最终正文和文件动作。
- Claude Code 正常显示 Read/Edit/Bash，并将每次允许展示的 reasoning 生命周期原位显示。
- Hermes Gateway 成功态、无 canonical output 回退和 CLI 失败态均可形成稳定时间线。
- Mock / simulate 与真实流遵循同一 UI 规则。
- 旧 content-only 和旧 parts 历史会话无需迁移即可回放。
- requirements、outline、clarification、simulation 等 AI-to-UI 交互卡继续工作。
- 推演模块继续使用 `ActivityProcessList(ChatPart[])`，不被主聊天 Episode UI 替换。

### 3.8 规格与发布材料

- `chat-process-collapse-implementation-plan.md` 作为实现主规格。
- 同步修订 `chat-message-parts.md`、`chat-process-display-spec.md` 和 `agent-cli-activity-mapping.md` 中的冲突描述。
- 新增 `docs/release-notes/0.1.6.md`，使用面向用户的语言描述最终交付，不把计划项写成已完成功能。
- 发布时同步版本管理文档、文档中心、桌面说明和所有系统版本号。

---

## 4. 明确不纳入 0.1.6

以下内容即使与对话相关，也必须延后到 `0.1.7`、`0.2.0-beta` 或独立评审，不得在实施过程中顺手加入：

### 4.1 协议与运行时

- 允许新增向后兼容的 `assistant.segment` SSE / Run Event，旧消费者可继续使用 `message.delta` 和既有 Parts。
- 允许 Codex、Claude、Hermes parser 只为识别 `process` / `final` 边界做局部修改；允许为兼容已安装 CLI 版本修正非交互参数，但不得借此改变 Provider、模型或权限策略。
- 不修改数据库结构，不要求历史消息迁移，不增加 canonical output 必填字段。
- 不提升 `CHAT_PARTS_PROTOCOL_VERSION`，新增字段保持可选并提供旧事件回退。
- 不在 reducer 源头删除 Bash command + tool 双记录。
- 不新增 Agent、CLI、MCP、Skill 或模型供应商。

### 4.2 新产品能力

- 不新增写作、PPT、3D、视频、推演或数据分析业务能力。
- 不新增工作区文件类型、媒体预览、编辑器或交付格式。
- 不新增 Web Sandbox、云 Runtime、多用户、后台或协作能力。
- 不新增默认展开设置、开发者模式设置或全局聊天外观设置。
- 不把 raw reasoning / chain-of-thought 建设成普通用户功能。

### 4.3 桌面与发布基础设施

- 不改 Electron 主进程、窗口管理、托盘、自动更新协议和 Companion supervisor，除非发现阻断 `0.1.6` 打包的回归。
- 不在本版本解决签名、公证、更新源接入或首次启动引导。
- 不升级 Electron、Next.js、React、Playwright 或其他大依赖。
- 不新建遥测后端；已有遥测入口可接事件，没有时使用本地测量和候选版可用性测试。

### 4.4 视觉扩张

- 不重做整个聊天页、侧栏、工作区或设计系统。
- 不复制参考产品的品牌、字体、颜色或大卡片样式。
- 不用模型生成过程摘要，不维护中文/英文关键词表猜测过程句。
- 不把整轮 reasoning 汇总成脱离时序的大区块，也不在一级展开态平铺原始工具载荷；业务说明必须可见。

---

## 5. 系统模块边界

`0.1.6` 是全系统统一版本号，但不是每个模块都发生业务变化。

| 模块 | 0.1.6 允许变化 | 0.1.6 禁止扩张 |
| --- | --- | --- |
| Web | 对话 ViewModel、组件、样式、滚动、测试、前端功能开关 | 新业务模块、全局重设计 |
| Desktop | 嵌入新 Web 构建、统一版本号、现有打包回归 | 主进程新功能、更新器改造、签名公证项目 |
| Companion | 转发、持久化和重放 `assistant.segment`；统一版本号 | 数据库迁移、无关路由扩张 |
| Contracts | 新增可选 segment 字段和 Run Event；统一包版本 | 破坏旧 ChatPart / Run Event 解析 |
| Runtime Core | provider 分段角色识别与缓冲；统一包版本 | 编排、Skill、canonical output 新能力 |
| API | 统一版本号和现有构建回归 | 数据库/API 新能力 |
| Video | 统一版本号 | Remotion 新功能或视频链路扩张 |
| Simulation | 主聊天改造后的兼容回归 | 推演画布或世界模型新功能 |

如果某个非 Web 模块必须发生业务修改，必须先证明它是 `0.1.6` 核心体验的发布阻断项，并在本文件“边界变更记录”中说明原因和影响。

---

## 6. 数据与兼容不变量

1. `message.parts`、canonical output 和历史 Run Event 不被展示聚合函数原地修改。
2. 不做数据迁移，不创建新数据库字段，不要求用户清空历史会话。
3. 旧会话在新版本中至少保持原内容可见；未知 activity 可降级到技术详情。
4. 没有 canonical final 时，宁可保守显示 provider 的 text/summary，也不能靠语言规则误删回答。
5. 技术详情的隐藏不是安全边界，任何 raw payload 都必须先脱敏再进入 React。
6. 功能开关只切换渲染路径，两条路径共享同一份消息事实数据。
7. 回滚到旧渲染器或 `0.1.5` 不需要恢复数据。
8. 新事件只增加可选事实；旧历史没有 `segmentId` / `presentationRole` 时使用既有 zone、kind 与状态回退。

---

## 7. 功能开关与灰度边界

### 7.1 单一开关

- 使用统一前端配置 `CHAT_ACTIVITY_V2_ENABLED`。
- 禁止在多个组件中分别读取环境变量或维护不同默认值。
- 开关只影响 assistant Turn 渲染器，不影响消息生成、SSE、持久化和 CLI。

### 7.2 启用策略

| 阶段 | 默认值 | 目的 |
| --- | --- | --- |
| 开发环境 | 开启 | 完成功能与视觉验证 |
| 内部候选版 | 通过测试配置切换新旧路径 | 对比结果定位、展开行为和滚动稳定性；不新增用户设置入口 |
| `v0.1.6` 正式构建 | 开启 | 默认交付新体验 |
| 紧急回滚 | 关闭 | 无数据迁移地恢复 `0.1.5` 渲染路径 |

旧渲染器在 `0.1.6` 中必须保留。最早可在 `0.1.7` 且新路径稳定一个完整版本后删除，删除时同时移除临时开关。

### 7.3 指标边界

- 有现成遥测时，只上报状态、数量桶、耗时桶、视口桶和锚点结果枚举。
- 禁止上报正文、文件路径、命令、reasoning、工具载荷和交付物内容。
- 没有现成遥测平台时，不因建设新后端扩大 `0.1.6`；用 Playwright 测量、内部任务测试和人工记录完成发布判断。

---

## 8. 实施工作包

| 工作包 | 交付内容 | 预计时间 | 退出条件 |
| --- | --- | --- | --- |
| A. 规则冻结与 Fixture | 文档对齐；Codex、Claude、Hermes、Mock 样本 | 0.5 天 | 规则无冲突，样本覆盖重复与状态场景 |
| B. 协议与展示模型 | assistant.segment、TurnDisplayState、ResultItem、Occurrence、业务时间线、脱敏、纯函数测试 | 2.5～3.5 天 | provider 到 Web 可验证分段、分类、顺序和聚合 |
| C. 消息 UI 重组 | ActivitySection、EvidenceList、Outcome、ResultSequence、技术详情 | 1.5～2 天 | 默认一行，展开分层，结果连续 |
| D. 状态与滚动 | 偏好持久化、sticky 堆叠、scroll intent、final anchor | 1.5～2 天 | SSE/finish 不覆盖偏好，展开和协调不跳动 |
| E. 兼容与质量 | 性能、安全、可访问性、推演与结构化卡回归 | 1～1.5 天 | 长任务、旧会话和共享组件无回归 |
| F. 候选版与发布 | E2E、截图、CLI 回归、桌面包、可用性测试、发布材料 | 1.5～2.5 天 | 全部发布门槛通过 |

总工程量维持在 8～12 个工程日。候选版验证和修复缓冲不用于增加功能。

建议按工作包提交，避免一个 PR 同时混入协议、工作区或模块功能。

---

## 9. 测试与验收矩阵

### 9.1 自动化必测

- Activity ViewModel 的 38 组以上纯函数 Fixture。
- Web ESLint、TypeScript、production build。
- Chat Playwright：默认态、展开态、技术详情、状态、滚动、移动端和历史回放。
- requirements、outline、clarification、simulation 结构化流程回归。
- 1000 个 Activity Part 的计算和渲染压力样本。
- payload 脱敏与长度限制测试。
- Desktop macOS ad-hoc 测试包与 Windows NSIS 测试包构建。

### 9.2 CLI 与来源矩阵

| 来源 | 必须验证 |
| --- | --- |
| Codex | command/tool 视觉去重、文件动作、最终结果 |
| Claude Code | Read/Edit/Bash、独立 reasoning 生命周期、tool 前 provisional text |
| Hermes | 无 canonical 回退、未知工具降级 |
| Mock | 状态与 UI 行为和真实流一致 |
| 历史会话 | content-only、旧 parts、Run Event 重放 |

真实 CLI 不可用时，结构化 Fixture 仍是硬门槛；最终候选版至少要在实际可用的 Codex、Claude 和 Hermes 环境各完成一条代表性任务。Provider 暂时不可用时必须记录为残余风险，不能声称完成真实回归。

### 9.3 视觉矩阵

- 1440×900 桌面。
- 1024×768 窄桌面。
- 390×844 移动宽度。
- 长用户问题、附件、sticky 用户问题与过程摘要同时出现。
- 运行中、完成、等待、错误、中断、空结果。
- 1、12、100、1000 个 Activity Part。
- final 比 provisional 更长、更短、完全不同。

---

## 10. 正式发布门槛

### 10.1 功能门槛

- 运行中业务时间线和动作证据默认展开；最终回答开始后过程自动收起一次。
- 完成态只占一行过程高度；重新展开后按真实顺序显示业务时间线，动作证据二次展开。
- waiting_user、error、cancelled、complete_empty 不被隐藏。
- 用户折叠偏好在 SSE、finish、刷新和事件重放后保持。
- 展开、收起、sticky 和 final 协调无可复现的强制跳底或内容遮挡。
- 交付物与结构化 AI-to-UI 卡片功能无回归。

### 10.2 质量门槛

- lint、typecheck、build、相关 E2E 和纯函数 Fixture 全部通过。
- 1000 Part 样本无明显主线程阻塞或输入卡顿。
- 技术载荷没有可复现的敏感字段明文展示。
- 桌面、窄桌面、移动宽度无文本重叠、横向页面滚动或 sticky 冲突。
- Codex、Claude、Hermes、Mock 和旧历史来源按 9.2 完成或明确记录残余风险。

### 10.3 用户收益门槛

- 5～8 名内部用户完成长任务测试，能判断“是否仍在运行、当前阶段、最终结果在哪里”。
- 相同结果长度下，过程区域完成态高度明显低于旧渲染器。
- 没有证据表明 waiting_user 完成率、错误恢复或下一步操作时间明显劣化。
- 有遥测时按核心规格第 21 节执行量化门槛；无遥测时保留可复现的任务脚本、截图和人工记录。

### 10.4 发布阻断项

出现以下任一情况，不得创建正式 `v0.1.6` 标签：

1. 最终回答丢失、重复或被误收进技术详情。
2. waiting_user、错误或中断状态不可见。
3. 用户展开过程后页面稳定复现跳底、抖动或控件遮挡。
4. 旧会话无法打开，或原始 Parts 被展示逻辑修改。
5. 任一技术详情可以直接暴露已知 token、secret、cookie 或私钥。
6. requirements、outline、simulation 等现有交互流程被阻断。
7. macOS ad-hoc 候选包或 Windows NSIS 测试候选包构建失败。
8. 系统版本号不一致，或 tag 与 Desktop 包版本不一致。

普通像素级差异、低频文案润色和不影响任务完成的次要样式问题可以记录到 `0.1.7`，不得在候选版阶段无限延长范围。

---

## 11. 候选版与发布流程

### 11.1 候选版

1. 完成工作包 A～E，冻结功能范围。
2. 将全部系统版本统一设置为当前候选 `0.1.6-rc.2`；后续候选递增为 `0.1.6-rc.3`，不得混用 `0.1.5` 和 RC 版本。
3. 通过 workflow dispatch 的 release 模式生成 macOS / Windows 内部候选包，不创建正式 tag；本轮 macOS 使用 ad-hoc 测试签名，Windows 使用未接正式证书的 NSIS 测试制品。
4. 候选包默认开启新渲染器，同时保留测试配置关闭开关以做新旧对比；不新增面向用户的设置项。
5. 完成自动化、真实 CLI、历史会话、移动宽度和内部可用性验证。
6. 候选期只修复版本内缺陷，不接受新功能。

### 11.2 发布提交中的版本同步

候选版先将以下版本从 `0.1.5` 统一更新为 `0.1.6-rc.N`；验收通过后的正式发布提交再统一更新为 `0.1.6`：

- 根 `package.json`
- `web/package.json`
- `api/package.json`
- `companion/package.json`
- `apps/desktop/package.json`
- `apps/video/package.json`
- `packages/contracts/package.json`
- `packages/runtime-core/package.json`
- `companion/src/config.ts` 中的 `PACKAGE_VERSION`

同时更新：

- `docs/product/versioning.md` 的当前平台版本与下一小版本目标。
- `docs/README.md` 的当前版本说明。
- `apps/desktop/README.md` 的桌面版本说明。
- `docs/release-notes/README.md` 索引。
- 新增 `docs/release-notes/0.1.6.md`。
- `.gitignore` 对 `docs/release-notes/0.1.6.md` 的精确跟踪例外。

不在边界规划阶段提前修改上述运行版本号。只有进入候选版构建时才使用 `0.1.6-rc.N`，避免尚未验收的代码对外自称正式 `0.1.6`。

### 11.3 Tag 与制品

1. 发布提交合入 `main`，确认工作区干净、版本一致。
2. 创建 annotated tag `v0.1.6` 并推送。
3. Tag 触发 `.github/workflows/desktop-build.yml` release-gated 构建。
4. 核对 macOS DMG、Windows NSIS、blockmap 和 latest yml 的版本均为 `0.1.6`。
5. GitHub Release 保持 draft，完成人工安装与启动检查后再发布。
6. Release notes 使用 `docs/release-notes/0.1.6.md` 的用户可见摘要。

### 11.4 当前候选版签名策略

- `0.1.6-rc.3` 只面向内部安装验证，不以公开分发信誉作为验收目标。
- macOS 接受 ad-hoc 测试签名，不要求 Developer ID、hardened runtime 或 Apple notarization。
- Windows 接受 electron-builder 生成的 NSIS 测试制品，不要求 Authenticode 证书或 SmartScreen 信誉。
- 正式签名、公证、证书保管和 SmartScreen 信誉建设作为后续独立发布工作，不阻断本轮 RC3 测试结论。
- 测试记录必须明确说明制品未正式签名，不能把测试包描述为可公开分发的正式安装包。

---

## 12. 回滚边界

### 12.1 前端快速回滚

- 关闭 `CHAT_ACTIVITY_V2_ENABLED`，恢复 `0.1.5` 交错时间线渲染器。
- 回滚不修改消息数据，不需要清理缓存、数据库或历史会话。
- 如果仅技术详情存在安全问题，可以先禁用技术详情入口，不必关闭整个新布局。

### 12.2 安装包回滚

- 正式包出现阻断问题时，撤回 `0.1.6` Release 的公开状态，恢复分发 `0.1.5` 制品。
- 修复版本使用 `0.1.6-patch` 不符合 SemVer；应发布 `0.1.7`，紧急候选可使用 `0.1.7-rc.1`。
- 因本版本没有协议或数据迁移，安装包降级不会产生结构性数据不兼容。

---

## 13. 变更控制

### 13.1 允许进入版本的追加修复

只有以下情况可以在边界冻结后追加：

- 导致崩溃、数据丢失、结果不可见或任务无法继续的缺陷。
- 新布局直接引入的安全、隐私、可访问性或严重性能问题。
- 新布局导致 Codex、Claude、Hermes、历史会话或推演模块不可用。
- 阻断 macOS / Windows 打包和安装的回归。

### 13.2 必须延后的内容

- 与核心对话体验无关的“顺手优化”。
- 新设置、新入口、新业务卡片、新媒体格式或新模块能力。
- 协议清理、reducer 清理、parser 清理和依赖升级。
- 候选版阶段出现但不影响完成任务的视觉偏好争议。

### 13.3 边界变更记录

如果必须改变本文件的“明确不纳入”项，先记录：

| 日期 | 变更 | 原因 | 风险 | 决策人 |
| --- | --- | --- | --- | --- |
| 2026-07-21 | 将旁白可见性与 `assistant.segment` 并入 `0.1.6-rc.2` | 仅靠 Web 猜测无法稳定区分过程与最终回答；运行中单行摘要不满足业务过程可读性 | provider 兼容与旧事件回放 | 产品与技术评审通过 |

没有记录的范围扩张不属于 `0.1.6`。

---

## 14. 完成定义

`0.1.6` 完成不等于“过程可以折叠”。它必须同时满足：

1. 默认结果易找。
2. 运行状态不丢。
3. 展开过程有时序、有聚合、可追溯。
4. 技术详情安全且不抢占注意力。
5. 等待、错误、中断和空结果完整。
6. 滚动、移动端和可访问性稳定。
7. 旧会话、CLI、结构化卡片和推演模块兼容。
8. 新路径可灰度、可观测、可快速回滚。
9. 全系统版本号、Tag、安装包和发布说明一致。

版本边界的最终一句话是：

> `0.1.6` 只为对话结果与处理过程的系统级收口增加向后兼容的分段事件，不借此扩展模型能力、工作区或业务模块。

---

## 15. `0.1.6-rc.2` 执行记录

### 15.1 已完成

- assistant Turn 已固定为“处理过程、Outcome、最终结果、交付物”的稳定层级；运行中过程展开，final 开始后一次性收起。
- `assistant.segment` 已贯通 Codex、Claude、Hermes、Companion 持久化/重放与 Web reducer。
- ActivityOccurrence、ProcessTimelineNode、状态推导、结果协调、旧历史兼容和技术载荷脱敏已落地。
- `stream_growth`、`user_disclosure`、`answer_reconcile` 三类滚动意图及 Markdown 块级锚点已落地。
- `CHAT_ACTIVITY_V2_ENABLED=false` 已通过生产构建和 legacy Playwright，可无数据迁移恢复 0.1.5 交错时间线。
- 71 个纯函数/parser fixture 与 20 条 chat Playwright 已通过；覆盖独立 reasoning 生命周期、完整历史回放、异常态展开、原位时间顺序和移动端布局。
- 新版 Companion SSE 会从 final `assistant.segment` 合成带兼容标记的 `message.delta`；新版 Web 忽略镜像，Run Events 不持久化镜像，纯旧 delta 仍按 final 渲染。
- Codex 0.144.3 与 Claude Code 2.1.161 真流和持久化闭环通过。Hermes Agent 0.18.2 的 Gateway 降级、oneshot 和错误闭环已验证；外部 Provider HTTP 429 导致成功态真流仍按 9.2 记录为残余风险。写作/PPT、3D、视频、推演结构化 UI 门禁通过。
- 8 个 package 与 Companion 运行版本已统一为 `0.1.6-rc.2`，版本一致性检查已接入桌面 workflow。
- 本机 macOS arm64 解包候选构建通过，`Info.plist`、ad-hoc 签名结构、Web bundle、Companion bundle 与 Skills 资源一致。

### 15.2 正式发布前待完成

- 由 5～8 名内部用户完成真实长任务可用性记录，并核对用户收益门槛。
- 使用 release secrets 在 workflow dispatch 中生成 macOS/Windows release-gated 候选包。
- 完成 macOS 签名/公证、Windows NSIS 安装、首次启动、升级/降级和回滚开关人工检查。
- 正式发布提交将全部版本从 `0.1.6-rc.2` 更新为 `0.1.6`；在此之前不创建 `v0.1.6` tag。

### 15.3 当前结论

`0.1.6-rc.2` 已完成代码、回滚与本机 Provider 门禁，尚未达到正式发布标准。Windows 制品、正式签名/公证和内部用户收益验证属于外部发布门槛，不能用本机自动化结果替代。

---

## 16. `0.1.6-rc.3` 验证记录

### 16.1 本轮修复

- Codex 未标注 phase 的 `agent_message` 改为 `pending`，在后续动作或 Turn 终态原位提交为 `process` / `final`，不再把过程说明误判为最终回答。
- Desktop 内嵌 Web 固定使用 `127.0.0.1:51247`，新 Origin 首次启动从 Companion 恢复最近 24 小时、最多 50 个会话入口。
- Companion 晚于 Web 就绪时自动重试 Agent 探测；Hermes 终端失败在 Web reducer 中保持幂等，只形成一个失败节点。
- 默认工作文件夹中的只读终端命令不再把被读取或不存在的路径误判为交付物，也不会因没有生成文件而把成功任务改判为失败。

### 16.2 验证结果

- 75 个纯函数/parser fixture 与 23 条 Chat Playwright 全部通过。
- Codex 0.144.3 安装版四步只读任务按“过程说明 → 动作 → 结果 → 下一步说明 → 最终回答”原序输出，最终回答开始后自动收起为 4 条命令、1 项失败。
- Claude Code 2.1.161 四步只读真流通过；四个过程段分别在对应工具动作前占据原始时间位置，最后一段单独提交为 final。
- Hermes Agent 0.18.2 已通过 GitHub Copilot Provider 完成 Gateway 成功态和四工具真实任务；工具生命周期完整，SSE 与 Run Events 顺序一致，Session 正文与 canonical final 一致。Hermes 0.18.2 Gateway 不提供工具 input/output，界面不得从 label 或最终回答伪造载荷。
- macOS arm64 安装版正常退出并重启后，Web 仍绑定固定端口 `51247`，Companion 为 `0.1.6-rc.3`，近期任务入口和 Codex 已完成任务均恢复。
- 75 个 fixture、23 条 Chat Playwright、Web/Companion/Desktop TypeScript、Web ESLint、production build、版本一致性和 Desktop Web bundle smoke 已通过。

### 16.3 当前结论

`0.1.6-rc.3` 已消除本轮 macOS 安装版验证发现的代码阻断，并完成 Hermes 成功态环境验证。当前剩余门槛是 Windows NSIS 测试制品、最新 macOS ad-hoc 安装版真机复验和 5～8 名内部用户收益验证。正式签名、公证与 SmartScreen 信誉已按产品决策后移，不阻断本轮候选版。

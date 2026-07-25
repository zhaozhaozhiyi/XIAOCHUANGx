# 小窗 XIAOCHUANGx 0.2.0 版本规划

> 状态：**产品与架构规划草案，范围尚未冻结**
> 建立日期：2026-07-24
> 首个预发布版本：`0.2.0-beta.1`
> 版本主题：**统一任务、任务模板与多交付物工作台**

## 0. 版本定位

`0.2.0` 将小窗从“多个模块分别创建会话”升级为“围绕一个目标持续工作的统一任务系统”。

用户可以在同一个任务中先完成文稿，再基于已有内容制作 PPT、视频或 3D 交付物；系统保留同一任务的对话、文件、模板应用、运行记录和交付物关系，并根据当前交付阶段打开对应工作台。

本版本建立在 [`requirements-0.1.7.md`](./requirements-0.1.7.md) 已完成的 Skill 按需编排之上：

- `0.1.7` 负责每个 Run 如何选择和加载 Skill；
- `0.2.0` 负责任务、交付阶段、模板、交付物和工作台如何组织；
- `0.2.0` 可以给 `SkillSelectionDecision` 增加 `taskId/stageId`，但不重新实现 Skill Registry、加载器或 Agent 事件。

## 1. 决策看板

| 编号 | 议题 | 当前状态 |
|------|------|----------|
| `D00` | 一个任务允许连续使用不同模板并产生多种交付物 | **已确认（2026-07-23）** |
| `D01` | 左侧一级入口收敛为“新建任务 / 模板 / 推演” | 待产品审核 |
| `D02` | 模板页使用“全部 / 写作 / PPT / 视频 / 3D”分类 | 待产品审核 |
| `D03` | 输入框加号菜单增加“选择模板” | 待交互审核 |
| `D04` | 模板是产品配置，Skill 是执行实现；绑定复用 `0.1.7` Registry | 待产品与架构共同确认 |
| `D05` | 写作、PPT、视频、3D 退出一级导航；推演保留 | 待产品审核与原型验证 |
| `D06` | 从指定消息、交付物或任务状态创建派生任务 | 候选范围，待独立审核 |

### 1.1 范围分层

| 范围 | 内容 | 发布承诺 |
|------|------|----------|
| 核心基础 | Task/Conversation/DeliveryStage/Artifact 数据模型、旧 session 迁移、持久化权威源 | 必须完成 |
| 核心体验 | 统一模板 Catalog、模板应用、多交付阶段和工作台恢复 | T00 确认后进入版本 |
| 信息架构 | 新建任务、模板、推演及旧路由兼容 | D01/D05 原型通过后进入版本 |
| 候选增强 | 派生任务、上下文分叉和来源文件引用 | D06 单独确认后才进入版本 |

如果 D01-D05 未在范围冻结日前确认，`0.2.0` 不得一边保留旧模块模型、一边局部实现新任务模型后仓促发布；应缩减为内部数据迁移里程碑或顺延版本。

`D06` 未确认或未完成不阻塞核心版本发布。

## 2. 当前问题

现有产品以 `ChatSessionRecord.surfaceModuleId` 固定会话所属模块：

- 写作、PPT、视频分别维护模板/Skill 选择和 `localStorage` 状态；
- Web 侧会话索引、Companion 消息、SessionRuntime 和 Run 记录分散保存；
- 一个 session 只能稳定对应一个模块工作台；
- 文稿转 PPT、PPT 转视频等连续流程缺少统一的阶段和交付物关系；
- 当前分支会话只继承项目和模块，Handoff 摘要会伪装成新的 user 消息；
- 模板、Skill、模块入口和工作台概念在部分界面中混用。

### 2.1 必须纳入迁移的现有事实

| 现有数据或行为 | `0.2.0` 处理 |
|----------------|----------------|
| `ChatSessionRecord` 和 `surfaceModuleId` | 迁移为 Task + 主 Conversation + 初始 DeliveryStage |
| `jlc-chat-history-index` | 只作为迁移源；迁移成功后由新任务索引接管 |
| 写作/PPT/视频模板 `localStorage` | 转换为 TemplateApplication 或阶段默认偏好 |
| Companion sessions/messages | 关联到主 Conversation，不复制消息内容 |
| SessionRuntimeRecord | 迁移或映射到 Task/Stage Runtime 状态 |
| Run records 和 session run index | 增加 task/stage 关联，保留原 runId |
| 旧 `/chat`、`/writing`、`/ppt`、`/video`、`/3d` 路由 | 保持深链接可用并重定向到对应任务/模板入口 |
| 现有模块模板 Catalog | 合并为统一 Template Catalog 的迁移源 |

不能只设计新对象而忽略上述存量数据，也不能要求用户清空 localStorage 或重新创建历史会话。

## 3. 产品原则

### 3.1 任务是目标容器

一个 Task 围绕同一目标持续工作，不被某一种模板或文件格式永久限定。

```text
Task：新能源汽车行业路演
  ├── Conversation：持续对话与决策
  ├── DeliveryStage：行业研究文稿
  │   ├── Runs 1..n
  │   └── Artifacts：report.md / report.docx
  ├── DeliveryStage：路演演示
  │   ├── Runs n+1..m
  │   └── Artifacts：deck.html / deck.pptx
  └── DeliveryStage：讲解视频
      └── Artifacts：video-project / video.mp4
```

确定原则：

- 写作、PPT、视频和 3D 是生产能力或交付阶段，不是互斥的任务身份；
- 选择新模板是在当前任务中新增一次模板应用，不覆盖已有成果；
- 一个任务可以有多个未完成阶段，但只有一个前台活跃阶段；
- 查看历史交付物不等于激活其生产阶段；继续编辑时才恢复阶段；
- Skill 按当前 Run 和 DeliveryStage 选择，不永久绑定 Task；
- 只有用户明确要求拆分工作时才创建派生任务。

### 3.2 模板不是 Skill

模板是用户可理解的任务配置，定义任务目的、推荐工作台、期望交付物和建议 Skill；Skill 是 Runtime 执行工作流。

用户选择模板时：

1. 记录 TemplateApplication；
2. 创建或选择对应 DeliveryStage；
3. 用户发送消息后才创建 Run；
4. `0.1.7` Selector 根据模板建议、模块基座和任务内容形成最终 Skill 决定；
5. 未选中的候选 Skill 不读取正文，也不显示为已加载。

模板不得直接持有 Agent Prompt 正文，也不得把 `recommendedSkillSlugs` 当成已加载事实。

### 3.3 推演保留独立能力

推演维护世界模型、变量关系、Round、路径、干预、回放和画布状态，不只是生成一种文件。因此推演可以继续拥有独立一级入口和领域状态模型。

推演产生的报告、图表或其他交付物仍可作为 Task Artifact 被引用；推演内部路径分支不等于任务派生。

## 4. 信息架构候选

> 本节必须经过可点击原型和现有用户任务测试后才能冻结。

建议一级结构：

```text
小窗
[ + 新建任务 ]

模板
推演

────────
最近任务 / 今天 / 过去 7 天 / 项目分组
```

候选规则：

- “新建任务”替代“新建对话 / 新建写作 / 新建 PPT / 新建视频”等一级动作；
- 写作、PPT、视频、3D 不再占用一级导航，但仍有专门工作台；
- 旧模块路由继续可访问，并转换为带预选模板或阶段类型的新任务入口；
- 最近任务按项目分组，不按单一模块永久分组；
- 任务列表可显示当前活跃阶段和主要交付物，但不堆叠全部内部状态。

### 4.1 原型验证任务

至少用以下任务验证新导航：

1. 从空白任务开始写一份报告；
2. 直接从 PPT 模板开始制作演示；
3. 在已有报告任务中新增 PPT；
4. 返回三天前的视频任务并继续编辑；
5. 打开旧 `/writing/{sessionId}` 深链接；
6. 创建和恢复一次推演。

如果用户完成单一写作或 PPT 任务所需步骤明显增加，必须调整入口，而不是为了统一概念牺牲高频效率。

## 5. 统一模板系统

### 5.1 模板页候选

固定分类候选：

```text
全部 | 写作 | PPT | 视频 | 3D
```

约束：

- 默认进入“全部”；
- “空白任务”固定在全部首位，不绑定业务 Skill；
- 分类只筛选模板，不创建产品模块；
- 卡片展示名称、用途、主要交付格式和适用工作台；
- 不展示 slug、Prompt、Runtime 等内部实现；
- 当前模板数量不足时不增加搜索；达到 T00 设定阈值后再加入搜索；
- 模板页覆盖 loading、empty、error、populated 和长标题/大量模板状态。

### 5.2 输入框模板选择

候选菜单：

```text
添加内容
  照片
  文件

任务设置
  选择模板
```

行为：

- 选择后不立即执行；
- 输入框上方显示可移除、可替换的模板标签；
- 发送消息后才创建 TemplateApplication 和 Run；
- 新任务首次选择可直接创建初始阶段；
- 已运行任务选择新类别模板时新增阶段，不覆盖原对话和交付物；
- 同类别替换模板时必须明确是更新当前阶段还是新建阶段；
- 模板页和输入框复用同一个 Catalog 和选择状态。

### 5.3 `TaskTemplateV1`

| 字段 | 含义 |
|------|------|
| `templateId` / `version` | 稳定标识和配置版本 |
| `name` / `summary` | 用户可见名称和用途 |
| `category` | writing、ppt、video、3d 或 general |
| `defaultWorkbenchType` | 默认打开的工作台 |
| `artifactTypes` | 预期交付格式 |
| `recommendedSkillSlugs` | 候选 Skill，不代表已加载 |
| `requiredCapabilities` | 所需领域服务或本地工具 |
| `starterPrompt` | 可编辑的任务起始提示，不是系统 Prompt |
| `preview` | 模板预览资产 |
| `migrationAliases` | 旧 templateId 和路由别名 |

统一 Template Catalog 的初始展示数据来自现有模板资产和 `0.1.7` 生成 Registry 的 bindings 投影。`WRITING_TEMPLATE_SKILL`、`PPT_SKILL_CATALOG`、`VIDEO_SKILL_CATALOG` 和 3D 默认流程只作为 `0.1.7` 迁移输入；`0.2.0` 不得重新维护第二套 templateId 到 Skill 映射。

## 6. 数据模型

### 6.1 `TaskRecord`

| 字段 | 含义 |
|------|------|
| `taskId` | 稳定任务标识 |
| `projectId` | 所属工作区或项目 |
| `title` | 任务标题 |
| `primaryConversationId` | 主对话记录；`0.2.0` 保持一对一 |
| `stageIds` | 全部交付阶段 |
| `activeStageId` | 当前前台生产阶段；最多一个 |
| `artifactIds` | 全部交付物 |
| `activeArtifactId` | 当前查看或编辑的交付物 |
| `templateApplicationIds` | 历次模板应用 |
| `parentTaskId` | 可选，派生来源任务 |
| `schemaVersion` | 数据结构版本 |
| `createdAt` / `updatedAt` | 创建和更新时间 |

### 6.2 `ConversationRecord`

| 字段 | 含义 |
|------|------|
| `conversationId` | 稳定对话标识；旧会话迁移时优先沿用 sessionId |
| `taskId` | 所属任务 |
| `messageStoreRef` | Companion 消息存储引用 |
| `runIds` | 任务内 Run 顺序 |
| `contextState` | 压缩、Handoff 和上下文版本信息 |
| `createdAt` / `updatedAt` | 创建和更新时间 |

### 6.3 `DeliveryStage`

| 字段 | 含义 |
|------|------|
| `stageId` / `taskId` | 阶段及所属任务 |
| `category` | writing、ppt、video、3d 或其他能力分类 |
| `workbenchType` | 使用的工作台 |
| `status` | selected、active、suspended、blocked、completed、cancelled |
| `templateApplicationIds` | 本阶段的模板应用 |
| `runIds` | 本阶段 Run |
| `artifactIds` | 本阶段交付物 |
| `lastSkillDecisionId` | 最近一次 Skill 选择决定 |
| `createdAt` / `updatedAt` | 创建和更新时间 |

阶段状态：

```text
selected → active → suspended → active
active → blocked → active
selected/active/suspended/blocked → completed | cancelled
```

单次 Run 或 Skill 加载失败只让阶段进入 blocked，不直接结束阶段。用户只查看历史产物时仅修改 `activeArtifactId`；继续编辑或发送该阶段任务时才修改 `activeStageId`。

### 6.4 `TemplateApplication`

| 字段 | 含义 |
|------|------|
| `applicationId` / `taskId` / `stageId` | 应用、任务和阶段标识 |
| `templateId` / `templateVersion` | 使用的模板及版本 |
| `selectedInRunId` | 首次发送对应模板的 Run |
| `recommendedSkillSlugs` | 当时的候选快照 |
| `artifactTypes` | 期望交付格式 |
| `status` | selected、applied、replaced、failed、cancelled |
| `appliedAt` | 应用时间 |

### 6.5 `ArtifactRecord`

至少包含：

- `artifactId/taskId/stageId/runId`；
- `artifactType/workbenchType`；
- `path/mime/label/contentHash`；
- `sourceArtifactIds`；
- `status` 和创建/更新时间。

Artifact 关系必须来自 Runtime 真实交付物事实，不通过文件名猜测任务阶段。

## 7. 迁移策略

### 7.1 权威存储

`0.2.0` 必须明确 Companion 是 Task、Conversation、Stage、Artifact 和 Run 关系的持久化权威源。Web localStorage 只保留可重建的 UI 偏好和短期缓存，不再承担主任务索引。

### 7.2 旧会话迁移

每个旧 `ChatSessionRecord` 默认迁移为：

```text
TaskRecord.taskId = 旧 sessionId（无冲突时）
ConversationRecord.conversationId = 旧 sessionId
DeliveryStage = 根据 surfaceModuleId 创建一个初始阶段
```

规则：

- chat 会话可以暂不创建阶段，直到首次产生明确交付物工作流；
- writing/ppt/video/3d 会话创建对应类别初始阶段；
- simulation 会话保留推演领域状态，并建立可引用的 Task 外壳；
- 原消息、runId、文件路径和 canonical output 不复制；
- 旧模板偏好转换为 TemplateApplication 或阶段默认值；
- 迁移必须幂等，可中断后重试；
- 迁移失败的单个会话进入可恢复队列，不阻断其他任务打开；
- 迁移前生成版本化索引备份，回滚不修改用户工作区文件。

### 7.3 路由兼容

- 旧深链接解析 sessionId 后跳转到对应 Task 和工作台；
- 找不到迁移记录时触发单会话惰性迁移；
- 历史收藏和桌面最近打开链接不得失效；
- 兼容期保留旧路由解析器至少一个完整版本；
- 新 URL 不暴露内部 `DeliveryStage` 实现术语。

## 8. 多交付物工作流

标准场景：

1. 用户在一个任务中生成行业研究文稿；
2. 用户选择路演模板；
3. 系统挂起文稿阶段，新建并激活 PPT 阶段；
4. PPT Run 通过 `0.1.7` Selector 加载对应 Skill；
5. 原文稿作为 PPT 的来源 Artifact；
6. 用户返回文稿只查看时不激活写作 Skill；
7. 用户选择“继续编辑文稿”后恢复写作阶段；
8. 任务历史中仍显示一个 Task，同时保留文稿和 PPT。

并发约束：

- 同一 Task 只允许一个前台 activeStageId；
- 后台导出可以继续，但不得覆盖前台阶段的 Skill 状态；
- 每个 Run 固定关联一个 stageId；
- 并发 Run 的事件按现有 Run 顺序保存，任务级展示规则在 T01 契约中冻结；
- 阶段切换必须原子更新 activeStageId 和两个阶段状态。

## 9. 派生任务候选

> `D06` 未确认前不进入核心实施任务。

派生任务是从当前任务的指定消息、交付物或任务状态创建的独立 Task，不等于新增模板或 DeliveryStage。

候选行为：

1. 用户选择“基于此内容新建任务”；
2. 创建面板列出任务名称、来源消息、交付物和文件；
3. 系统幂等创建子 Task 和独立 Conversation；
4. 消息锚点只继承锚点及之前的逻辑历史；
5. 继承内容显示为只读来源历史或系统 Handoff，不伪装成新 user 消息；
6. 父子任务互相显示来源并可跳转；
7. 后续消息、Run、阶段和交付物完全独立。

### 9.1 `TaskDerivationRecord`

| 字段 | 含义 |
|------|------|
| `derivationId` / `childTaskId` | 派生关系和子任务 |
| `parentTaskId` / `parentConversationId` | 来源任务和对话 |
| `sourceAnchorType` | message、artifact 或 task |
| `sourceAnchorId` | 来源锚点 |
| `forkedFromMessageId` | 消息分叉点 |
| `sourceRunId` | 可选来源 Run |
| `sourceArtifactIds` | 继承的交付物 |
| `contextSnapshotId` | 创建时上下文快照 |
| `handoffSummary` | 目标、决策、成果、开放问题和来源摘要 |
| `workspaceMode` | same-project 或受支持时 isolated |
| `clientRequestId` | 创建重试幂等标识 |
| `createdAt` | 创建时间 |

文件默认作为只读来源引用并记录路径与 hash；小型文本可以快照，大型视频和 3D 文件默认不复制。来源变化时必须显示可恢复错误，不静默改读其他文件。

## 10. 交互状态与可访问性

- 导航、模板列表、模板选择器、阶段切换和迁移提示覆盖 loading、empty、error、populated 和 edge 状态；
- 加载超过 15 秒显示耗时较长及取消/重试路径；
- Tabs、菜单和对话框使用正确语义、键盘导航、Escape 关闭和焦点返回；
- 图标按钮有可访问名称和 tooltip，不只用颜色表达状态；
- 窄窗口、200 字标题、大量模板、多个交付物和来源丢失时不遮挡关键操作；
- 创建或迁移失败保留用户输入、模板选择和来源选择；
- 阶段、交付物和模板文案使用用户语言，不展示内部 schema、slug 或 Runtime 术语。

## 11. 实施任务

| 任务 | 内容 | 进入条件 |
|------|------|----------|
| `0.2.0-T00` | 产品 IA、核心流程原型、范围冻结和迁移 Spike | 本规划评审启动 |
| `0.2.0-T01` | Task/Conversation/Stage/Artifact 契约和 Companion 存储 | D00/D04 确认，迁移 Spike 通过 |
| `0.2.0-T02` | 旧 session、runtime、run index 和模板偏好迁移 | T01 完成 |
| `0.2.0-T03` | 统一 Template Catalog 和 TemplateApplication | D02-D04 确认 |
| `0.2.0-T04` | 统一新建任务、模板入口和旧路由兼容 | D01/D05 原型通过 |
| `0.2.0-T05` | 多交付阶段、工作台恢复和 Artifact 关系 | T01-T03 完成 |
| `0.2.0-T06` | `0.1.7` Skill 决定接入 taskId/stageId | T01/T05 完成 |
| `0.2.0-T07` | 状态覆盖、可访问性、性能和桌面 E2E | T02-T06 完成 |
| `0.2.0-T08` | 派生任务和来源文件引用 | D06 单独确认；不阻塞核心 RC |
| `0.2.0-T09` | Beta 制品、迁移演练、升级/降级报告 | 核心 T01-T07 完成 |

推荐顺序：

```text
T00 → T01 → T02/T03 → T04/T05 → T06 → T07 → T09
                                      └→ T08（候选并行，不阻塞核心）
```

## 12. 验收场景

| 场景 | 预期 |
|------|------|
| 新建空白任务 | 创建 Task + Conversation，不提前创建业务阶段或加载 Skill |
| 从 PPT 模板新建 | 创建 PPT 阶段和模板应用，发送后才运行 |
| 报告任务新增 PPT | 原阶段挂起，新阶段激活，两类交付物都保留 |
| 查看旧文稿 | 只改变 activeArtifactId，不激活写作 Skill |
| 继续编辑旧文稿 | 原写作阶段恢复为 active |
| 旧 writing 会话升级 | 消息、文件、runId 和深链接保持可用 |
| 迁移中断后重启 | 幂等继续，不重复 Task、Stage 或 Artifact |
| 模板配置升级 | 历史 TemplateApplication 保留当时版本快照 |
| 推演任务 | 推演状态、Round 和画布不退化，可引用交付物 |
| 两个并发 Run | 不互相覆盖 stageId 或 Skill 决定 |
| 回滚到兼容版本 | 用户工作区文件不受影响，迁移备份可用于恢复索引 |
| 从消息派生（若 D06 纳入） | 只继承锚点前上下文，父子后续独立 |

## 13. 发布门禁

- 迁移：准备覆盖 chat、writing、ppt、video、3d、simulation 的真实脱敏样本；
- 数据：迁移前后消息数、runId、交付物路径和项目绑定一致；
- 幂等：重复迁移和网络重试不创建重复记录；
- 路由：旧深链接、最近打开和模块入口全部有兼容路径；
- Skill：每个 Run 的 taskId/stageId 与 `0.1.7` 决定和事件一致；
- UI：核心任务在窄窗口和键盘模式可完成；
- E2E：空白任务、模板任务、多交付物、阶段恢复、迁移失败和回滚；
- Release：macOS 和 Windows 分别完成全新安装、`0.1.7` 升级、降级和数据恢复演练；
- Beta：至少一轮内部用户完成“报告 → PPT”连续任务，并记录耗时、错误和概念理解问题。

## 14. 非目标

`0.2.0` 不包括：

- 多人实时协作或云端任务同步；
- Task 内多个独立 Conversation；
- 通用工作流自动化画布；
- 在线 Skill/Template 商店；
- 自动把所有历史文件猜测为 Artifact；
- 推演领域模型重写；
- Git Worktree 等工程术语直接暴露给普通业务用户；
- 未经 D06 审核自动从模板切换创建派生任务。

## 15. 风险与处理

| 风险 | 处理原则 |
|------|----------|
| 统一入口增加高频任务步骤 | 原型验证并保留模板直达入口 |
| localStorage 与 Companion 数据不一致 | Companion 成为权威源，迁移有版本和冲突报告 |
| 数据模型一次改动过大 | T01/T02 先完成存储和迁移，不与导航同批上线 |
| 多阶段状态混乱 | 单 activeStageId、原子切换和 Run 固定 stageId |
| 模板和 Skill 再次耦合 | TemplateApplication 只保存候选，选择事实由 `0.1.7` Runtime 产生 |
| 历史深链接失效 | 兼容解析器、惰性迁移和至少一版本保留期 |
| 派生任务拖慢核心版本 | T08 独立门禁，不阻塞 T09 |
| 回滚导致新记录不可读 | 版本化索引备份、只增不改用户文件、升级/降级演练 |

## 16. T00 必须回答的问题

1. 左侧是否确定只保留“新建任务 / 模板 / 推演”；
2. 写作、PPT、视频和 3D 是否全部退出一级导航，是否保留快捷入口；
3. 模板分类、卡片信息和搜索启用阈值；
4. 已运行任务选择同类别新模板时，是替换当前阶段还是默认新建阶段；
5. Companion Task Store 的格式、事务和迁移失败恢复方式；
6. 旧 sessionId 是否可以直接复用为 taskId/conversationId；
7. 推演与 Task 外壳的关系及旧推演数据迁移；
8. D06 派生任务是否进入 `0.2.0`，还是顺延 `0.2.1`。

上述问题、核心原型和迁移 Spike 未通过前，`0.2.0` 只处于规划状态，不生成全量开发承诺。

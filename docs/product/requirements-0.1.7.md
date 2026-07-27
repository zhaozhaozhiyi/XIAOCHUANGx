# 小窗 XIAOCHUANGx 0.1.7 版本规划

> 状态：**正式发布冻结版；T00-T07B 与双平台发布验收全部完成**
> 建立日期：2026-07-23
> 修订日期：2026-07-25
> 产品确认日期：2026-07-24
> 版本主题：**业务 Skill 按需选择、按需加载与真实状态展示**

## 0. 版本决策

`0.1.7` 只解决一个问题：

> 普通对话不再默认遍历、读取和注入业务 Skill；只有用户明确指定、现有模板或模块确定绑定、同一会话明确继续上一工作流，或高置信意图规则命中时，Companion 才选择并加载对应 Skill。

统一任务入口、任务模板库、多交付物阶段、工作台切换、一级导航调整和派生任务已经拆分到 [`requirements-0.2.0.md`](./requirements-0.2.0.md)，不再作为 `0.1.7` 候选范围，也不构成 `0.1.7` 的隐含依赖。

这里的“模板工作”特指统一 Template Catalog、统一模板页、TemplateApplication 和相关任务模型。`0.1.7` 仍消费现有模块传入的 `templateId` 作为 Skill 选择事实，但不重建模板产品系统。

### 0.1 发布范围

| 范围 | `0.1.7` 是否包含 |
|------|------------------|
| 普通对话零业务 Skill 启动 | 是 |
| Companion 持有唯一 Skill Registry 和选择权 | 是 |
| 现有写作、PPT、视频、3D、推演模块确定性绑定 | 是 |
| 现有模块 `templateId` 到 Skill 的确定性映射 | 是 |
| 用户通过结构化选择或“动作 + 准确 slug”显式指定 Skill | 是 |
| 少量高置信、可测试的规则意图匹配 | 是 |
| 同一会话内受约束的工作流延续 | 是 |
| Skill 正文与 Agent Kit 延迟加载 | 是 |
| Skill 选择、可用和失败事件及历史回放 | 是 |
| 统一任务、DeliveryStage、多交付物模型 | 否，转入 `0.2.0` |
| 左侧导航和统一模板页改造 | 否，转入 `0.2.0` |
| 从消息或交付物派生新任务 | 否，转入 `0.2.0` 候选范围 |

### 0.2 架构决策变更

此前 `hybrid-steer` 使用“默认 QA Skill + Catalog 摘要 + Agent 自行 Pull”的方式。`0.1.7` 明确将其替换为：

> **Companion 确定性选择 + 选中后延迟 Push。**

原因：当前 Agent 并没有统一、可靠的平台 Skill Pull 接口；继续把 Catalog 放入 Prompt 会增加 token，并让 Codex、Claude、Hermes 分别推断是否读取 Skill，无法形成一致的选择事实。

本决策必须同步更新 [`chat-skill-orchestration-analysis.md`](../technical/chat-skill-orchestration-analysis.md)、`skills:verify` 和相关运行时说明；旧文档中的 `hybrid-steer` 不再是 `0.1.7` 完成后的量产默认路径。

## 1. 当前问题

当前通用对话每次 Run 都会：

1. 把 `skill-qa` 设为默认 `processSkill`；
2. 把 `skill-platform-research-norms` 设为横切 Skill；
3. 读取 `chat-catalog.json`，并对 chat 范围条目调用 `loadSkill`；
4. 把两个默认 Skill 正文和 Catalog 摘要放入 Prompt；
5. CLI 模式下创建本 Run 的 Agent Kit 目录；
6. 在实际加载结果产生前显示“正在加载 Skill 与运行环境…”。

现有 `loadSkill` 已有进程缓存，所以主要问题不是热路径磁盘耗时，而是：

- 普通问答仍携带与任务无关的业务指令和 Catalog；
- Web 与 Companion 都参与 Skill 决策，责任重复；
- 不同 Agent 可能根据 Catalog 做出不同选择；
- UI 展示的 Skill 状态不一定对应真实读取和注入事实；
- 当前 `skills:verify` 验证的是旧默认注入行为，不能作为新架构门禁。

### 1.1 当前实现锚点

| 代码位置 | 当前事实 | `0.1.7` 处理 |
|----------|----------|----------------|
| [`chat-catalog.ts`](../../packages/runtime-core/src/chat-catalog.ts) | 每次加载 Catalog 都对 chat 条目调用 `loadSkill` | 拆成轻量 Registry 元数据和正文加载器 |
| [`chat-orchestration.ts`](../../packages/runtime-core/src/chat-orchestration.ts) | 固定返回 QA Skill、平台规范和 Catalog | 替换为纯选择器和决定对象 |
| [`prompt.ts`](../../packages/runtime-core/src/prompt.ts) | Prompt 阶段再次读取 SkillBundle | 接收已完成的选择与加载结果，不再自行选 Skill |
| [`web/src/lib/companion/run.ts`](../../web/src/lib/companion/run.ts) | Web 先计算并发送 `processSkill` | Web 只发送用户事实和模块/模板绑定 |
| [`companion/src/runs/manager.ts`](../../companion/src/runs/manager.ts) | Companion 再次解析并加载 Skill | 成为唯一选择、加载和发事件的位置 |
| [`companion/src/runs/store.ts`](../../companion/src/runs/store.ts) | 事件按 Run 持久化 | Skill 事件沿用 Run 事件存储和回放 |

## 2. 版本目标

| 编号 | 目标 | 成功标准 |
|------|------|----------|
| G1 | 普通对话零业务 Skill | 寒暄、解释、简短问答不读取或注入业务 Skill |
| G2 | 单一选择权 | 只有 Companion 产生最终选择决定 |
| G3 | Registry 轻量化 | Run 期间不扫描 Skill 文件或读取未选正文，也不向 Agent 注入 Catalog |
| G4 | 按需加载 | 只读取主 Skill、实际依赖和模块必需基座 |
| G5 | UI 真实 | 只展示真实选择、可用或失败事实 |
| G6 | 三 Agent 一致 | 三 Agent 收到相同的已选 Skill 指令和事件事实 |
| G7 | 模块不退化 | 现有写作、PPT、视频、3D、推演流程保持可用 |
| G8 | 可回滚 | 不迁移历史数据即可恢复 `0.1.6` 编排路径 |

## 3. 目标架构

### 3.1 责任边界

```text
Web
  └── 发送用户消息、moduleId、templateId、requestedSkillSlug
        ↓
Companion
  ├── 查询内存 Registry
  ├── 生成 SkillSelectionDecisionV1
  ├── 延迟读取选中 Skill 和必要资产
  ├── 组装 Prompt / Agent Kit
  └── 写入统一 Skill Run Events
        ↓
Codex / Claude / Hermes
  └── 消费相同的已组装指令，不自行生成平台 Skill 选择事实
```

约束：

- `runtime-core` 提供 Registry、选择、加载和 Prompt 组装的纯能力；Companion 持有进程级实例和生命周期；
- Web 不读取 Catalog，不把 `processSkill` 当最终决定发送；
- Agent Adapter 不输出 `skill.selected` 等平台生命周期事件；
- Agent 自带的私有 Skill 机制不冒充小窗平台 Skill 事件。

### 3.2 三层内容

| 层级 | 内容 | 加载策略 |
|------|------|----------|
| 平台基础 Prompt | 身份、安全、工作区边界、语言、工具与通用回答规则 | 每 Run 加载 |
| Skill Registry | slug、版本、摘要、scope、kind、触发规则、依赖和能力要求 | Companion 启动或显式刷新时加载 |
| Skill 执行内容 | `SKILL.md`、references、scripts、templates、assets | 选中后加载 |

`skill-qa` 中真正通用的回答规则并入平台基础 Prompt；`skill-platform-research-norms` 中只有普遍适用的来源真实性、工作区边界和默认语言规则进入基础层。行业研究、投资免责声明、报告结构等专项要求跟随具体业务 Skill。

### 3.3 Registry 权威源与生成

`0.1.7` 使用两类职责不重叠的作者源：

1. `skills/<slug>/SKILL.md` frontmatter 保存 Skill 自身事实：slug、version、kind、scope、summary、Skill 依赖、能力要求和资产策略；
2. `skills/skill-selection-policy.json` 保存平台选择策略：启用状态、允许的选择来源、模块/模板绑定、触发规则、排除规则和稳定优先级。

构建期由 `skills:verify` 合并两类作者源，生成唯一运行时文件 `skills/skill-registry.generated.json`。Companion 只读取该生成文件并持有进程级内存 Registry；Web 可以读取由同一生成文件派生的展示投影，但不得维护或发送最终 Skill 映射。

迁移约束：

- `skills/chat-catalog.json`、`WRITING_TEMPLATE_SKILL`、`PPT_SKILL_CATALOG`、`VIDEO_SKILL_CATALOG` 和其他 Web 侧映射只作为迁移输入；完成迁移后不得再参与运行时选择；
- 每个随应用打包的 `skills/*/SKILL.md` 都必须在选择策略中显式标记为 `active` 或 `disabled`；缺项、重复 slug、目录与 slug 不一致、未知绑定或依赖不闭环都使构建失败；
- `2026-07-24` 基线为 48 个 `SKILL.md`、47 个已声明 slug 和 38 个旧 chat Catalog 条目；T01 必须产出逐项清单并消除差异，不能默认只迁移旧 Catalog 的 38 项；
- 生产 Run 热路径只查询内存 Registry，不读取作者源、不扫描 Skill 目录；开发刷新先重新生成并校验 Registry，再原子替换内存快照。

### 3.4 `SkillManifestV1`

Registry 条目至少包含：

| 字段 | 含义 |
|------|------|
| `slug` | 稳定 Skill 标识，与目录名一致 |
| `version` | Skill 版本；构建校验时从受支持元数据生成 |
| `kind` | `workflow` 或 `tool` |
| `scope` | chat、writing、ppt、video、3d、simulation 等适用范围 |
| `summary` | 面向索引和审计的短说明 |
| `status` | `active` 或 `disabled`；disabled 不可被任何来源选择 |
| `selectableSources` | 允许通过 explicit、template、module、continuation、intent 中哪些来源选择 |
| `bindings` | 受控的 moduleId/templateId 确定性绑定 |
| `triggers` | 高置信触发词、短语或受控规则 |
| `excludes` | 容易误判但不应触发的表达 |
| `priority` | 多条规则同时命中时的稳定优先级 |
| `skillDependencies` | 必须共同加载的 Skill slug；必须形成无环闭包 |
| `capabilityRequirements` | 领域服务、本地工具、OS 或运行时能力要求 |
| `assetPolicy` | 是否需要准备 references/scripts/templates/assets |

目录完整性、slug、版本、绑定唯一性、允许来源、依赖闭环和能力字段在构建期由 `skills:verify` 校验。`tool` 类型默认不得成为主流程 Skill，除非 `selectableSources` 明确允许对应来源。Run 期间不得为了校验完整性读取全部 `SKILL.md`。

### 3.5 `SkillSelectionDecisionV1`

每个 Run 必须产生一条决定；无 Skill 也是明确决定，但不产生 Skill UI 事件。

| 字段 | 含义 |
|------|------|
| `decisionId` | 稳定决定标识 |
| `sessionId` / `runId` | 当前会话和 Run |
| `decisionOutcome` | `selected`、`none` 或 `rejected` |
| `requestedSkillSlug` | 显式请求的原始 slug；其他来源为空 |
| `primarySkillSlug` | 主流程 Skill；无匹配时为空 |
| `requiredSkillSlugs` | 实际依赖和模块必需基座 |
| `selectionSource` | `explicit`、`template`、`module`、`continuation`、`intent` 或 `none` |
| `reasonCode` | 稳定、可测试的原因码 |
| `reasonText` | 简短审计说明，不包含模型私有推理 |
| `selectorVersion` | 选择规则版本，用于历史排查 |
| `decidedAt` | 决定时间 |

`skillVersion` 和 `contentHash` 不要求在选择时存在，避免为了填字段提前读取正文；它们在 Skill 可用后记录。

Companion 必须在启动 Agent 前将完整 Decision 持久化到对应 RunRecord。`none` 和 `rejected` 也必须保存；它们可以不产生 Skill UI 事件，但历史排查必须能够区分“明确无匹配”“显式请求被拒绝”和“选择器未执行”。所有 Skill Run Event 必须携带同一个 `decisionId`。

### 3.6 选择优先级

1. **显式指定**：由明确 UI 操作产生的结构化 `requestedSkillSlug`，或用户文本同时出现使用/调用等明确动作与完整 slug；
2. **现有模板绑定**：写作、PPT、视频模块已选择的 `templateId`；
3. **模块绑定**：写作、PPT、3D、视频、推演的默认基座能力；
4. **受约束延续**：同一会话明确要求继续、补充或修改上一成功工作流；
5. **高置信意图**：由 `SkillManifestV1` 的受控规则唯一命中；
6. **无匹配**：使用平台基础能力，不加载业务 Skill。

选择规则：

- 一次 Run 只有一个主流程 Skill；其明确依赖不算候选；
- 不允许为了“可能有用”同时读取多个候选正文；
- 不增加强制的大模型 Router 调用；
- `0.1.7` 首批自动意图白名单只包含 `skill-tr-doc` 的“明确整篇文档翻译”规则；新增其他 intent Skill 或扩大触发表达必须单独评审，不得在实现中顺带加入；
- 只出现 slug 不算显式指定；解释 slug、引用文档、代码块、日志、URL 和否定表达必须命中排除规则；
- Companion 必须校验显式 slug 的格式、存在性、status 和 `selectableSources`，不能信任 Web 直接给出的选择结果；
- 多条意图规则冲突、置信不足或命中排除条件时返回 `none`，必要时由 Agent 正常澄清；
- 用户显式指定的 slug 不存在或不可用时不得自动换成其他 Skill。

模块边界：

- `moduleId=chat` 不构成业务模块绑定，也不得恢复 `skill-qa`、`skill-qa-fast` 或 `skill-qa-deep` 的默认注入；
- 非 chat 模块从本模块生产输入区发起的 Run 使用确定性模板/模块硬绑定，以保持 `0.1.6` 行为；在 `0.1.7` 中，自然语言意图不会静默跨模块改选另一主流程 Skill；
- 已选择的具体模板优先于模块默认基座；模块必需但不承担主流程的 Skill 放入 `requiredSkillSlugs`；
- 跨工作台、跨交付阶段的自然语言切换属于 `0.2.0`。`0.1.7` 若检测到明显跨模块冲突，只能澄清或提示用户进入对应模块，不得猜测切换。

### 3.7 会话延续兼容

`0.1.7` 不引入 `TaskRecord` 或 `DeliveryStage`。为了支持“继续补充刚才的行业报告”，仅在现有 `SessionRuntimeRecord` 保存最近一次成功的 workflow Skill 作为延续提示。

只有同时满足以下条件才使用 `continuation`：

1. 同一 session 有最近一次成功的 workflow Skill；
2. 本轮没有显式、模板、模块或新意图选择；
3. 用户文本明确表达“继续、补充、修改上文、沿用刚才”等延续关系；
4. 没有出现明显的新主题或无关简单问题。

该字段不是永久 active Skill，也不产生 `suspended/released` 状态。`0.2.0` 引入 DeliveryStage 后再迁移为阶段级延续。

由于非 chat 模块使用硬绑定，`continuation` 主要服务 `moduleId=chat` 中由 explicit 或 intent 启动的上一工作流；硬绑定模块继续同一流程时仍记录原 template/module 来源，不伪装为 continuation。

## 4. Prompt 与延迟加载

### 4.1 普通对话

- 不注入 `skill-qa` 正文；
- 不注入 `skill-platform-research-norms` 正文；
- 不注入完整 Catalog 或 `<available_skills>`；
- 不创建 Agent Kit；
- 不出现 Skill 状态文案。

### 4.2 选中 Skill

1. Companion 写入选择决定；
2. 读取主 Skill 和实际依赖；
3. 只有存在本轮确需资产时才创建 Agent Kit；
4. 组装平台基础 Prompt、选中 Skill 正文和 Agent Kit 路径；
5. 将同一组装结果交给所选 Agent。

缓存可以按 Skill 根目录、slug、版本以及开发环境可用的文件标识管理。`contentHash` 用于记录实际内容，不作为选择前必须计算的键。生产安装包以应用版本和 Companion 重启为主要失效边界；开发模式支持显式刷新或文件变化失效。

## 5. Skill Run Events

`0.1.7` 只增加三个由 Companion 产生的 bundle 级规范事件，并纳入现有 Run Event 持久化：

| 事件 | 含义 |
|------|------|
| `skill.selected` | 已确定主 Skill 和依赖 bundle，尚不代表正文可用 |
| `skill.ready` | 主 Skill、全部必要依赖和本轮必需资产均可用于 Prompt |
| `skill.failed` | 选择、正文、依赖或资产准备失败，记录失败项和降级结果 |

不增加 `skill.reused`：缓存命中不等于业务工作流延续。`skill.ready.items[].cacheStatus` 表达每个 Skill 的 `miss` 或 `memory-hit`，`selectionSource=continuation` 表达业务延续。

事件公共字段：

| 字段 | 要求 |
|------|------|
| `eventId` | 必填；同一事件重放幂等 |
| `decisionId` | 必填；关联已持久化的 `SkillSelectionDecisionV1` |
| `runId` / `sessionId` | 必填 |
| `streamSeq` | 沿用当前 Run 内排序机制 |
| `occurredAt` | Companion 生成时间 |
| `primarySkillSlug` / `requiredSkillSlugs` | selected 必填 |
| `selectionSource` / `reasonCode` | selected 必填 |
| `items[]` | ready 必填；每项含 slug、version、contentHash、cacheStatus |
| `bundleHash` / `bundleCacheStatus` | ready 必填；bundleCacheStatus 为 `full-hit`、`partial-hit` 或 `miss` |
| `failedSkillSlug` / `failureStage` | failed 必填；failureStage 区分 selection、manifest、body、dependency、asset |
| `loadedItems[]` | failed 必填；允许为空，记录失败前已准备的项目 |
| `failureCode` / `failureMessage` / `fallbackMode` | failed 必填 |

事件规则：

1. 非 `selected` Decision 不产生 `skill.selected`；显式请求被拒绝时可以直接产生 `skill.failed`；
2. `skill.ready` 只在主 Skill、全部 `requiredSkillSlugs` 和本轮必需资产均成功后产生；任一必要项失败只产生 `skill.failed`，不得先发 ready；
3. `bundleHash` 对按 slug 排序后的 `slug/version/contentHash` 规范序列计算，不要求在选择前存在；
4. 历史回放读取持久化 Decision 和当时事件，不从 Prompt、最终回答或文件路径补造；
5. 没有选中 Skill 的 Run 不产生占位 Skill 事件；
6. 若 Run 在 selected 后、ready/failed 前取消，沿用 `run.cancelled` 作为终态。UI 必须停止 Skill 加载态，历史回放不得把该 Skill 显示为 ready。

## 6. 失败与降级

| 来源 | 默认行为 |
|------|----------|
| `explicit` | 阻止伪装完成；说明指定 Skill 不可用，用户确认后才能改用基础模式 |
| `template` / `module` | 保留输入和模板选择；能力不足会降低交付规格时必须确认 |
| `continuation` | 不破坏已有产物；本轮失败并提供重试或基础回答 |
| `intent` | 基础能力能够完整回答时可自动降级，并记录 `fallbackMode=basic` |

依赖本地工具、特定格式或引用规范的任务，在 Skill 或依赖缺失时不得声称完整交付。

## 7. 兼容与回滚

- 旧会话消息、现有 `sessionId`、模块路由和交付物无需迁移；
- 新 Skill 事件是向后兼容的可选 Run Event，旧消费者可以忽略；
- `processSkill/platformNormSkill/supportSkillSlugs` 在请求契约中标记 deprecated；兼容期只接受白名单内的旧模块绑定，不再允许 Web 覆盖最终选择；
- 新旧编排通过 `SKILL_ORCHESTRATION_V2_ENABLED` 切换；关闭后恢复 `0.1.6` 选择和 Prompt 路径；
- 回滚不删除新事件、不清理历史消息、不修改用户工作区；
- `0.1.6` Activity 旧渲染器继续保留，待 `0.1.7` 完成一个稳定版本窗口后再单独删除。

## 8. 实施任务

| 任务 | 内容 | 主要产出 |
|------|------|----------|
| `0.1.7-T00` | 冻结聚焦范围和架构决策 | 本文档、决策记录、非目标 |
| `0.1.7-T01` | 冻结契约、基线和测试基础设施 | Registry 作者源、Manifest/Decision/Event Schema、行为矩阵、质量评分、测试命令、基线报告 |
| `0.1.7-T02` | 建立 Companion Registry | 48 项清单迁移、生成 Registry、构建校验、开发失效、I/O 计数器 |
| `0.1.7-T03` | 收回 Companion 选择权并精简平台 Prompt | 请求兼容层、Web 去重、基础 Prompt、旧路径开关 |
| `0.1.7-T04` | 实现确定性 Selector | 显式、模板、模块、延续、意图和 none 决定 |
| `0.1.7-T05` | 实现正文与 Agent Kit 延迟加载 | Lazy loader、缓存、依赖和资产准备 |
| `0.1.7-T06` | 接入 Skill Run Events 和 UI | selected/ready/failed、持久化、回放、状态文案 |
| `0.1.7-T07A` | 完成自动化和三 Agent 真流 | Unit、Contract、Integration、E2E、Codex/Claude/Hermes 报告 |
| `0.1.7-T07B` | 完成桌面制品与回滚验证 | macOS、Windows、升级/降级和开关报告 |

执行顺序：

```text
T00 → T01 → T02/T03 → T04 → T05 → T06 → T07A → T07B
```

T02 与 T03 可以在契约冻结后并行。T07A 未通过不得进入 RC；外部 Agent 环境不可用时记录为阻塞，不用 Mock 代替真流结论。

## 9. 验收场景

| 场景 | 预期 |
|------|------|
| “你好” | `selectionSource=none`；0 个业务 Skill；无 Skill UI |
| “解释一下这段报错” | 基础能力直接回答；不加载 `skill-qa` |
| “用 skill-wr-industry 做行业研究” | 显式选择且只加载指定 Skill 和实际依赖 |
| “skill-wr-industry 是什么”或日志中出现该 slug | `none`；不把提及、引用或代码当成显式使用 |
| 通用对话中明确要求整篇文档翻译 | 唯一高置信命中 `skill-tr-doc`；事件真实 |
| 模糊地说“帮我处理一下” | 不猜测 Skill，直接澄清或基础回答 |
| 进入 PPT 模块 | 确定性加载 PPT 基座或已选模板 Skill |
| 在 PPT 模块明确要求另做行业研究 | 不静默跨模块改选；澄清或提示进入对应模块 |
| 进入推演模块 | 加载推演基座和声明的世界模型依赖 |
| 推演 bundle 全部可用 | 一条 ready 携带两个 items 和稳定 bundleHash |
| 世界模型依赖损坏 | failed 指向依赖；不产生 ready |
| 行业报告后说“继续补充竞争格局” | 受约束延续上一 workflow Skill |
| 行业报告后问“1+1 等于几” | `none`；不让旧 Skill 污染本轮 |
| Skill 缺失或损坏 | 产生 failed，按来源阻止或降级 |
| 切换 Codex/Claude/Hermes | 选择决定和 Skill 事件一致 |
| 重载历史会话 | 回放原始事件，不补造 Skill 状态 |
| `selectionSource=none` 的历史 Run | Decision 可审计；无 Skill UI 事件 |
| selected 后立即取消 Run | `run.cancelled` 终止加载态；不补造 ready/failed |
| 关闭 V2 开关 | 无数据迁移恢复 `0.1.6` 编排 |

## 10. 发布门禁

### 10.1 可观测指标

| 指标 | 通过标准 |
|------|----------|
| 普通对话注入 | `injectedSkills=[]` |
| 普通对话正文读取 | `skillBodyReadCount=0` |
| 普通对话 Agent Kit | `agentKitCreateCount=0` |
| Run 期间文件扫描 | `skillFilesystemScanCount=0`；允许查询内存元数据 |
| 按需加载 | 只读取主 Skill、实际依赖和必需基座 |
| Prompt | 不含业务 Skill 正文和 Catalog；普通 fixture 小于 T01 基线的 70% |
| 编排耗时 | 同机基准 p95 绝对值不超过 20 ms；计数器为主要门禁 |
| 事件回放 | 重载前后事件类型、eventId 和 streamSeq 一致 |
| UI | 无事件无 Skill 文案；selected、ready、failed 文案不同 |
| 普通回答质量 | 三 Agent 分别与同版本配置的 `0.1.6` 成对对比；P0 错误为 0，五分制平均下降不超过 0.25，下降至少 1 分的样例不超过 10% |

### 10.2 自动化范围

- Unit：Manifest 校验、Registry、选择优先级、冲突和延续守卫、缓存失效；
- Contract：Decision/Event Schema、失败码、向后兼容解析和幂等；
- Integration：Web 请求事实到 Companion 决定、Prompt 注入和 I/O 计数；
- E2E：none、显式、模板、模块、意图、延续、失败、回滚和历史回放；
- Real CLI：三 Agent 各完成一条零 Skill 和一条实际 Skill 任务；
- Release：macOS 测试签名制品、Windows NSIS 测试制品和升级/降级检查。

T01 必须先为 `runtime-core` 和 Companion 建立可在 CI 运行的 Unit/Contract 测试命令；不得只用内联 smoke 脚本代替契约测试。

普通回答质量集至少包含 24 个固定样例，覆盖寒暄、事实解释、代码/报错解释、摘要、模糊请求、slug 提及负例和澄清。比较时固定 Agent 版本、模型、配置和输入上下文；三个 Agent 分别计分，不以总平均掩盖单一 Agent 回退。T01 必须冻结五分制 rubric、P0 错误定义和不可自动判分样例的人工复核方式。

## 11. 非目标

`0.1.7` 不包括：

- 新建 Task、Conversation、DeliveryStage 或 Artifact 数据模型；
- 修改一级导航、合并模块路由、新建统一模板页或引入 TemplateApplication；现有 `templateId` 映射迁移到 Registry 除外；
- 一个任务中切换多个交付阶段；
- 从消息、交付物或任务创建派生任务；
- Skill 商店、在线安装或自进化 Skill；
- 强制额外大模型 Router；
- 重写全部业务 Skill；
- 删除 `0.1.6` Activity 旧渲染器；
- 正式签名、公证或自动更新服务。

## 12. 风险与处理

| 风险 | 处理原则 |
|------|----------|
| 移除 QA Skill 后普通回答变弱 | 先提炼基础 Prompt，并用固定 fixture 对比 |
| 规则意图误选 | 只纳入唯一、高置信规则；冲突时 none |
| Web/Companion 新旧版本不一致 | 请求兼容层、白名单和版本开关 |
| 延续造成旧 Skill 污染 | 必须有明确延续表达和新意图否决 |
| Registry 作者源、旧 Catalog 和目录漂移 | 生成文件作为唯一运行时源；构建期全量 `skills:verify`，Run 热路径不扫描 |
| UI 把缓存命中误报为继续使用 | ready + cacheStatus，与 continuation 分离 |
| 三 Agent 私有 Skill 行为不同 | 平台决定和事件只由 Companion 产生 |

## 13. T00 确认记录与 T01 冻结项

产品于 `2026-07-24` 确认以下三项，`T00` 正式关闭：

1. `0.1.7` 只包含本文件范围；统一任务模型、统一模板 Catalog/页面、TemplateApplication 和多交付阶段转入 `0.2.0`，现有 `templateId` 到 Skill 的映射仅作为本版选择输入保留；
2. Companion 确定性选择取代旧 `hybrid-steer`，不再把完整 Catalog 交给 Agent 自行判断；
3. 首批自动意图只覆盖可定义为唯一高置信规则的能力，其他情况使用基础能力或澄清。

T01 还必须冻结：

- Registry 两类作者源、生成文件、48 项迁移清单和 Web 展示投影；
- `reasonCode`、`failureCode`、显式 slug 动作语法和首批 trigger/exclude 规则；
- `SkillManifestV1`、持久化 `SkillSelectionDecisionV1` 和三个 bundle 级 Skill Event 的 JSON Schema；
- `0.1.6` 对比 fixture、普通回答质量 rubric、Prompt 大小、I/O 计数和参考设备耗时基线；
- 新旧请求兼容矩阵和回滚开关验证方式。

## 14. 验收与发布结论

截至 `2026-07-27`，本需求定义的目标、计划与验收标准均已闭环：

- 统一任务、统一 Template Catalog/页面、TemplateApplication 和多交付阶段确认完全不进入 `0.1.7`，继续由后续版本承接；
- Companion 是平台 Registry 和最终 Skill Decision 的唯一持有者，Web 与 Codex、Claude、Hermes 均不再依据完整 Catalog 各自决定平台 Skill；
- 自动意图首批仅包含 `skill-tr-doc` 的明确整篇文档翻译规则，模糊、冲突、引用、日志、URL 和否定表达均不猜 Skill；
- AC-01 至 AC-25、三 Agent 真流、普通回答质量、五个业务模块、macOS DMG、Windows NSIS、升级、开关回滚、降级和用户数据隔离均通过；
- Desktop Alpha 正式发布允许使用 macOS ad-hoc 与 Windows 测试签名制品，不把测试签名表述为生产级 Apple 公证或 Authenticode 签名；
- `v0.1.7` tag、GitHub Release、双平台制品及其 SHA-256 清单共同构成冻结基线，后续 `0.1.8` 迁移验收不得用本地脏工作区或其他临时候选替代。

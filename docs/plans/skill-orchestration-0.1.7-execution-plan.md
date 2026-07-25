# `0.1.7` Skill 按需编排实施与验收计划

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.5 |
| 日期 | 2026-07-25 |
| 状态 | T01-T07A 已完成；T07B macOS 已完成，待 Windows NSIS 制品与 Windows 安装/回滚验收 |
| 目标版本 | `0.1.7` |
| 上级需求 | [requirements-0.1.7.md](../product/requirements-0.1.7.md) |
| 适用范围 | `packages/contracts`、`packages/runtime-core`、Companion、Web、Desktop、Codex / Claude / Hermes 真流 |
| 核心目标 | Companion 统一选择 Skill；普通对话零业务 Skill；选中后才加载；选择、就绪、失败和历史回放均对应真实事实 |
| 非目标 | 统一任务、统一 Template Catalog/模板页、TemplateApplication、多交付阶段、导航改造、派生任务、强制大模型 Router |

> 本文把 `0.1.7` PRD 转换为可执行工作包和发布门禁。需求边界与产品决策以上级需求为准；本文不得自行扩大版本范围。

---

## 1. 最终目标

`0.1.7` 只完成一个系统级改造：

> 每个 Run 由 Companion 基于明确事实和少量高置信规则产生唯一、可持久化的 Skill Decision；只有 Decision 选中 Skill 时才加载对应 bundle，并把同一结果交给三个 Agent。

完成后必须同时具备以下结果：

1. 普通对话不读取、不注入业务 Skill，不创建 Agent Kit，不显示 Skill 状态；
2. Web 只发送用户消息、模块、模板和显式 UI 操作，不再发送最终 Skill 决定；
3. Codex、Claude、Hermes 不接收完整 Catalog，不各自决定平台 Skill；
4. Registry、Selector、Loader、Decision 和 Skill Events 使用同一套版本化契约；
5. 每个 Run 都保存 selected、none 或 rejected Decision；
6. `skill.ready` 只代表主 Skill、全部依赖和必需资产均已准备完成；
7. 历史回放、取消、失败、缓存和回滚不伪造 Skill 状态；
8. 写作、PPT、视频、3D、推演现有确定性流程不退化。

### 1.1 版本级成功标准

| 目标 | 成功标准 | 必须提供的证据 |
|------|----------|----------------|
| 普通对话零业务 Skill | `injectedSkills=[]`、`skillBodyReadCount=0`、`agentKitCreateCount=0` | 集成测试、Prompt 快照、I/O 计数报告 |
| Companion 唯一选择权 | Web 与 Agent Adapter 均不能覆盖 Decision 或生成平台 Skill 事件 | Contract 测试、请求抓包、三 Agent 真流报告 |
| Registry 唯一运行时源 | Run 期间只查询 `skill-registry.generated.json` 的内存快照 | Registry 构建报告、文件扫描计数 |
| 确定性选择 | 相同输入、Registry 版本和 session 状态产生相同 Decision | Selector fixture、selectorVersion 快照 |
| bundle 按需加载 | 只读取 primary、required 和本轮必需资产 | Loader 测试、读取清单、bundleHash |
| 事件真实 | selected、ready、failed 与持久化 Decision 和实际加载结果一致 | Event Contract、回放 E2E、取消测试 |
| 三 Agent 一致 | 同一事实输入产生相同 Decision、Prompt 组成和 Skill 事件 | Codex / Claude / Hermes 对照报告 |
| 模块不退化 | 写作、PPT、视频、3D、推演基座和模板流程均通过 | 模块 E2E、交付物回归 |
| 可回滚 | 关闭开关恢复 `0.1.6` 编排且不迁移、不删除历史数据 | 升级/降级与开关报告 |

---

## 2. 锁定决策与边界

### 2.1 已确认决策

| 编号 | 决策 | 实施约束 |
|------|------|----------|
| D1 | 统一任务和统一模板产品能力不进入 `0.1.7` | 本版只迁移现有 `templateId` 到 Skill 的选择映射 |
| D2 | Companion 持有唯一 Registry 和最终选择权 | Web、Prompt、Agent Adapter 不得形成第二选择事实 |
| D3 | 自动意图只覆盖少量唯一高置信规则 | 首批仅 `skill-tr-doc`；冲突、低置信、引用、日志和模糊请求返回 none 或澄清 |
| D4 | 不增加强制大模型 Router | Selector 为版本化纯规则与确定性绑定 |
| D5 | 一次 Run 只有一个 primary workflow Skill | required Skill 是依赖，不是并列候选 |
| D6 | 非 chat 模块保持硬绑定 | 明显跨模块请求只澄清或提示进入对应模块 |
| D7 | Decision 与事件分离 | 所有 Run 保存 Decision；只有真实 Skill 生命周期产生 UI 事件 |
| D8 | bundle 级 ready | 任一必要依赖或资产失败时不得产生 ready |

### 2.2 明确不做

- 不新建 Task、Conversation、DeliveryStage 或 Artifact 数据模型；
- 不新建统一模板页、TemplateApplication 或统一模板搜索；
- 不在一个任务中自动切换写作、PPT、视频等多个交付阶段；
- 不实现 Skill 商店、在线安装或自进化；
- 不重写全部业务 Skill 正文；
- 不删除 `0.1.6` Activity 旧渲染器；
- 不以 mock 替代三 Agent 真流结论；
- 不把正式签名、公证或自动更新服务纳入本版。

---

## 3. 当前基线与目标架构

### 3.1 当前基线

| 项目 | `0.1.6` 当前事实 |
|------|------------------|
| 对话编排 | `hybrid-steer`；默认 QA Skill + 平台规范 + Catalog 摘要 |
| Web | `resolveSkills()` 后发送 `processSkill` 等字段 |
| Companion | 再次解析并加载 Skill，选择权重复 |
| Catalog | `chat-catalog.json` 有 38 项；加载 Catalog 时读取 chat Skill |
| Skill 目录 | 48 个 `SKILL.md`，47 个已声明 slug；新 Manifest 字段尚未齐备 |
| Prompt | 普通对话包含业务 Skill 和 `<available_skills>` |
| Agent Kit | CLI Run 默认创建 Kit |
| UI | 在真实加载结果之前可能显示 Skill 加载文案 |
| 测试 | `skills:verify` 仍断言旧默认注入和 `hybrid-steer` |

### 3.2 目标架构

```text
Skill 作者源
  ├── SKILL.md frontmatter
  └── skill-selection-policy.json
            │ build + verify
            ▼
skill-registry.generated.json
            │ Companion 启动加载
            ▼
Web facts ──> Selector ──> persisted SkillSelectionDecisionV1
                               │
                    selected ──┴── none / rejected
                       │                    │
                       ▼                    └── 基础 Prompt，无 Skill UI
                  Lazy Loader
                       │
              primary + required + assets
                       │
              selected / ready / failed
                       │
                       ▼
        同一 Prompt ──> Codex / Claude / Hermes
```

### 3.3 版本必须交付的契约与资产

| 产出 | 最低内容 |
|------|----------|
| Registry 作者源 | 完整 Skill frontmatter、`skill-selection-policy.json` |
| 生成 Registry | `skill-registry.generated.json`、registryVersion、构建校验 |
| Manifest Schema | 身份、状态、允许来源、bindings、triggers/excludes、依赖、能力、资产策略 |
| Decision Schema | selected/none/rejected、primary/required、来源、原因、selectorVersion |
| Event Schema | bundle 级 selected/ready/failed，全部关联 decisionId |
| 兼容矩阵 | Web/Companion 新旧请求、开关开关、历史事件读取规则 |
| 行为矩阵 | 显式、模板、模块、延续、意图、none、rejected、失败和取消 |
| 基线报告 | `0.1.6` Prompt、I/O、耗时、质量 fixture 和三 Agent 版本 |
| 发布报告 | 自动化、真流、制品、升级/降级和回滚结果 |

---

## 4. 实施计划

### T00：范围和架构确认

状态：已完成。

已确认：

- 统一任务和统一模板产品能力转入 `0.2.0`；
- Companion 确定性选择取代 `hybrid-steer`；
- 首批自动意图白名单仅包含 `skill-tr-doc` 的明确整篇文档翻译规则。

退出证据：上级需求状态为“T00 已确认”。

### T01：契约、清单、基线和测试基础设施

目标：在改运行时代码前冻结所有跨模块契约和可执行门禁。

执行动作：

1. 在 `packages/contracts` 定义并导出 `SkillManifestV1`、`SkillSelectionDecisionV1` 和三个 Skill Event Schema；
2. 冻结 `reasonCode`、`failureCode`、`failureStage`、`fallbackMode` 枚举；
3. 冻结显式 slug 动作语法、引用/代码/日志排除规则和首批 intent trigger/exclude；
4. 盘点全部 48 个 Skill，记录目录、slug、version、kind、scope、状态、bindings、依赖、能力和资产；
5. 冻结 Registry 作者源、生成文件格式、registryVersion 和 selectorVersion；
6. 冻结 Decision 在 RunRecord 中的存储位置及旧 RunRecord 兼容解析；
7. 冻结 bundle 事件字段、bundleHash 算法、取消和部分失败规则；
8. 建立 `runtime-core` 与 Companion 可在 CI 运行的 Unit/Contract 测试入口；
9. 记录 `0.1.6` 普通 Prompt、正文读取数、Kit 创建数、编排耗时和质量 fixture；
10. 冻结新旧请求兼容矩阵和 `SKILL_ORCHESTRATION_V2_ENABLED` 行为。

主要产出：

- JSON Schema 与 TypeScript 类型；
- 48 项 Skill inventory；
- 行为矩阵与错误码表；
- `0.1.6` 基线报告；
- 最少 24 条普通回答质量 fixture；
- 可在 CI 运行的测试命令。

退出标准：

- Schema 可独立解析合法/非法 fixture；
- 48 个 Skill 均有 active 或 disabled 结论，目录和 slug 差异全部解释；
- selected、none、rejected、依赖失败和取消均有唯一合法状态转换；
- 新旧请求的每个字段都有 accept、ignore、reject 或 deprecated 结论；
- 测试命令不依赖内联 `node -e` smoke；
- 产品、架构、Runtime、Companion 和 QA 对行为矩阵无未决 P0/P1 问题。

### T02：Registry 生成、校验和生命周期

目标：建立 Companion 唯一读取的轻量 Registry，Run 热路径不扫描 Skill 文件。

执行动作：

1. 补齐 48 个 `SKILL.md` frontmatter；
2. 新建 `skills/skill-selection-policy.json`；
3. 将旧 chat Catalog 和 Web 模板/模块映射迁入作者源；
4. 实现生成器，输出 `skills/skill-registry.generated.json`；
5. 重写 `skills:verify`，校验目录、slug、版本、绑定唯一性、依赖闭环、状态和允许来源；
6. Companion 启动时读取生成 Registry，失败时给出稳定错误并阻止 V2 启动；
7. 开发刷新执行“生成、校验、原子替换”，失败时保留上一有效快照；
8. 增加 `skillFilesystemScanCount`、Registry 加载耗时和版本日志；
9. Web 展示数据改为消费生成 Registry 的只读投影，不再维护最终 Skill 映射。

退出标准：

- 48 个 Skill 全部进入生成报告，active/disabled 数量可审计；
- 重复 slug、未知依赖、循环依赖、未知 templateId 和缺失目录均使构建失败；
- Companion Run 期间 `skillFilesystemScanCount=0`；
- Registry 刷新失败不污染当前有效快照；
- `chat-catalog.json` 和 Web 旧映射不再参与 V2 运行时选择；
- 桌面打包产物包含生成 Registry 和所有 active Skill。

### T03：收回选择权、请求兼容和平台 Prompt 精简

目标：Web 只发送事实，Companion 在 Agent 启动前持久化唯一 Decision。

执行动作：

1. Web 请求移除最终 `processSkill/platformNormSkill/supportSkillSlugs` 计算；
2. 新请求只发送消息、moduleId、binding/templateId 和显式 UI `requestedSkillSlug`；
3. Companion 兼容层对旧字段执行白名单 accept/ignore/reject，不允许覆盖 V2 Decision；
4. `runtime-core` Prompt API 接收已完成的 Decision 和加载结果，不再读取 Catalog 或自行选 Skill；
5. 将 QA Skill 和平台规范中的通用规则提炼到平台基础 Prompt；
6. 普通对话移除 `skill-qa*`、平台规范正文、Catalog 和 `<available_skills>`；
7. 普通对话不创建 Agent Kit、不显示 Skill 状态；
8. 开关关闭时完整恢复 `0.1.6` 请求和 Prompt 路径。

退出标准：

- V2 Web 请求中无最终 Skill 决定字段；
- 普通 Prompt 不包含业务 Skill、Catalog 或 Skill 路径；
- `injectedSkills=[]`、`skillBodyReadCount=0`、`agentKitCreateCount=0`；
- 三个 Agent Adapter 不生成 `skill.selected/ready/failed`；
- 开关关闭后旧测试和旧 Prompt 快照通过；
- 新旧 Web/Companion 组合均符合兼容矩阵。

### T04：确定性 Selector

目标：实现可重复、可解释、可版本化的选择优先级。

选择顺序：

```text
explicit UI / 动作 + slug
  > template binding
  > non-chat module binding
  > constrained continuation
  > unique high-confidence intent
  > none
```

执行动作：

1. 实现纯函数 Selector，输入只包含 Registry 快照、请求事实和受约束 session 状态；
2. 实现结构化 explicit 和“动作 + 完整 slug”规则；
3. 对解释、引用、代码块、日志、URL、否定表达和 slug 不存在做负向处理；
4. 实现 template/module 硬绑定和跨模块冲突澄清；
5. 实现最近一次成功 workflow Skill 的 continuation 守卫；
6. 实现首批唯一高置信 intent 规则；
7. 多规则冲突、能力不满足或低置信时返回 none/rejected；
8. 生成稳定 reasonCode、reasonText 和 selectorVersion；
9. 在 Agent 启动前把完整 Decision 写入 RunRecord。

退出标准：

- 相同输入重复运行 Decision 深度相等，除 ID/时间字段外无漂移；
- “用 skill-wr-industry”选择成功，“skill-wr-industry 是什么”返回 none；
- 模糊“帮我处理一下”不猜 Skill；
- 非 chat 模块绑定不被自然语言 intent 静默覆盖；
- 新主题或简单问题否决 continuation；
- 每个 RunRecord 都有 selected、none 或 rejected Decision；
- Selector 不读取任何 `SKILL.md` 正文，不调用大模型。

### T05：bundle 延迟加载、缓存和 Agent Kit

目标：只在 selected 后加载主 Skill、依赖和必需资产。

执行动作：

1. 将 Loader 输入改为持久化 Decision 和 Registry 快照；
2. 解析 `skillDependencies` 闭包并保持稳定排序；
3. 分离选择失败、Manifest 失败、正文失败、依赖失败和资产失败；
4. 记录每个 item 的 version、contentHash 和 cacheStatus；
5. 计算规范化 bundleHash 与 bundleCacheStatus；
6. 只有资产策略要求时才创建 Agent Kit；
7. 缓存键包含 Skill 根、slug、version 和开发态文件标识；
8. 生产缓存以应用版本和 Companion 重启为主要失效边界；
9. 增加正文读取、资产读取、Kit 创建和缓存命中计数。

退出标准：

- none/rejected 不调用 Loader；
- selected 只读取 primary、required 和声明资产；
- 任一必要依赖失败时不返回 ready bundle；
- 同一内容生成稳定 contentHash 和 bundleHash；
- memory-hit 不重新读取正文；
- 无资产任务不创建 Agent Kit；
- Intent 来源失败只有在基础能力能完整回答时才允许 `fallbackMode=basic`。

### T06：Decision、Skill Events、UI 与历史回放

目标：实时 UI 和历史回放只显示真实发生的 Skill 生命周期。

执行动作：

1. RunRecord 保存完整 Decision；
2. selected Decision 持久化成功后再发 `skill.selected`；
3. bundle 全部可用后发 `skill.ready`；
4. 选择或准备失败时发 `skill.failed`，记录 failedSkillSlug、failureStage 和 loadedItems；
5. 三个事件全部携带 decisionId、eventId、runId、sessionId 和 streamSeq；
6. Web 为 selected、ready、failed 提供不同状态，不显示 none 占位；
7. 历史回放读取原始 Decision 和事件，不从 Prompt 或回答补造；
8. selected 后取消时由 `run.cancelled` 终止加载态，不补造 ready/failed；
9. 旧消费者忽略新事件仍可正常完成对话。

退出标准：

- `skill.selected` 不能早于 Decision 持久化；
- `skill.ready` 只能在 bundle 全部成功后出现；
- failed 和 ready 对同一 Decision 互斥；
- none Decision 有审计记录但无 Skill UI；
- 实时、重连和重载后的事件类型、eventId、decisionId、streamSeq 一致；
- cancelled Run 不残留“正在加载 Skill”；
- Agent 私有 Skill 行为不显示为小窗平台 Skill 事件。

### T07A：自动化、质量基线和三 Agent 真流

目标：证明 V2 在行为、性能、质量和三 Agent 一致性上达到 RC 门槛。

执行动作：

1. 完成 Unit、Contract、Integration、E2E 和回放测试；
2. 执行至少 24 条普通回答质量 fixture；
3. 固定 Agent 版本、模型、配置和输入上下文，与 `0.1.6` 成对比较；
4. Codex、Claude、Hermes 各执行至少一条 none 和一条 selected 真流；
5. 三 Agent 使用同一个 Decision 和 bundle，记录最终 Prompt 元数据；
6. 记录冷/热缓存 I/O、Selector 耗时、Registry 加载耗时和 Prompt 大小；
7. 执行写作、PPT、视频、3D、推演模块回归；
8. 汇总失败、外部 Provider 限制和不可复现项。

退出标准：

- 所有自动化门禁通过；
- 三 Agent 的 Decision、Skill 事件和注入 bundle 一致；
- 普通回答质量 P0 错误为 0；
- 五分制平均下降不超过 0.25；
- 下降至少 1 分的样例不超过 10%；
- 普通 Prompt 小于 T01 `0.1.6` 基线的 70%；
- 编排 p95 不超过 20 ms；
- 任一 Agent 真流不可用时标记 RC 阻塞，不用 mock 代替。

### T07B：桌面制品、升级降级和回滚

目标：验证开发环境之外的打包、升级和故障恢复。

执行动作：

1. 构建 macOS 测试签名制品和 Windows NSIS 测试制品；
2. 校验生成 Registry、Skill 正文、依赖和资产均进入安装包；
3. 从 `0.1.6` 升级到 `0.1.7`，验证旧会话、Run 和工作区；
4. 开启 V2 执行 none、selected、failed、回放和取消场景；
5. 关闭 V2 开关，验证恢复 `0.1.6` 编排；
6. 降级到兼容版本，验证新事件可忽略且用户文件不变；
7. 记录制品哈希、Agent 版本、测试设备和回滚步骤。

退出标准：

- macOS 与 Windows 制品均能冷启动并读取 Registry；
- 打包态普通对话和 selected Skill 真流通过；
- 升级不迁移或丢失历史消息、Run 和工作区文件；
- 关闭开关立即恢复旧编排，无数据清理；
- 降级后旧消费者可忽略新事件；
- 发布报告包含制品哈希、完整失败清单和回滚证据。

---

## 5. 依赖、并行与里程碑

### 5.1 执行依赖

```text
T00 completed
  └── T01 contracts and baseline
        ├── T02 Registry
        └── T03 authority and Prompt
              └── T04 Selector
                    └── T05 Loader
                          └── T06 Events and UI
                                └── T07A automation and real agents
                                      └── T07B packages and rollback
```

T02 与 T03 可以并行，但二者都必须使用 T01 冻结的 Schema 和兼容矩阵。T04 不得在 Registry 作者源未冻结时自行发明第二套映射。

### 5.2 建议节奏

| 里程碑 | 工作包 | 建议耗时 | 退出结果 |
|--------|--------|----------|----------|
| M0 | T00 | 已完成 | 范围和三项产品决策确认 |
| M1 | T01 | 2-3 个工作日 | 契约、清单、基线和测试入口冻结 |
| M2 | T02 + T03 | 3-5 个工作日，可并行 | Registry 可用，选择权收回，普通 Prompt 归零 |
| M3 | T04 + T05 | 3-5 个工作日 | Selector 和按需 bundle 加载闭环 |
| M4 | T06 | 2-3 个工作日 | 实时/历史 Skill 状态一致 |
| M5 | T07A | 2-4 个工作日 | 自动化、质量和三 Agent 真流通过 |
| M6 | T07B | 1-2 个工作日 | 双平台制品与回滚通过 |

以上为双线并行情况下的工程估算，不是发布时间承诺。任何 Schema 返工、Agent 外部环境不可用或模块回归失败都会延长 RC 时间。

---

## 6. 验收标准

### 6.1 核心行为矩阵

| ID | 场景 | Decision | 事件 | I/O 与 UI |
|----|------|----------|------|-----------|
| AC-01 | “你好” | none | 无 Skill 事件 | 0 正文读取、0 Kit、无 Skill UI |
| AC-02 | “解释一下这段报错” | none | 无 Skill 事件 | 基础 Prompt 直接回答 |
| AC-03 | UI 选择 `skill-wr-industry` | selected/explicit | selected -> ready | 只加载主 Skill 和依赖 |
| AC-04 | “用 skill-wr-industry 做行业研究” | selected/explicit | selected -> ready | 与结构化显式选择一致 |
| AC-05 | “skill-wr-industry 是什么” | none | 无 Skill 事件 | 不把提及当使用 |
| AC-06 | 代码块、日志、URL 或否定表达中出现 slug | none | 无 Skill 事件 | 不读取对应正文 |
| AC-07 | 显式 slug 不存在或 disabled | rejected/explicit | failed，不发 selected | 不自动替换其他 Skill |
| AC-08 | 写作模块选择 industry 模板 | selected/template | selected -> ready | 选择 Registry 中确定绑定 |
| AC-09 | PPT 模块无具体模板 | selected/module | selected -> ready | 加载 PPT 基座 |
| AC-10 | PPT 模块要求另做行业研究 | 保持 selected/template；无模板时 selected/module | 只允许当前 PPT bundle 的 selected -> ready | 不加载行业 Skill；回答提示进入对应模块 |
| AC-11 | 明确要求整篇文档翻译 | selected/intent | selected -> ready | 唯一命中 `skill-tr-doc` |
| AC-12 | “帮我处理一下” | none | 无 Skill 事件 | 澄清或基础回答 |
| AC-13 | 两条 intent 规则冲突 | none | 无 Skill 事件 | 不读取多个候选正文 |
| AC-14 | 行业报告后“继续补充竞争格局” | selected/continuation | selected -> ready | 延续最近成功 workflow |
| AC-15 | 行业报告后“1+1 等于几” | none | 无 Skill 事件 | 旧 Skill 不污染本轮 |
| AC-16 | 最近 workflow 失败后说“继续” | none | 无 Skill 事件 | 不延续失败 Skill；由基础能力澄清 |
| AC-17 | 推演模块 | selected/module | selected -> ready | ready items 含 base + world-model |
| AC-18 | world-model 依赖损坏 | selected/module | selected -> failed，不发 ready | failedSkillSlug 指向依赖 |
| AC-19 | selected bundle 全部 item 内存命中 | selected | selected -> ready，bundleCacheStatus=full-hit | 正文读取计数为 0 |
| AC-20 | selected bundle 部分 item 命中 | selected | selected -> ready，bundleCacheStatus=partial-hit | 只读取未命中项 |
| AC-21 | selected 后立即取消 | selected | selected -> run.cancelled，不补 ready/failed | UI 停止加载态 |
| AC-22 | 重载历史 selected Run | 读取原 selected Decision | 回放原 eventId/streamSeq | 不从回答补造状态 |
| AC-23 | 重载历史 none Run | 读取原 none Decision | 无 Skill 事件 | 无 Skill UI，可审计 |
| AC-24 | 三 Agent 切换 | Decision 相同 | Skill 事件相同 | Prompt bundle 相同 |
| AC-25 | 关闭 V2 开关 | 走 `0.1.6` 路径 | 旧事件语义 | 无数据迁移或删除 |

### 6.2 目标追踪矩阵

| 版本目标 | 主要工作包 | 核心验收 | 发布证据 |
|----------|------------|----------|----------|
| G1 普通对话零业务 Skill | T03、T04 | AC-01、AC-02、AC-05、AC-06、AC-12、AC-13、AC-15 | Prompt 快照、I/O 计数、Selector 矩阵 |
| G2 Companion 单一选择权 | T03、T04、T06 | AC-03 至 AC-13、AC-24 | 请求契约、Decision 记录、三 Agent 对照报告 |
| G3 Registry 轻量化 | T01、T02 | AC-01、AC-19、AC-20 | Registry inventory、构建报告、文件扫描计数 |
| G4 bundle 按需加载 | T05 | AC-03、AC-08、AC-09、AC-17 至 AC-20 | Loader 测试、读取清单、缓存报告 |
| G5 UI 与历史事实一致 | T06 | AC-07、AC-18、AC-21 至 AC-23 | Event Contract、实时/重连/回放 E2E |
| G6 三 Agent 一致 | T03、T06、T07A | AC-24 | Codex、Claude、Hermes 真流报告 |
| G7 现有模块不退化 | T02 至 T07A | AC-08 至 AC-10、AC-17、模块回归矩阵 | 模块 E2E、交付物回归报告 |
| G8 可回滚 | T03、T07B | AC-25 | 开关、升级、降级和历史数据报告 |

### 6.3 Contract 验收

- 所有 Schema 使用严格枚举和版本字段；
- 未知新增字段可按兼容策略忽略，非法必填字段必须拒绝；
- Decision 在 Agent 启动前持久化；
- selected/ready/failed 全部关联存在的 decisionId；
- ready items 顺序稳定，bundleHash 跨重放不变化；
- 同一 eventId 重放幂等；
- failed 和 ready 对同一 Decision 互斥；
- 旧 RunRecord、旧 Run Event 和旧请求可按兼容矩阵读取。

### 6.4 性能与 I/O 验收

| 指标 | 门槛 |
|------|------|
| 普通对话正文读取 | `skillBodyReadCount=0` |
| 普通对话文件扫描 | `skillFilesystemScanCount=0` |
| 普通对话 Agent Kit | `agentKitCreateCount=0` |
| 普通对话注入 | `injectedSkills=[]` |
| 按需读取 | 仅 primary、required 和必需资产 |
| 普通 Prompt 大小 | 小于 T01 `0.1.6` 基线的 70% |
| Selector + Registry 查询 p95 | 同机不超过 20 ms |
| 缓存命中 | memory-hit 不读取正文 |
| 历史回放 | 不读取 Skill 正文，不重新运行 Selector |

### 6.5 普通回答质量验收

质量集至少 24 条，覆盖：

- 寒暄和简单事实；
- 错误、代码和概念解释；
- 摘要和短文本整理；
- 模糊请求和合理澄清；
- slug 提及、日志、代码块和否定表达负例；
- 简单问题否决旧 workflow continuation。

五分制 rubric：

| 维度 | 说明 |
|------|------|
| 正确性 | 核心事实、逻辑和结论是否正确 |
| 相关性 | 是否直接回答用户问题，无业务 Skill 污染 |
| 指令遵循 | 格式、语言、范围和约束是否满足 |
| 澄清合理性 | 信息不足时是否问必要问题，信息足够时是否避免多问 |
| 诚实性 | 不伪造 Skill、工具、文件或完整交付 |

通过门槛：

- 三 Agent 分别计算，不以总平均掩盖单一 Agent 回退；
- P0 错误为 0；
- 相对 `0.1.6` 平均下降不超过 0.25；
- 下降至少 1 分的样例不超过 10%；
- 模糊请求和 slug 负例不得错误加载业务 Skill。

### 6.6 模块回归验收

| 模块 | 最低回归 |
|------|----------|
| 写作 | 默认基座、具体模板、需求澄清、Markdown/DOCX 交付 |
| PPT | 默认基座、具体模板、页纲、HTML/PPTX 交付 |
| 视频 | auto/stage/screenplay/poetic 现有绑定不变 |
| 3D | drawing base + parametric/export 依赖与 OpenSCAD fallback 不退化 |
| 推演 | simulation base + world-model bundle，画布/报告事件不退化 |
| 对话 | none、explicit、intent、continuation 和普通质量门禁 |

### 6.7 发布验收

- macOS 测试签名制品通过冷启动、普通对话和 selected Skill 真流；
- Windows NSIS 制品通过同等场景；
- 安装包内 Registry、active Skill、依赖和声明资产完整；
- `0.1.6 -> 0.1.7` 升级后历史消息、Run、交付物和工作区不变；
- V2 开关关闭后恢复旧编排；
- 降级后旧版本能忽略新事件；
- 制品哈希、Agent 版本、测试设备、失败项和回滚步骤全部记录。

---

## 7. 测试命令与证据包

T01 应冻结以下根命令；实现可以调整内部包命令，但发布入口不得依赖人工拼接：

```bash
pnpm skills:verify
pnpm skill-orchestration:contracts
pnpm skill-orchestration:test
pnpm skill-orchestration:e2e
pnpm skill-orchestration:quality
pnpm skill-orchestration:real-agents
pnpm release:version:verify
pnpm skill-orchestration:release-gate
pnpm skill-orchestration:package-acceptance
pnpm skill-orchestration:installed-macos-acceptance
pnpm skill-orchestration:installed-windows-acceptance
```

发布证据包至少包含：

1. `registry-inventory.json`：48 项迁移与 active/disabled 结果；
2. `contracts-report.json`：Schema 正反 fixture；
3. `selector-matrix.json`：AC-01 至 AC-25 Decision 结果；
4. `prompt-baseline.json`：`0.1.6` 与 `0.1.7` Prompt 大小和注入差异；
5. `io-benchmark.json`：扫描、正文读取、Kit、缓存和 p95；
6. `quality-report.json`：三 Agent 质量评分、门禁结果与失败样例；
7. `real-agents-report.md`：Codex、Claude、Hermes 版本和真流记录；
8. `module-regression-report.md`：五个业务模块和对话回归；
9. `release-version-report`：root/Web/API/Companion/Desktop/Video/contracts/runtime-core 和 `PACKAGE_VERSION` 统一校验；
10. `package-report.md`：macOS/Windows 制品哈希和安装验证；
11. `rollback-report.md`：开关、升级、降级和历史数据结果。
12. `installed-macos-report.json`：DMG 临时安装、冷启动、升级、开关回滚、降级和真实用户数据隔离证据。
13. `installed-windows-report.json`：NSIS 安装、冷启动、升级、开关回滚、降级和 Windows 用户数据隔离证据。

---

## 8. Stop-Ship 条件

出现以下任一情况不得进入 RC：

- 普通对话仍注入业务 Skill、Catalog 或创建 Agent Kit；
- Web 或 Agent Adapter 能覆盖/伪造 Companion Decision；
- 任一 Run 没有持久化 Decision；
- slug 引用、代码、日志、URL、否定表达或模糊请求会误选业务 Skill；
- 多个意图冲突时读取多个候选正文；
- required Skill 失败后仍产生 ready；
- 历史回放重新运行 Selector 或补造 Skill 事件；
- selected 后取消仍显示加载中；
- 三 Agent 的 Decision 或 bundle 不一致；
- 任一现有业务模块主流程回归失败；
- 普通回答质量不达门槛；
- root/Web/API/Companion/Desktop/Video/contracts/runtime-core 或 `PACKAGE_VERSION` 版本不一致；
- V2 开关无法恢复 `0.1.6` 路径；
- macOS 或 Windows 测试制品缺少 Registry、Skill 或依赖资产；
- 外部 Agent 真流不可用且仅有 mock 结果。

---

## 9. 完成定义

只有同时满足以下条件，`0.1.7` 才能标记完成：

- [x] T01 Schema、清单、错误码、兼容矩阵和基线全部冻结；
- [x] T02 Registry 生成、校验、Desktop 资源暂存和开发刷新通过；
- [x] T03 Companion 唯一选择权和普通 Prompt 归零通过；
- [x] T04 Selector AC-01 至 AC-16 通过；
- [x] T05 bundle、依赖、缓存和 Agent Kit 验收通过；
- [x] T06 Decision、事件、UI、取消和历史回放通过；
- [x] T07A 自动化、质量、模块和三 Agent 真流通过；
- [ ] T07B 双平台制品、升级、降级和回滚通过；
- [ ] 所有 Stop-Ship 条件均为 false；
- [x] release notes 与当前候选实现行为一致。

截至 2026-07-25，T07A 已完成：确定性测试、浏览器 E2E、五个业务模块回归、三 Agent none/selected 真流和三 Agent 成对回答质量门禁全部通过。Codex、Claude、Hermes 均使用最终 Prompt 哈希 `sha256:7454b60990ec18a93124ba3dc76d9fcaed7e970c996020f9da241f804af8c95d` 完成 24/24 样例，三者均满足 P0=0、平均下降不超过 0.25、下降至少 1 分比例不超过 10% 的门槛。普通 Prompt 为 1833 字符，是 `0.1.6` 5463 字符的 33.6%；正文读取、Agent Kit 创建和文件扫描均为 0，Selector 与 Registry 查询 p95 约 0.004 ms。

T07B 的 macOS 部分已完成：`小窗-macos-0.1.7.dmg` 已通过 ad-hoc 签名、资源完整性、临时安装、冷启动、`0.1.6-rc.3 -> 0.1.7 -> 0.1.6-rc.3`、V2 -> legacy -> V2、历史消息/Run、交付物、工作区和真实用户数据保护验收。当前只剩 Windows NSIS 制品及 Windows 安装态升级、降级和回滚；在 Windows Stop-Ship 清零前不得发布 `0.1.7`。

# 对话模块核心逻辑 — 技术架构与需求

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 创建日期 | 2026-05-21 |
| 状态 | **已决**（混合编排 · 方向引导） |
| 关联 PRD | §6.1 F-QA-001、§6.10 **F-RT-003**、**F-RT-008** |
| 关联分析 | [chat-skill-orchestration-analysis.md](./chat-skill-orchestration-analysis.md) |
| 实现锚点 | `packages/runtime-core`、`companion/src/runs/manager.ts`、`web/src/lib/module-registry.ts` |

---

## 1. 设计目标与原则

### 1.1 目标

对话模块作为小窗 **works 主入口**，在单次 `sessionId` 内完成问答、分析、工作区读写与跨能力协作；**不强控** Agent 每一步用哪个 Skill 或工具，由平台 **把握方向**、由 Agent **自行决策**。

### 1.2 已决原则（v3.3）

| # | 原则 | 说明 |
|---|------|------|
| P1 | **混合编排** | **轻 Push（方向）** + **Agent Pull（执行）**；禁止「每轮强制 Router 注入多个流程 Skill」。 |
| P2 | **少控制、多引导** | 平台只保证：身份、合规、模式基座、Skill **目录可见**、Kit **路径可读**；**不**要求每轮必须 `skill_view` 或命中某 augment。 |
| P3 | **基座来自用户档位** | `fast` → `skill-qa-fast`；`deep` → `skill-qa-deep`（`research`→`deep`）；仅此一条 **确定性 Push**。 |
| P4 | **扩展 Skill 可选** | `skills/` 中 `chatOrchestrable` 条目以 **Catalog 摘要** 进入 system；全文与 `references/` 由 Agent 经 Kit 或读盘 **按需 Pull**。 |
| P5 | **工具不设门禁** | CLI 自带工具 + 领域服务（数据源等）由 Agent 按任务调用；平台 **不**为每个意图预绑定工具列表。 |
| P6 | **禁止全库灌 prompt** | 任意 Run 不得将 `skills/` 全部 `SKILL.md` 正文塞进 system。 |
| P7 | **可观测、可交付** | `run.started` 暴露基座 slug、Catalog 版本、Kit 路径；行为变更优先改 `prompts/`、`skills/`。 |

### 1.3 与非目标

- **非目标：** 每轮 LLM/规则 Router 强制 `augmentSkills[]`（可作为 V1.1 **可选提示**，默认关闭）。
- **非目标：** 对话 UI 上增加十个「子模式」或「技能按钮」。
- **非目标：** 替代写作/PPT 一级模块的模板向导（对话可 **触发** 同类 Skill，不替代模块 IA）。

---

## 2. 逻辑架构总览

```mermaid
flowchart TB
  subgraph UI["Web 对话 UI"]
    M[mode: fast / deep]
    S[sessionId + projectId]
    U[userTurn + @files]
  end

  subgraph Steer["方向层 · 轻 Push"]
    L0[prompts/platform]
    L4[skill-platform-research-norms]
    BASE[基座 skill-qa-fast / skill-qa-deep]
    CAT[Skill Catalog 摘要]
  end

  subgraph Compose["runtime-core"]
    CP[composeSystemPrompt]
    UT[userTurn]
    KIT[stageAgentKitForRun · 基座 references]
  end

  subgraph Exec["执行层 · Agent Pull"]
    CLI[spawn codex / claude / hermes]
    TOOLS[CLI 工具 + 领域服务]
    READ[读 Agent Kit / 工作区文件]
    OPT[可选读 Catalog 中其他 Skill]
  end

  subgraph Out["输出"]
    SSE[SSE → parts[]]
    ART[projectId 根产出物]
  end

  M --> BASE
  U --> UT
  S --> CLI
  L0 --> CP
  L4 --> CP
  BASE --> CP
  CAT --> CP
  CP --> CLI
  UT --> CLI
  KIT --> READ
  CAT -.->|建议非强制| OPT
  CLI --> TOOLS
  CLI --> READ
  CLI --> OPT
  CLI --> SSE
  CLI --> ART
```

**一句话：** 用户选 **快/深** 定基座；平台拼 **人设 + 规范 + 基座 Skill + 技能目录**；Agent 自己决定要不要读更多 Skill、调什么工具、写哪些文件。

---

## 3. 混合编排：Push 与 Pull 边界

### 3.1 轻 Push（平台必做）

| 注入物 | 来源 | 进入 system | 强制性 |
|--------|------|-------------|--------|
| 平台身份 | `prompts/platform/identity.md` | ✅ | 固定 |
| 通用工作流 | `prompts/platform/workflow.md` | ✅ | 固定 |
| 模式说明 | `prompts/platform/mode-hints.md` | ✅ | 固定 |
| **对话编排指引** | `prompts/platform/chat-orchestration.md` | ✅ | 固定（**方向**，非逐步指令） |
| 横切规范 | `skill-platform-research-norms` | ✅ 正文 | 固定 |
| **基座流程 Skill** | `skill-qa-fast` / `skill-qa-deep` | ✅ 正文 | 由 `binding.mode` 决定 |
| Skill Catalog | `skills/chat-catalog.json` 或生成物 | ✅ **仅摘要**（slug + 一行描述） | 可见即可，**不**强制使用 |

**不 Push（默认）：**

- 其他流程 Skill 全文（`skill-ppt-*`、`skill-wr-*` …）
- 未在 Catalog 登记的 Skill
- 「本轮你必须用某某 Skill」的硬编码 Router 结论（除非用户显式指定，V1.1）

### 3.2 Agent Pull（执行时）

| 能力 | 机制 | 强制性 |
|------|------|--------|
| 基座 `references/` | Agent Kit `runs/<runId>/` + `--add-dir` | Agent **可以**读，基座 Skill 会说明何时读 |
| Catalog 中其他 Skill | Kit 子目录 `catalog/<slug>/` 或 `skill_read` 工具（分期） | **可选**；匹配任务再读 |
| 工作区文件 | `cwd = projectId` 根；`@` 附件 | 按需 |
| CLI 工具 | `web_search`、`grep`、终端、数据源 API 等 | **由 Agent 与 CLI 能力决定**，平台不逐轮筛工具集 |
| 深度子策略 | 写在 `skill-qa-deep` 内 | Agent 自决轻量推理 vs 完整研究 |

### 3.3 引导文案基调（写入 `chat-orchestration.md`）

- 「目录中的 Skill **可能**有助于当前任务；**仅在相关时**加载，简单问题可直接用基座能力回答。」
- 「工具调用 **按需要**使用，避免为展示过程而空转工具。」
- 「用户选 **快速** 时优先短答；选 **深度** 时再考虑多步与研究流程。」

---

## 4. 运行时序列

```text
1. Web POST /v1/runs（或 /api/chat → Companion）
   binding: { moduleId: "chat", mode: "fast"|"deep" }
   messages, projectId, sessionId, agentId

2. normalizeChatMode(mode)  // research → deep

3. resolveChatOrchestration({ mode, moduleId: "chat" })
   → baseProcessSkill: skill-qa-fast | skill-qa-deep
   → catalogSlugs: chat 可见的 slug 列表（静态配置）
   → platformNormSkill: skill-platform-research-norms
   // 无 mandatory augmentSkills

4. stageAgentKitForRun(runId, baseProcessSkill)
   → ~/.jlcresearch/agent-kit/runs/<runId>/
   // MVP：仅同步基座 references
   // V1.1 可选：catalog/ 下按需预置常用 Skill 副本

5. composeRunPrompts({ mode, userText, processSkill, catalog, ... })
   → systemPrompt, userPrompt, meta

6. spawn CLI(cwd=workspaceProjectId, system, user, add-dir=agentKitPath)

7. SSE: run.started → tool.progress → message.delta → run.finished
   Web → parts[]
```

---

## 5. 数据与配置模型

### 5.1 Skill Catalog（对话可见）

**文件（建议）：** `skills/chat-catalog.json`（或由 `scripts/generate-chat-catalog.mjs` 从 frontmatter 生成）

```json
{
  "version": "1",
  "entries": [
    {
      "slug": "skill-ppt-pitch-deck",
      "kind": "workflow",
      "scope": ["chat", "ppt"],
      "summary": "路演 Pitch 结构与成稿；复杂演示任务时参考",
      "requires": ["slide-engine"]
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|------|------|------|
| `slug` | ✅ | 对应 `skills/<slug>/` |
| `kind` | ✅ | `workflow` \| `tool` |
| `scope` | ✅ | 含 `chat` 则进入对话 Catalog |
| `summary` | ✅ | ≤120 字，进 system 索引 |
| `requires` | ⬜ | 领域服务；不可用则在 Catalog 标注「需 V1.1 模块」 |

**MVP：** Catalog **静态维护**，与 `module-registry` 中 PPT/写作 slug 手工对齐；不做运行时 LLM 路由。

### 5.2 `run.started` 扩展字段（建议）

| 字段 | 类型 | 说明 |
|------|------|------|
| `baseProcessSkill` | string | 基座 slug |
| `platformNormSkill` | string | 横切 slug |
| `catalogVersion` | string? | Catalog 版本号 |
| `catalogSlugs` | string[]? | 本轮可见 slug 列表（摘要已进 prompt） |
| `agentKitPath` | string? | Kit 绝对路径 |
| `orchestrationMode` | string | 固定 `"hybrid-steer"` |

**不输出：** `mandatoryAugmentSkills`、`routerConfidence`（除非 V1.1 开启可选提示器）。

### 5.3 与 `module-registry` 关系

| 模块 | 绑定方式 |
|------|----------|
| `chat` | `mode` → **仅**基座 `CHAT_MODE_SKILL` |
| `writing` / `ppt` / … | 仍走各模块 `templateId` / `task`；条目可同时出现在 **chat Catalog** 供对话 Agent 自选 |

`resolveSkills()` **保持**现有签名；新增 `resolveChatOrchestration()` 专供 `moduleId=chat`，内部调用 `resolveSkills` 取基座 + 加载 Catalog。

---

## 6. 功能需求摘要（F-RT-008）

### 6.1 必须（MVP / S1O）

| ID | 需求 |
|----|------|
| R1 | 对话 Run 的 system 栈含 L0 + L4 + **单基座** L3 + Catalog 摘要 + Kit 路径说明 |
| R2 | Catalog **不**包含 Skill 全文；全文仅经 Kit 或后续 `skill_read` 获取 |
| R3 | `chat-orchestration.md` 明确 **Skill/工具可选、Agent 自决** |
| R4 | `run.started` 含 `baseProcessSkill`、`catalogSlugs`（或 `catalogVersion`）、`agentKitPath` |
| R5 | 修改 `skill-qa-*` / `prompts/platform` 重启 Companion 即可改变对话倾向，无需改 Web 组件 |
| R6 | **禁止**每 Run 自动注入多个 augment 流程 Skill 正文 |

### 6.2 应当（S1O / S1P）

| ID | 需求 |
|----|------|
| R7 | `composeSystemPrompt` 与 `userTurn` 分离；CLI 双通道 |
| R8 | Activity 可展示「基座：skill-qa-deep」等轻量标签（非强制列表 augment） |
| R9 | 深度档复杂任务仍可落 `report.md` 等于 `projectId` 根（由基座 Skill 指引，非 Router 强制） |

### 6.3 可选（V1.1+）

| ID | 需求 |
|----|------|
| R10 | `skill_read(slug)` 平台工具：从 Kit `catalog/<slug>` 读 SKILL.md |
| R11 | 用户显式 `@skill` 或 `/slug` 强制加载某 Skill 全文入 Kit |
| R12 | **软提示 Router**：仅当关键词高置信时在 Activity 写「可参考 skill-ppt-deck」，**不**改 system 栈 |
| R13 | Hermes CLI 若自带 `skills_list`/`skill_view`，与平台 Catalog **去重说明**写在 `chat-orchestration.md` |

---

## 7. 非功能需求

| 类别 | 要求 |
|------|------|
| Token | Catalog 摘要总量建议 ≤2k tokens（可配置）；基座 Skill + L0 优先 |
| 延迟 | 不增加额外 LLM 路由调用；Catalog 读盘缓存 |
| 安全 | Catalog 仅平台发布；`skill_read` 路径限定在 `JLC_SKILLS_DIR` 与 Kit |
| 并发 | 同 `projectId` 多会话并行仍遵循 PRD OQ-20（串行/锁） |
| 可测 | `pnpm skills:verify` 扩展校验 Catalog 与基座 slug 存在 |

---

## 8. 分阶段实施（路线图 S1O）

| 阶段 | 交付 | 验收 |
|------|------|------|
| **S1O.1** | `prompts/platform/chat-orchestration.md` + 更新 `skill-qa-*` | 文案体现「可选 Skill/工具」 |
| **S1O.2** | `skills/chat-catalog.json` + `composeRunPrompts` 拼 Catalog 段 | system 含摘要列表、无第二 Skill 正文 |
| **S1O.3** | `resolveChatOrchestration` + Companion 接入 | `run.started.orchestrationMode=hybrid-steer` |
| **S1O.4** | UI Activity 可选展示基座 slug | 联调可见 |
| **V1.1** | `skill_read` / `@skill` / 软提示 Router | 独立立项 |

---

## 9. 与 Codex/Cursor/Hermes 的对齐

| 产品 | 小窗混合模式 |
|------|--------------|
| Cursor | 类似：Rules 轻 Push + Skills 目录 Pull + 工具自由调用 |
| Codex app | Thread + 项目目录；Skill 自选；小窗用 `sessionId`+`projectId` 对齐 |
| Hermes-agent | 强制扫 Skill 索引；小窗 **不强制**，仅 **建议** 相关时用 |
| 小窗差异 | 企业 **基座**由 fast/deep 保证；**横切规范**强制；模块注册表管其他入口 |

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-05-21 | 首版：混合编排已决、轻 Push 边界、Catalog、F-RT-008 需求、S1O 分期 |

---

*文档结束*

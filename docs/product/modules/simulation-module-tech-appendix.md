# 推演模块技术附录

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 日期 | 2026-06-26 |
| 状态 | 初版 |
| 关联 PRD | [simulation-module-prd.v0.md](./simulation-module-prd.v0.md) |
| 目的 | 补齐 PRD v0.2 §12.3 列出的工程信息，使研发可直接排期 |

---

## 1. Run / Round / Stage 最终定义

### 1.1 核心关系

```
Run ⊃ Round ⊃ Stage
```

- **Run**：一次 Agent 执行生命周期，`POST /v1/runs` 的一次调用。从 `run.accepted` 到 `run.finished` / `run.error`。
- **Round**：Run 内的一次"Agent 工作 + 用户决策"循环。Run 开始即进入 Round 1。每次 `clarification.required` → 用户选择 → `run.resumed` = 新 Round 开始。
- **Stage**：Agent 内部处理阶段，通过 `run.status` 的 `label` 字段传递，不持久化。

### 1.2 Round 编号与边界

```
Run 1 开始
  → Round 1（Agent: probing → modeling → [waiting_user: entry 确认] → simulating → 保存快照）
  → Round 2（[waiting_user: path 选择] → simulating → 保存快照）
  → Round 3（[waiting_user: variable 重算] → simulating → 保存快照）
  → reporting → [run.finished]

Run 2（续推，binding.previousRunId = "run_1"）
  → Round 1, Round 2, ...
```

Round 边界由 `waiting_user` ↔ `run.resumed` 标记。`currentRoundId` 在 `simulationMeta` 中持久化。

### 1.3 深挖路径的两种情况

| 推演状态 | 深挖路径 | 实现方式 |
|---------|---------|---------|
| Run 处于 `waiting_user` | 同 Run 内新 Round | `POST /v1/runs/:runId/clarification`，Agent resume 后继续 |
| Run 已 `completed` | 新 Run | `POST /v1/runs`，`binding.previousRunId` 携带上一 Run ID |

---

## 2. `simulationMeta` 字段

扩展 `SessionRuntimeRecord`，不新建独立对象。

### 2.1 类型定义

```typescript
// 添加到 companion/src/types.ts

export interface SimulationMeta {
  /** 推演主题 */
  topic: string;

  /** 当前轮次 ID，格式 "round_{N}" */
  currentRoundId: string;

  /** 上一轮 ID（重算/续推时存在） */
  previousRoundId?: string;

  /** 历史轮次 ID 列表（按顺序） */
  roundIds: string[];
}
```

### 2.2 存储位置

`simulationMeta` 作为 `SessionRuntimeRecord` 的可选扩展字段：

```typescript
export type SessionRuntimeRecord = {
  // ... 已有字段 ...
  simulationMeta?: SimulationMeta;  // 新增
};
```

在 `companion/src/sessions/runtime.ts` 的 `saveSessionRuntime` / `loadSessionRuntime` 中，该字段自动序列化/反序列化（JSON 文件存储）。

### 2.3 读写时机

| 时机 | 操作 |
|------|------|
| Run 开始（`run.accepted`） | 创建 `simulationMeta`，`currentRoundId = "round_1"`，`roundIds = ["round_1"]` |
| 每次用户选择后 Run resume | `currentRoundId` 推进到 `"round_{N+1}"`，追加到 `roundIds` |
| Run 完成 | `simulationMeta` 保持最终状态，供后续续推读取 |

---

## 3. `CreateRunBinding.simulation`

### 3.1 类型定义

```typescript
// companion/src/types.ts
export type CreateRunBinding =
  | { moduleId: "chat"; mode: ChatModeId }
  | { moduleId: "writing"; templateId: string }
  | { moduleId: "ppt"; task: "deck" }
  | { moduleId: "3d" }
  | { moduleId: "simulation";          // ← 新增
      previousRunId?: string;          // 续推时携带上一 Run ID
      variableOverrides?: Record<string, unknown>;  // 重算时携带变量覆盖
      scope?: "node" | "path" | "variable" | "counterfactual" | "resimulate";
      targetId?: string;               // scope 对应的目标 ID
    };

// web/src/lib/companion/types.ts（同步更新）
export type CreateRunBinding =
  | { moduleId: "chat"; mode: ChatModeId }
  | { moduleId: "writing"; templateId: string }
  | { moduleId: "ppt"; task: "deck"; templateId?: string }
  | { moduleId: "3d" }
  | { moduleId: "simulation";          // ← 新增
      previousRunId?: string;
      variableOverrides?: Record<string, unknown>;
      scope?: "node" | "path" | "variable" | "counterfactual" | "resimulate";
      targetId?: string;
    };
```

### 3.2 `ModuleId` 同步

```typescript
// companion/src/types.ts — 确认 "simulation" 已在 ModuleId 联合类型中
export type ModuleId = "chat" | "writing" | "ppt" | "3d" | "simulation";
```

### 3.3 `timeoutProfile` 扩展

```typescript
// web/src/lib/companion/types.ts
timeoutProfile?: "default" | "fast" | "deep" | "writing" | "ppt" | "simulation";

// companion/src/config.ts
export type RunTimeoutProfile =
  | "default" | "fast" | "deep" | "writing" | "ppt" | "simulation";

// 新增配置项
runTimeoutSimulationMs: envInt("COMPANION_RUN_TIMEOUT_SIMULATION_MS", 3_600_000), // 60 min

// resolveRunTimeoutMs 增加 case
case "simulation": return config.runTimeoutSimulationMs;

// companion/src/runs/manager.ts — resolveTimeoutProfile 增加
if (req.moduleId === "simulation") return "simulation";
```

推演模块超时设为 60 分钟，与 PPT 模块对齐（推演涉及多轮交互，单次 Run 可能持续较长时间）。

---

## 4. ChatPart Kind 注册清单

### 4.1 新增 Kind

在 `packages/contracts/src/chat.ts` 的 `chatPartKindSchema` 中新增：

```typescript
export const chatPartKindSchema = z.enum([
  // ... 已有 kind ...
  "simulation_requirements",           // 推演需求卡（入口确认）
  "simulation_requirement_summary",    // 推演需求摘要
  "simulation_scenario",               // 推演方案/沙盘结构
  "simulation_node",                   // 画布节点
  "simulation_edge",                   // 画布边
  "simulation_path",                   // 推演路径
  "simulation_summary",                // 推演总结
  "simulation_suggestion",             // 后续推演建议
]);
```

### 4.2 各 Kind 的数据结构

#### `simulation_requirements`

复用平台 `RequirementsPart` 模式，kind 加入 discriminated union：

```typescript
type RequirementsPart = {
  // ... 已有字段 ...
  kind: "writing_requirements" | "ppt_requirements" | "3d_requirements"
      | "simulation_requirements";   // ← 新增
};

type RequirementSummaryPart = {
  // ... 已有字段 ...
  kind: "writing_requirement_summary" | "ppt_requirement_summary" | "3d_requirement_summary"
      | "simulation_requirement_summary";  // ← 新增
};
```

默认标题/描述（`requirements-parts.ts`）：

```typescript
if (kind === "simulation_requirements")
  return "请先确认这次推演的关键信息";
if (kind === "simulation_requirement_summary")
  return "推演需求已确认，开始生成推演方案。";
```

#### `simulation_scenario`

推演方案/沙盘结构，替代 writing_outline / ppt_outline 的角色。在 Agent 完成建模后生成，包含完整的初始沙盘数据。

```typescript
type SimulationScenarioPart = {
  id: string;
  zone: "summary";
  kind: "simulation_scenario";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  title?: string;
  scenario: {
    topic: string;                    // 推演主题
    entities: SimulationNode[];       // 已识别主体
    variables: SimulationNode[];      // 已识别变量
    assumptions: string[];            // 默认假设
    paths: SimulationPath[];          // 初始路径
    edges: SimulationEdge[];          // 因果/时序关系
  };
};
```

HTML 注释标记（`requirements-parts.ts`）：

```typescript
const OUTLINE_BLOCK_MARKERS = {
  // ... 已有 markers ...
  simulation_scenario: {
    start: "<!--JLC:SIMULATION_SCENARIO_START-->",
    end: "<!--JLC:SIMULATION_SCENARIO_END-->",
  },
};

const SUMMARY_BLOCK_MARKERS = {
  // ... 已有 markers ...
  simulation_requirement_summary: {
    start: "<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_START-->",
    end: "<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_END-->",
  },
};
```

#### `simulation_node` / `simulation_edge` / `simulation_path`

画布增量更新，通过 `part.append` / `part.patch` 实时推送：

```typescript
type SimulationNodePart = {
  id: string;
  zone: "activity";
  kind: "simulation_node";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  node: SimulationNode;               // PRD §5.2 定义的节点结构
};

type SimulationEdgePart = {
  id: string;
  zone: "activity";
  kind: "simulation_edge";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  edge: SimulationEdge;               // PRD §5.2 定义的边结构
};

type SimulationPathPart = {
  id: string;
  zone: "summary";
  kind: "simulation_path";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  path: SimulationPath;               // PRD §5.3 定义的路径结构
};
```

#### `simulation_summary`

推演总结，每次 Round 结束或路径选择后更新：

```typescript
type SimulationSummaryPart = {
  id: string;
  zone: "summary";
  kind: "simulation_summary";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  roundId: string;
  markdown: string;                   // 结论摘要 Markdown
  conclusionIds?: string[];           // 关联结论节点 ID
};
```

#### `simulation_suggestion`

后续推演建议：

```typescript
type SimulationSuggestionPart = {
  id: string;
  zone: "summary";
  kind: "simulation_suggestion";
  streamSeq: number;
  streaming: boolean;
  completedAt?: string;
  suggestions: Array<{
    suggestionId: string;
    title: string;
    description: string;
    basedOnConclusionId?: string;     // 基于哪个结论
  }>;
};
```

### 4.3 Kind 用途与阶段映射

| Stage | 产生的主要 ChatPart Kind | 说明 |
|-------|------------------------|------|
| probing → modeling | `message.delta`（追问文字） | Agent 追问补充信息 |
| selecting（waiting_user） | `simulation_requirements`（需求卡） | 用户确认入口设定 |
| selecting → resumed | `simulation_requirement_summary` | 确认后摘要 |
| simulating（Round 1） | `simulation_scenario` | 初始沙盘结构（主体/变量/路径/边） |
| simulating（Round 2+） | `simulation_node` / `simulation_edge` / `simulation_path` | 增量画布更新 |
| summarizing | `simulation_summary` | 推演结论摘要 |
| reporting | `artifact.append` | 报告文件（Markdown） |
| done | `simulation_suggestion` | 后续推演建议 |

---

## 5. Round 快照读写 API

### 5.1 存储路径

```
{companion.dataDir}/simulation/{sessionId}/rounds/{roundId}.json
```

示例：`~/.xiaochuang/data/simulation/sess_abc123/rounds/round_1.json`

### 5.2 快照结构

```typescript
interface CanvasSnapshot {
  roundId: string;                     // "round_1"
  nodes: SimulationNode[];
  edges: SimulationEdge[];
  paths: SimulationPath[];
  selections: SelectionResult[];       // 本轮用户选择记录
  actions: ActionRecord[];             // 本轮操作留痕
  createdAt: string;                   // ISO 8601
}
```

### 5.3 读写接口

不新增 Companion REST API。快照读写通过 Companion 内部函数完成：

```typescript
// companion/src/simulation/snapshot.ts（新文件）

import { config } from "../config.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";

function snapshotDir(sessionId: string): string {
  return `${config.dataDir}/simulation/${sessionId}/rounds`;
}

function snapshotPath(sessionId: string, roundId: string): string {
  return `${snapshotDir(sessionId)}/${roundId}.json`;
}

/** 保存画布快照 */
export async function saveSnapshot(
  sessionId: string,
  snapshot: CanvasSnapshot,
): Promise<void> {
  const dir = snapshotDir(sessionId);
  await mkdir(dir, { recursive: true });
  await writeFile(snapshotPath(sessionId, snapshot.roundId), JSON.stringify(snapshot, null, 2));
}

/** 读取画布快照 */
export async function loadSnapshot(
  sessionId: string,
  roundId: string,
): Promise<CanvasSnapshot | null> {
  try {
    const raw = await readFile(snapshotPath(sessionId, roundId), "utf-8");
    return JSON.parse(raw) as CanvasSnapshot;
  } catch {
    return null;
  }
}

/** 列出所有轮次快照 */
export async function listSnapshots(
  sessionId: string,
): Promise<string[]> {
  try {
    const dir = snapshotDir(sessionId);
    const { readdir } = await import("fs/promises");
    const files = await readdir(dir);
    return files
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", ""))
      .sort();
  } catch {
    return [];
  }
}
```

### 5.4 快照保存时机

在 `companion/src/runs/manager.ts` 的 `executeRunLifecycle` 中，推演模块每次 `waiting_user` 暂停前保存快照：

```typescript
// 在 emit clarification.required 之前
if (req.moduleId === "simulation" && simulationMeta) {
  await saveSnapshot(req.sessionId, buildCurrentSnapshot(simulationMeta, parts));
}
```

快照数据来源：从当前 Run 已发出的 `part.append` 事件中收集 `simulation_node` / `simulation_edge` / `simulation_path` 类型的 Part，合并成完整画布状态。

### 5.5 前端读取快照

前端切换 Round 时，通过 Companion API 获取快照：

```
GET /v1/sessions/:sessionId/simulation/snapshots
GET /v1/sessions/:sessionId/simulation/snapshots/:roundId
```

这两个 API 需要新增到 `companion/src/routes/` 中。

---

## 6. 画布引擎选型

### 6.1 候选方案对比

| 方案 | 优势 | 劣势 | 适合度 |
|------|------|------|--------|
| **React Flow** | 声明式 React 组件；内置缩放/平移/节点拖拽；社区活跃；TypeScript 一等公民 | 定位是"可编辑节点图"，推演画布更偏"可交互只读展示+局部操作" | ★★★★☆ |
| **D3** | 灵活度最高；力导向布局天然适合关系图 | 学习曲线陡；命令式操作与 React 范式冲突；需要大量手写交互逻辑 | ★★★☆☆ |
| **Canvas 自绘** | 性能最优；完全控制渲染 | 工程量最大；无内置交互；测试困难 | ★★☆☆☆ |
| **Mermaid（已有）** | 零新增依赖；已在项目中 | 静态图渲染，不支持交互（点击/缩放/拖拽）；布局不可控 | ★☆☆☆☆ |

### 6.2 推荐方案：React Flow

**理由：**

1. **与 React 生态对齐**：小窗前端基于 React 19 + Next.js，React Flow 是声明式组件，与现有架构一致。
2. **内置交互能力覆盖 MVP**：缩放、平移、节点点击、边高亮、Mini Map、Fit View 均为内置功能，与 PRD §18.1/§18.2 的 MVP 范围高度匹配。
3. **自定义节点/边**：可通过 `nodeTypes` / `edgeTypes` 注册推演专属节点（entity、variable、event、risk、conclusion）和边（causal、temporal、evidence_support），每个类型独立渲染组件。
4. **布局算法可插拔**：React Flow 不内置自动布局，但可与 dagre / elkjs 等布局库组合使用。MVP 可先用 dagre（简单树状/层次布局），后续可换 elkjs（更复杂的正交布局）。
5. **TypeScript 支持**：完整的泛型类型定义，可与 PRD §5.2 的 `SimulationNode` / `SimulationEdge` 类型直接映射。

**需要新增依赖：**

```
@xyflow/react (React Flow v12+，原 reactflow)
dagre (布局算法)
@types/dagre
```

### 6.3 数据映射

PRD §5.2 的数据模型 → React Flow 的数据模型：

```typescript
// PRD SimulationNode → React Flow Node
function toReactFlowNode(sn: SimulationNode): Node {
  return {
    id: sn.id,
    type: sn.type,              // 注册为 custom nodeType
    position: { x: 0, y: 0 },  // 初始由 dagre 布局计算
    data: sn,                   // 完整 SimulationNode 作为 data
  };
}

// PRD SimulationEdge → React Flow Edge
function toReactFlowEdge(se: SimulationEdge): Edge {
  return {
    id: se.id,
    source: se.source,
    target: se.target,
    type: se.type,              // 注册为 custom edgeType
    data: se,
  };
}
```

### 6.4 自定义节点类型注册

```typescript
const simulationNodeTypes = {
  topic: TopicNode,           // 根节点，大号标题
  entity: EntityNode,         // 主体，图标+名称
  variable: VariableNode,     // 变量，含当前值/锁定状态
  event: EventNode,           // 事件，时间标记
  conclusion: ConclusionNode, // 结论，带概率
  risk: RiskNode,             // 风险，警告标记
  evidence: EvidenceNode,     // 证据，可信度标记
  suggestion: SuggestionNode, // 建议，问号图标
};

const simulationEdgeTypes = {
  causal: CausalEdge,           // 实线箭头
  temporal: TemporalEdge,       // 虚线箭头
  evidence_support: EvidenceEdge, // 点线
};
```

---

## 7. 节点/路径级 CLI 参与接口

### 7.1 MVP 范围

仅支持**节点**和**路径**级 CLI 参与，且仅当 Run 处于 `waiting_user` 或 `completed` 状态时可触发。

### 7.2 触发方式

用户在画布中右键节点/路径，或通过底部输入区 `scope: "node" | "path"` 发起 CLI 参与。

### 7.3 接口定义

不新增 REST API。CLI 参与通过现有 Run 队列机制执行：

**场景 A：Run 处于 `waiting_user`**

1. 用户在节点上选择 CLI 参与
2. 前端将 CLI 参与请求作为 `clarification` 的一部分提交
3. `POST /v1/runs/:runId/clarification`，payload：

```json
{
  "answers": [],
  "cliInvocation": {
    "agentId": "codex",
    "scope": "node",
    "targetId": "node_001",
    "purpose": "evidence_check"
  }
}
```

4. Companion 在 resume Run 时，将 CLI 输出注入 Agent prompt context
5. Agent 将 CLI 结果写回画布节点（`part.patch` simulation_node）

**场景 B：Run 已 `completed`**

1. 用户在节点上选择 CLI 参与
2. 前端创建新 Run，binding 携带 CLI 信息
3. `POST /v1/runs`，binding：

```json
{
  "moduleId": "simulation",
  "previousRunId": "run_1",
  "scope": "node",
  "targetId": "node_001",
  "cliAgentId": "codex"
}
```

4. 新 Run 的 Agent 加载上一 Run 的最新快照，对指定节点调用 CLI，将结果写回

### 7.4 操作留痕

无论哪种场景，CLI 参与都记录到操作留痕：

```json
{
  "actionId": "act_cli_001",
  "type": "cli_invoke",
  "agentId": "codex",
  "scope": "node",
  "targetId": "node_001",
  "roundId": "round_2",
  "purpose": "evidence_check",
  "outputSummary": "该变量的历史数据支持当前假设，置信度为高",
  "createdAt": "2026-06-26T10:00:00+08:00"
}
```

---

## 8. Skill 定义

### 8.1 Skill 目录

```
skills/skill-simulation-base/
├── SKILL.md
└── (后续可扩展子 Skill)
```

### 8.2 SKILL.md 骨架

```markdown
---
slug: skill-simulation-base
module: simulation
task: base
version: "1.0"
label: 推演需求采集与沙盘生成基座
---

# Goal
收集用户推演问题的关键信息，生成结构化推演方案（simulation_scenario），
驱动画布渲染，并在路径选择和变量重算时继续推演。

# When to use
当 moduleId === "simulation" 且无下游 Skill 匹配时，作为默认 Skill 激活。

# Core principles
1. 推演不是一次性回答，是多轮结构化过程
2. 先收敛问题，再生成沙盘
3. 每次用户选择都驱动新 Round
4. 画布变更必须通过 ChatPart 事件推送，不能只输出文字
5. 变量修改必须先提示影响范围，再由用户确认重算
6. 报告内容必须来源于推演过程
7. 推荐续推必须基于当前结论

# Mandatory flow
1. **判断充分性**：用户输入是否足以开始推演
2. **结构化追问**：通过 `simulation_requirements` 需求卡追问缺失信息
3. **需求摘要**：确认后生成 `simulation_requirement_summary`
4. **生成推演方案**：输出 `simulation_scenario`（主体/变量/路径/边）
5. **路径选择**：等待用户选择路径，继续深入推演
6. **变量重算**：用户修改变量后，基于新变量重新推演
7. **总结与报告**：生成 `simulation_summary` + 报告文件 + `simulation_suggestion`

# Output format
- 需求卡：`<!--JLC:SIMULATION_REQUIREMENTS_START-->` ... `<!--JLC:SIMULATION_REQUIREMENTS_END-->`
- 需求摘要：`<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_START-->` ... `<!--JLC:SIMULATION_REQUIREMENT_SUMMARY_END-->`
- 推演方案：`<!--JLC:SIMULATION_SCENARIO_START-->` JSON ... `<!--JLC:SIMULATION_SCENARIO_END-->`
- 总结：`<!--JLC:SIMULATION_SUMMARY_START-->` Markdown ... `<!--JLC:SIMULATION_SUMMARY_END-->`

# Prohibitions
- 不要一次性输出完整推演结论，必须经过需求确认和路径选择
- 不要将画布数据只以文字描述，必须用结构化 JSON 输出
- 不要在变量修改后静默重算，必须先提示影响范围
- 不要推荐与当前推演无关的泛化问题
```

### 8.3 Skill 注册

```typescript
// web/src/lib/module-registry.ts

export type SkillResolveInput =
  | { moduleId: "chat"; binding: { mode: string } }
  | { moduleId: "writing"; binding?: { templateId?: string } }
  | { moduleId: "ppt"; binding: { task: "deck"; templateId?: string } }
  | { moduleId: "3d"; binding?: Record<string, never> }
  | { moduleId: "simulation"; binding?: { previousRunId?: string } };  // ← 新增

export function resolveSkills(input: SkillResolveInput): ResolvedSkills {
  switch (input.moduleId) {
    // ... 已有 cases ...
    case "simulation": {
      base.processSkill = "skill-simulation-base";
      return base;
    }
  }
}
```

---

## 9. Companion 侧修改清单

### 9.1 类型变更

| 文件 | 变更 |
|------|------|
| `companion/src/types.ts` | `ModuleId` 加 `"simulation"`；`CreateRunBinding` 加 simulation 变体 |
| `companion/src/config.ts` | `RunTimeoutProfile` 加 `"simulation"`；加 `runTimeoutSimulationMs` 配置项；`resolveRunTimeoutMs` 加 simulation case |

### 9.2 注册变更

| 文件 | 变更 |
|------|------|
| `companion/src/module-segments.ts` | `MODULE_WORKSPACE_SEGMENTS` 加 `simulation: "推演"`；`MODULE_DEFAULT_TASK_NAMES` 加 `simulation: "新推演"` |

### 9.3 运行时变更

| 文件 | 变更 |
|------|------|
| `companion/src/runs/manager.ts` | `resolveTimeoutProfile` 加 simulation 分支；`buildPromptContextNotes` 加 simulation 分支 |
| `companion/src/runs/requirements-parts.ts` | `normalizeRequirementsKind` 加 simulation 分支；`defaultTitle` / `defaultDescription` 加 simulation；`OUTLINE_BLOCK_MARKERS` / `SUMMARY_BLOCK_MARKERS` 加 simulation markers；`buildStructuredOutline` 加 simulation_scenario 解析 |

### 9.4 新增文件

| 文件 | 说明 |
|------|------|
| `companion/src/simulation/snapshot.ts` | Round 快照读写函数 |
| `companion/src/routes/simulation.ts` | 快照查询 API（`GET /v1/sessions/:sessionId/simulation/snapshots`、`GET /v1/sessions/:sessionId/simulation/snapshots/:roundId`） |

### 9.5 路由注册

在 `companion/src/server.ts` 中注册 simulation 路由：

```typescript
import simulationRoutes from "./routes/simulation.js";
app.register(simulationRoutes);
```

---

## 10. Web 侧修改清单

### 10.1 类型变更

| 文件 | 变更 |
|------|------|
| `web/src/lib/companion/types.ts` | `CreateRunBinding` 加 simulation 变体；`timeoutProfile` 加 `"simulation"` |

### 10.2 注册变更

| 文件 | 变更 |
|------|------|
| `web/src/lib/module-registry.ts` | `SkillResolveInput` 加 simulation 变体；`resolveSkills` 加 `case "simulation"` |
| `web/src/lib/module-chat-config.ts` | `ChatSurfaceModuleId` 加 `"simulation"`；`MODULE_CHAT_SURFACES` 加 simulation 配置；`getChatSurfaceFromPathname` 加 `/simulation` 判断 |

### 10.3 路由页面

| 文件 | 变更 |
|------|------|
| `web/src/app/(main)/simulation/page.tsx` | 已有，重定向到 `/simulation/new` |
| `web/src/app/(main)/simulation/new/page.tsx` | **新建**，渲染 `<ChatHome surfaceModuleId="simulation" />` |
| `web/src/app/(main)/simulation/[id]/page.tsx` | **新建**，渲染 `<ChatThread id={id} surfaceModuleId="simulation" />` |

### 10.4 组件变更

| 文件 | 变更 |
|------|------|
| `web/src/components/modules/ModuleContent.tsx` | `SimulationBetaPanel` 替换为真实推演画布组件 |
| `web/src/components/simulation/SimulationCanvas.tsx` | **新建**，React Flow 画布主组件 |
| `web/src/components/simulation/SimulationNodeTypes.tsx` | **新建**，自定义节点渲染组件 |
| `web/src/components/simulation/SimulationEdgeTypes.tsx` | **新建**，自定义边渲染组件 |
| `web/src/components/simulation/PathSelector.tsx` | **新建**，路径选择器 |
| `web/src/components/simulation/NodeDetailPanel.tsx` | **新建**，节点详情浮层 |
| `web/src/components/simulation/VariableController.tsx` | **新建**，变量控制器 |
| `web/src/components/simulation/RoundSwitcher.tsx` | **新建**，轮次切换控件 |

### 10.5 Chat Part 渲染

| 文件 | 变更 |
|------|------|
| `web/src/components/chat/parts/PartRenderer.tsx`（或等价分发点） | 加 simulation 系列 kind 的渲染分发：`simulation_requirements` → 复用需求卡渲染器；`simulation_scenario` → 触发画布初始化；`simulation_node` / `simulation_edge` / `simulation_path` → 画布增量更新；`simulation_summary` → 摘要卡片；`simulation_suggestion` → 建议卡片 |

---

## 11. Contracts 包修改清单

| 文件 | 变更 |
|------|------|
| `packages/contracts/src/chat.ts` | `chatPartKindSchema` 加 7 个 simulation kind；`RequirementsPart.kind` 加 `"simulation_requirements"`；`RequirementSummaryPart.kind` 加 `"simulation_requirement_summary"`；新增 `SimulationScenarioPart`、`SimulationNodePart`、`SimulationEdgePart`、`SimulationPathPart`、`SimulationSummaryPart`、`SimulationSuggestionPart` 类型 |
| `packages/contracts/src/runtime.ts` | 无变更（RunStatus / RunEvent 不需要新增） |
| `packages/contracts/src/projects.ts` | 无变更 |

---

## 12. 依赖新增

### 12.1 Web 端

```json
{
  "@xyflow/react": "^12.0.0",
  "dagre": "^0.8.5",
  "@types/dagre": "^0.7.52"
}
```

### 12.2 Companion 端

无新增依赖（快照使用 Node.js 内置 `fs/promises`）。

---

## 13. 实施顺序建议

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0-A：类型与注册** | contracts chatPartKindSchema、companion types、web types、module-registry、module-chat-config、module-segments | 1 天 |
| **P0-B：Skill 骨架** | skill-simulation-base/SKILL.md、companion requirements-parts.ts simulation 分支、manager.ts simulation 分支 | 1 天 |
| **P0-C：路由页面** | simulation/new、simulation/[id]、ChatHome/ChatThread 接入 | 0.5 天 |
| **P1-A：画布渲染** | React Flow 集成、自定义节点/边、布局算法、simulation_scenario 渲染 | 3 天 |
| **P1-B：交互操作** | 路径选择器、节点详情浮层、变量控制器、轮次切换 | 2 天 |
| **P1-C：快照系统** | companion snapshot.ts、snapshot API routes、前端 Round 切换 | 1.5 天 |
| **P2：端到端验收** | 跑通 MVP 12 步闭环（PRD §21） | 1 天 |

**总预估：10 人天**

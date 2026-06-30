# 推演模块 PRD（v0.2 收口版）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.2 |
| 日期 | 2026-06-26 |
| 状态 | 收口版 / 技术附录已完成；导航 / 路由 / 模块注册 / `skill-simulation-base` 已接入；沙盘画布与 Round 快照闭环尚未实现 |
| 目的 | 把「推演」模块的产品形态、画布数据模型、运行时对齐、流程边界讲清楚，技术附录完成后进入研发排期 |
| 关联 | [PRD-小窗.md](../PRD-小窗.md)、[功能清单.md](../功能清单.md)、[chat-core-architecture.md](../../technical/chat-core-architecture.md) |
| 变更摘要 | v0.1→v0.2：统一选择点类型为 6 类（硬/软区分，新增 inspect）；新增画布数据模型（§5.2~5.4）；定义 Run/Round/Stage 关系及重算语义（§5.6，Run 开始即进入 Round 1）；状态机对齐平台 Run Status（§14.3）；SSE 事件映射平台协议（§14.4）；确认页改为内联需求卡（§16.2）；CLI 参与 MVP 限制为节点/路径（§13.2）；MVP 只支持 Round 切换不支持 Stage 切换；报告在右侧工作区打开不做独立报告页；MVP 只验 Markdown 导出；删除 path_membership 边类型；补充异常验收点；深挖路径区分 Run 内/Run 后；§20.3 标注为后续能力 |

---

## 1. 模块定位

### 1.1 一句话定义

**推演 = 对话式输入 + 沙盘式画布输出。**

用户用自然语言提出一个复杂问题，系统在中间画布里把问题拆成主体、变量、假设、路径、触发条件和结果分支，并按阶段推进推演。

### 1.2 核心理解

这个模块里的"画布"不是普通白板，也不是纯展示图。

它更像一个可操作的推演沙盘，承担三件事：

1. 把复杂问题结构化
2. 把推理过程可视化
3. 把多种可能路径并排展开

### 1.3 与对话模块的关系

推演模块复用对话模块的整体页面骨架：

- 左侧：仍然是会话/导航区
- 顶部：仍然是会话标题、状态、工具入口
- 底部：仍然保留输入区
- 中间：从消息流替换为画布
- 右侧：仍然是平台统一工作区，用于展示推演产物

也就是说，**外壳像对话，内容区像推演沙盘。**

### 1.4 三栏职责边界

推演模块必须保持平台已有的三栏工作台一致性，不能把右侧工作区改造成另一套独立交互系统。

职责边界如下：

| 区域 | 职责 | 不承担 |
|------|------|--------|
| 左侧菜单 | 模块导航、推演历史（标题+时间）、新建入口 | 不展示推演详情（摘要/状态/画布内容） |
| 中间画布 | 推演主流程、路径选择、节点查看、变量干预、轮次切换 | 不承载完整报告阅读 |
| 右侧工作区 | 推演报告（文件预览）、证据材料、轮次快照、结构化结果、导出文件 | 不承担核心路径选择和变量操作 |
| 底部输入区 | 基于当前画布上下文继续追问、重算、生成反事实路径 | 不作为普通闲聊输入 |

核心原则：

- 中间画布负责"推演交互"
- 右侧工作区负责"推演产物"
- 画布内选择、节点详情和变量调整可以使用画布浮层或局部面板完成
- 右侧工作区沿用平台统一的文件、报告、预览、导出逻辑
- 左侧推演历史仅展示标题与时间，详情通过点击进入画布查看
- **MVP 报告在右侧工作区以文件预览方式打开，不做独立报告页路由。后续迭代可升级为独立阅读页。**

### 1.5 核心产品形态

推演模块实际包含三层：

- 入口层：新建推演、历史推演、续推建议
- 推演层：自动推演、沙盘观察舱、焦点路线、轮次切换
- 报告层：推演总结、综合分析报告、参考资料、后续推演建议

---

## 2. 产品目标

### 2.1 目标

- 让复杂问题不只停留在文字回答，而是变成可展开、可比较、可回看的一张推演图
- 让用户能看见 AI 的判断依据、假设和路径分叉
- 让"分析"从静态结论升级成动态过程
- 让推演结果具备明确的结论产物、报告产物和继续推演入口

### 2.2 适用场景

- 商业决策推演
- 市场走势推演
- 风险事件推演
- 政策/舆情影响推演
- 竞争对手动作推演
- 战略选择对比
- 专题事件复盘
- 产业路径判断
- 公共事件后续影响分析

---

## 3. 画布要干什么

### 3.1 画布的职责

画布负责承载推演过程中的"结构化中间态"，主要包括：

- 问题拆解
- 主体关系
- 变量列表
- 假设条件
- 阶段演化
- 分支路径
- 概率或置信度变化
- 风险点和触发点
- 结论收束
- 后续推演建议

### 3.2 画布中的选择点

推演不是纯自动播放，画布中必须保留明确的"人来做选择"的环节。

选择点分为 6 类，其中 **硬选择点**驱动状态机流转，**软选择点**仅影响画布展示：

| 类型 | 说明 | 硬/软 |
|------|------|-------|
| `entry` | 入口确认：确认 AI 识别出的主题、主体、变量、推演方向和初始假设 | **硬** |
| `path` | 路径选择：对 R1/R2/R3 等焦点路线做选择，决定继续深入哪条路径 | **硬** |
| `variable` | 变量确认：确认重算触发新 Round | **硬**（确认时） |
| `scenario` | 情景切换：选择主情景、风险情景或反事实情景 | 软（不驱动状态机，仅切换视图焦点） |
| `inspect` | 点击查看：点击节点/路径查看解释详情 | 软（不驱动状态机，仅展示浮层） |
| `report` | 报告选择：选择生成过程报告或综合分析报告 | 软 |

硬选择点的核心规则：**没有选择，就没有下一轮推演。** 这些选择点是推演状态机的一部分，必须写入选痕记录。

软选择点不影响状态机，但影响画布展示和右侧工作区内容。

### 3.3 画布不负责什么

- 不承担普通聊天消息列表的职责
- 不做单纯的空白绘图工具
- 不替代最终报告正文
- 不把所有信息都塞成一个无限大白板
- 不把推荐区做成纯随机联想

---

## 4. 核心流程

```text
用户提出问题
→ AI 先追问必要条件
→ 生成推演主题与结构
→ 用户确认入口设定（硬选择点：entry）
→ 进入自动推演模式
→ 画布出现初始沙盘
→ 形成多条路径
→ 用户做路径选择（硬选择点：path）
→ 用户点击节点/路径查看解释（软选择点：inspect）
→ 用户切换情景视图（软选择点：scenario）
→ 用户调整变量或假设
→ 确认重算（硬选择点：variable）
→ 重新推演（同 Run 内新 Round）
→ 输出结论与摘要
→ 生成推演报告（右侧工作区打开）
→ 基于结论给出后续推演建议
```

---

## 5. 画布信息结构

### 5.1 对象类型

画布至少包含以下几类对象：

| 对象 | 说明 | 图结构映射 |
|------|------|-----------|
| 主题 | 本次推演的问题定义 | 根节点（topic） |
| 主体 | 参与方、角色、组织、对象 | 节点（entity） |
| 变量 | 影响结果的关键因素 | 节点（variable） |
| 假设 | 当前推演默认成立的前提 | 变量节点的属性或独立节点（variable） |
| 事件 | 某阶段发生的动作或外部冲击 | 节点（event） |
| 路径 | 不同条件下的演化分支 | 边的有序集合（path） |
| 结果 | 每条路径的阶段性结论 | 节点（conclusion） |
| 风险 | 可能失效的点 | 节点（risk） |
| 证据 | 支撑某个判断的来源或依据 | 节点（evidence） |
| 建议 | 下一轮值得继续追问的问题 | 节点（suggestion） |

### 5.2 节点与边

画布是一个有向图，节点通过边连接。

**节点类型枚举：**

```typescript
type SimulationNodeType =
  | "topic"       // 主题：推演问题定义，每张画布有且仅有 1 个根节点
  | "entity"      // 主体：参与方、角色、组织
  | "variable"    // 变量：影响结果的关键因素，含假设
  | "event"       // 事件：某阶段发生的动作或外部冲击
  | "conclusion"  // 结论：路径的阶段性结果
  | "risk"        // 风险：可能失效的点
  | "evidence"    // 证据：支撑判断的来源或依据
  | "suggestion"; // 建议：下一轮值得继续追问的问题
```

**边类型枚举：**

```typescript
type SimulationEdgeType =
  | "causal"            // 因果关系：A 导致 B
  | "temporal"          // 时序关系：A 先于 B
  | "evidence_support"; // 证据支撑：证据 E 支撑判断 A
```

> 注意：路径归属不通过边类型表达，而是通过 `SimulationPath.edgeIds` 定义——路径是一组边的有序集合，哪些边属于哪条路径由 `SimulationPath` 对象决定。

**节点结构：**

```typescript
interface SimulationNode {
  id: string;
  type: SimulationNodeType;
  label: string;
  detail?: string;
  roundId: string;        // 创建该节点的轮次
  pathIds?: string[];     // 该节点属于哪些路径
  // 变量专属字段（type === "variable" 时有效）
  locked?: boolean;       // 是否锁定
  value?: unknown;        // 当前值（数值/枚举/布尔/字符串）
  defaultValue?: unknown; // 初始值（用于恢复默认）
  valueSchema?: {         // 变量的类型描述
    kind: "number" | "enum" | "boolean" | "priority" | "datetime";
    range?: [number, number];   // kind=number 时
    options?: string[];         // kind=enum 时
    unit?: string;              // kind=number 时
  };
  // 证据专属字段（type === "evidence" 时有效）
  evidenceSource?: string;     // 来源
  evidenceCredibility?: "high" | "medium" | "low";
}
```

**边结构：**

```typescript
interface SimulationEdge {
  id: string;
  type: SimulationEdgeType;
  source: string;         // 源节点 ID
  target: string;         // 目标节点 ID
  label?: string;         // 关系描述
  roundId: string;        // 创建该边的轮次
}
```

### 5.3 路径

路径不是独立的图结构，而是**一组边的有序集合**，代表一条演化分支。

```typescript
interface SimulationPath {
  id: string;              // 如 "R1"
  label: string;           // 如 "最可能路径"
  probability?: number;    // 概率或置信度（0~1）
  status: "available" | "selected" | "excluded" | "locked";
  edgeIds: string[];       // 路径包含的边序列（有序）
  summary?: string;        // 路径摘要
  roundId: string;         // 创建该路径的轮次
  excludedReason?: string; // 排除原因（status=excluded 时）
}
```

### 5.4 画布快照

每个 Round 结束时保存画布全量快照：

```typescript
interface CanvasSnapshot {
  roundId: string;
  nodes: SimulationNode[];
  edges: SimulationEdge[];
  paths: SimulationPath[];
  selections: SelectionResult[];  // 本轮用户选择记录
  actions: ActionRecord[];        // 本轮操作留痕
  createdAt: string;              // ISO 8601
}
```

快照存储位置：Companion data 目录（`{dataDir}/simulation/{sessionId}/rounds/{roundId}.json`），MVP 使用全量 JSON，后续迭代可优化为增量 patch。

> **MVP 只支持 Round 级别快照与切换。** Stage 是 Agent 执行的内部阶段（probing → modeling → simulating 等），用户在 UI 上看到的是 `run.status` 的 label 变化，不需要也不支持在 Stage 之间切换查看。如果后续需要 Stage 级别回看，需补 `StageSnapshot` 数据结构。

### 5.5 画布数据模型与平台的关系

推演画布数据（节点、边、路径、快照）**不新建独立的持久化对象**。推演特有数据通过以下方式与平台已有对象对齐：

| 推演数据 | 平台承载方式 |
|---------|------------|
| 会话元信息（sessionId、projectId、moduleId、binding） | `SessionRuntimeRecord`（已有） |
| 推演业务状态（currentRound、topic） | `SessionRuntimeRecord.simulationMeta`（扩展字段） |
| 画布节点/边/路径变更 | `part.append` / `part.patch`（ChatPart kind: `simulation_node` / `simulation_edge` / `simulation_path`） |
| 画布快照（每轮） | Companion data 目录 JSON 文件 |
| 推演报告 | Workspace 文件（Markdown） |
| 操作留痕 | Companion data 目录 JSON 文件（嵌入画布快照） |

### 5.6 Run / Round / Stage 的关系

这是推演模块最核心的运行时模型，必须对齐一致。

**定义：**

- **Run**：一次 Agent 执行生命周期。从 `run.accepted` 到 `run.finished` / `run.error`。对应平台 `POST /v1/runs` 的一次调用。
- **Round**：Run 内的一次"Agent 工作 + 用户决策"循环。**Run 开始即进入 Round 1**，Round 内 Agent 先做 probing/modeling 等工作，然后暂停等待用户选择（`waiting_user`），用户提交选择后 Run 恢复（`run.resumed`），开始 Round 2。每个 Round = Agent 工作段 + 一次硬选择点。
- **Stage**：Agent 在某个 Round 内的处理阶段（probing → modeling → simulating → summarizing → reporting），是 Agent 内部状态，通过 `run.status` 的 label 字段传递。MVP 不持久化、不支持切换。

**关系：Run ⊃ Round，Round ⊃ Stage。**

```
Run 1（一次 Agent 执行）
├── Round 1（Run 开始即进入，Agent 初始工作 → entry 确认 → 生成初始沙盘）
│   ├── Stage: probing → modeling
│   ├── [waiting_user] → 用户确认入口设定（entry 硬选择点）
│   └── Stage: simulating → 生成 3 条路径 + 初始沙盘
│   → 保存 Round 1 画布快照
│
├── Round 2（用户路径选择 → 深入推演）
│   ├── [waiting_user] → 用户选择路径 R1（path 硬选择点）
│   └── Stage: simulating → 基于 R1 深入推演 → 结论 + 报告草稿
│   → 保存 Round 2 画布快照
│
├── Round 3（用户变量调整 → 重算）
│   ├── [waiting_user] → 用户修改变量并确认重算（variable 硬选择点）
│   └── Stage: simulating → 用新变量重算 → 更新后的路径 + 总结
│   → 保存 Round 3 画布快照
│
└── Stage: reporting → 生成最终报告
    → [run.finished]

Run 2（续推：基于 Run 1 的结论发起新推演）
├── binding: { previousRunId: "run_1", ... }
└── Round 1, Round 2, ...
```

**关键规则：**

1. **Run 开始即进入 Round 1**。Round 1 包含 Agent 的初始工作（probing → modeling）和第一个硬选择点（entry 确认）。
2. **一个 Run 可以包含多个 Round**。每次 Agent 暂停等待用户选择（`waiting_user` → `clarification.required`），用户提交选择后 Run 恢复（`run.resumed`），进入下一个 Round。
3. **每个 Round = Agent 工作段 + 一次硬选择点**（第一轮的 entry 确认、后续轮的 path/variable 选择）。
4. **每个 Round 结束时保存画布快照**，用户可切换 Round 查看历史。
5. **Stage 是 Agent 执行的内部阶段**，MVP 不支持 Stage 切换，用户只能切换 Round。
6. **重算 = 同一 Run 内新 Round**。用户修改变量 → 确认重算 → `clarification.required`（含 variableOverrides）→ `run.resumed` → Agent 基于新变量继续推演。旧 Round 快照保留。
7. **深挖路径分两种情况**：Run 未完成且处于 `waiting_user` 时，深挖路径 = 同 Run 内新 Round；Run 已 `completed` 时，深挖路径 / 续推 = 新 Run（`binding` 携带 `previousRunId`）。
8. **Run 失败时**，用户可选择重试（同 Run 重试，取决于平台 Run 重试机制）或基于已保存快照发起新 Run。

### 5.7 重算语义

**重算 = 在同一 Run 内通过 clarification/resume 创建新 Round，旧 Round 保留为历史快照。**

具体流程：

1. 用户修改变量 → 显示影响预览（不立即生效）
2. 用户确认重算 → 提交 clarification（`POST /v1/runs/:runId/clarification`），携带 `{ variableOverrides, scope, targetId }`
3. Run 从 `waiting_user` 恢复为 `running`（`run.resumed`）
4. Agent 从上一轮画布状态恢复，应用变量覆盖，重新推演
5. 旧 Round 画布快照不变，用户可随时切回查看
6. 新 Round 生成后，画布切换到最新状态

重算不删除旧数据，不覆盖旧路径。用户可以在路径选择器中看到所有历史路径和当前路径的对比。

---

## 6. 交互方式

### 6.1 基础交互

- 新建推演
- 确认推演主题、主体、变量和初始假设（硬选择点：entry）
- 选择初始路径或焦点路线（硬选择点：path）
- 点击节点查看解释（软选择点：inspect）
- 切换情景视图（软选择点：scenario）
- 展开路径分支
- 锁定某个变量
- 修改假设后重算（硬选择点：variable）
- 切换轮次
- 收藏某条路径作为重点结论
- 查看报告（软选择点：report，右侧工作区打开）
- 导出结果

### 6.2 可能的视图

- 结构图视图
- 路径树视图
- 时间轴视图
- 结论摘要视图
- 风险矩阵视图
- 推荐续推视图

---

## 7. 模块形态建议

### 7.1 页面布局

建议保持与对话模块一致的工作台结构：

- 左侧：会话列表 / 推演历史
- 中间：画布主区域，负责推演交互
- 右侧：统一工作区，负责推演产物展示
- 底部：输入与控制区

首页还应保留：

- 开启新推演
- 推演历史
- 续推建议

### 7.2 画布主区域建议分层

1. 顶层：推演主题与状态
2. 中层：主体/变量/路径图
3. 底层：结论、风险、证据、后续建议

### 7.3 右侧工作区建议

右侧工作区应与平台其他模块保持一致，不做独立的推演控制台。

右侧工作区默认承载以下推演产物：

| 产物 | 说明 |
|------|------|
| 推演报告 | 综合分析报告，以文件预览方式打开（Markdown），可导出 |
| 推演快照 | 每一轮 `Round` 的画布快照（Round 级别，非 Stage 级别）、路径选择记录、变量变更记录 |
| 证据材料 | 上传材料、引用来源、证据片段、可信度说明 |
| 结构化结果 | 路径对比表、风险矩阵、变量清单、主体关系表 |
| 生成文件 | Markdown、图片、数据 JSON 等 |

右侧工作区的交互应沿用现有平台工作区能力：

- 打开文件
- 预览报告
- 查看历史版本
- 复制 / 导出
- 从报告或证据跳回对应画布节点

右侧工作区不承担以下核心推演操作：

- 路径选择
- 变量调整
- 节点展开 / 折叠
- 轮次切换
- 局部重算确认

这些操作应发生在中间画布、画布浮层或底部输入区中。

---

## 8. 模块边界

### 8.1 先做

- 结构化推演画布
- 多路径展示
- 阶段推进
- 节点查看与解释
- 变量调整后重算
- 推演总结
- 综合分析报告
- 推荐后续推演
- Markdown 导出

### 8.2 暂不做

- 复杂协同编辑
- 通用白板绘图能力
- 无限制自由标注工具
- 独立报告管理中心
- 过重的模板市场
- 预测市场交易
- PDF 导出（后续迭代）
- Stage 级别快照与切换

---

## 9. 设计原则

- 画布是"推演过程的容器"，不是装饰
- 先结构化，再可视化
- 先解释路径，再追求美观
- 推演结果必须可回看、可复盘、可修改
- 画布要服务决策，不要抢走决策本身
- 报告要先给结论，再给证据
- 推荐续推要围绕当前沙盘，而不是泛化推荐

---

## 10. 未决问题

### 10.1 MVP 前必须关闭

| # | 问题 | 建议结论 | 状态 |
|---|------|---------|------|
| 2 | 画布的默认结构是树状、时间轴还是混合视图 | MVP 默认结构图视图（因果图），路径树视图作为辅助切换 | 待确认 |
| 5 | 是否允许用户手动添加分支 | MVP 不允许手动添加，只能通过底部输入区要求 AI 生成反事实路径 | 待确认 |

### 10.2 已关闭

| # | 问题 | 结论 |
|---|------|------|
| 1 | 推演模块是否作为一级模块进入主导航 | 是。已在 `navigation.ts` 注册，badge: "Beta" |
| 3 | 是否需要"自动生成变量池" | MVP 不做独立变量池管理 UI，变量由 Agent 在建模阶段自动建议 |
| 4 | 结论是否要支持置信度或概率标注 | 是。路径选择器已定义 `probability` 字段，证据节点支持 `evidenceCredibility` |
| 6 | 推演结果是否要导出成报告 | 是。§8.1 已明确，支持 Markdown 导出 |
| 7 | 是否需要历史推演对比 | MVP 只支持同一 Session 内不同 Round 的切换对比，不支持跨 Session 对比 |
| 8 | 是否允许多轮推演叠加在同一画布上 | 是。每轮 Round 叠加在画布上，通过 Round 切换器查看不同轮次快照 |
| 9 | 节点级智能体 CLI 参与的配置入口放在哪 | MVP 统一放底部输入区（已有 `scope`+`targetId` 上下文绑定），不另加入口 |

---

## 11. 初步结论

目前可以先把它定义成：

**推演模块 = 对话式入口 + 沙盘画布 + 路径推演 + 结论收束。**

更完整一点说：

**推演模块 = 入口层 + 推演层 + 报告层。**

---

## 12. 研发可用性判断

### 12.1 现在能不能指导研发

本版 PRD 已足够进入交互原型与技术附录阶段。技术附录完成后可进入研发排期。

### 12.2 已经足够明确的部分

- 产品定位
- 页面骨架
- 画布承担什么，不承担什么
- 核心用户流程
- 报告层结构
- 推荐续推机制
- 需要导出的结果形式
- 画布数据模型（§5.2~5.4）
- Run / Round / Stage 关系（§5.6）
- 重算语义（§5.7）
- 状态机与平台 Run Status 映射（§14.3）
- SSE 事件与平台协议映射（§14.4）
- 选择点类型与硬/软区分（§3.2）
- 报告在右侧工作区打开（§1.4）

### 12.3 还需要补齐的工程信息

要进入研发排期，还需要一份技术附录，补齐：

1. 画布引擎选型（React Flow / D3 / Canvas 自绘），建议在技术附录中评估
2. ChatPart kind 注册清单（`simulation_node`、`simulation_edge`、`simulation_path`、`simulation_summary`、`simulation_requirements`、`simulation_requirement_summary`、`simulation_suggestion`），建议在技术附录中定义
3. `CreateRunBinding` 的 simulation 变体字段，建议在技术附录中定义
4. Skill 定义（`skill-simulation-base`），建议在技术附录中定义
5. 推演 Skill prompt 模板，建议在技术附录中定义
6. Round 快照读写 API 设计，建议在技术附录中定义

### 12.4 结论

这份 PRD 已经足够做：

- 产品评审
- 交互原型
- 前端信息架构
- 推演结果页结构设计
- 画布数据模型设计
- Companion 接入方案设计

要进入研发排期，还需补一份技术附录，把 ChatPart kind 注册、CreateRunBinding、Skill prompt、画布引擎选型、Round 快照 API 和超时配置写清楚。

---

## 13. 智能体 CLI 参与方案

### 13.1 结论先说

推演模块不要求首版实现复杂的多 Agent 硬编排。

更符合小窗的做法是：**默认沿用平台统一 Agent / CLI 主干，在关键节点允许用户配置某个智能体 CLI 参与推演。**

也就是说：

- 系统默认可以用当前选定 Agent 完成通用推演
- 用户可以在某个节点或路径上指定一个可用智能体 CLI 参与
- 该智能体的输出进入当前画布节点或下一轮推演上下文
- 系统不要求在 MVP 中内置"总控 + 多角色 Agent"的完整调度器

### 13.2 节点级参与方式

智能体 CLI 参与应绑定到明确上下文，而不是独立跑一条不可追踪的任务。

| 参与位置 | 示例 | 结果 | MVP |
|------|------|------|-----|
| 节点 | 对某个变量、事件、风险点调用指定 CLI 深挖 | 生成节点解释或证据补充 | 是 |
| 路径 | 对 R1 / R2 / R3 某条路径调用指定 CLI 复核 | 生成路径补充判断 | 是 |
| 阶段 | 对某一阶段调用指定 CLI 做风险排查 | 生成阶段风险节点 | 否（Stage 不持久化，阶段级 CLI 与 Stage 快照缺失冲突） |
| 报告 | 对总结草稿调用指定 CLI 复核 | 生成修订建议或引用补充 | 否 |

### 13.3 配置要求

用户配置智能体 CLI 时，至少需要明确：

- 使用哪个已接入 CLI / 模型（`agentId`）
- 作用范围：节点或路径（MVP）；阶段或报告（后续迭代）
- 输入上下文：`nodeId` / `pathId` / `roundId`
- 输出用途：补证据、找反例、生成分支、复核报告等

配置结果需要写入推演记录，便于回看。

### 13.4 运行规则

- 没有配置智能体 CLI 时，推演仍然可以运行
- 配置智能体 CLI 后，该智能体只参与指定节点或阶段，不接管整个推演
- 智能体输出必须归档到对应画布对象或右侧工作区产物
- 如果多个智能体输出冲突，画布应展示冲突点和来源，而不是静默合并

### 13.5 MVP 建议

MVP 只需要支持：

- 默认 Agent 完成通用推演
- **仅当推演处于 `waiting_user` 或 `done`（Run 已 completed）状态时**，用户可在节点或路径上手动选择一个已接入智能体 CLI
- 将该 CLI 的输出写回当前节点 / 路径解释
- 在操作留痕中记录参与的 Agent、输入范围和输出摘要

> MVP 限制：CLI 参与不在推演进行中（Run 处于 `running` 状态）触发，避免与平台 Run 队列冲突。后续迭代可支持 `running` 中暂停后触发。

---

## 14. 研发需求规格说明

### 14.1 目标

本章用于把产品语言翻成研发可执行的规格，目标是让前端、运行时、Companion、存储层和智能体 CLI 参与机制都能对齐同一套对象与事件。

### 14.2 核心对象

推演特有数据**不新建独立的持久化对象**，而是扩展现有平台对象：

| 对象 | 说明 | 平台承载方式 |
|------|------|------------|
| 推演会话 | 一次推演会话，绑定 `sessionId` / `projectId` / `moduleId` | `SessionRuntimeRecord`（已有） |
| 推演元信息 | 当前 Round、Topic | `SessionRuntimeRecord.simulationMeta`（扩展字段） |
| 画布节点 | 主体、变量、事件、风险、结论等 | `part.append`（ChatPart kind: `simulation_node`） |
| 画布边 | 节点之间的因果或演化关系 | `part.append`（ChatPart kind: `simulation_edge`） |
| 推演路径 | 不同条件下的演化分支 | `part.append` / `part.patch`（ChatPart kind: `simulation_path`） |
| 推演轮次 | 一轮推演过程，含画布快照 | Companion data 目录 JSON 文件 |
| 推演报告 | 推演总结与综合分析报告 | Workspace 文件（Markdown） |
| 后续建议 | 后续推演建议 | `part.append`（ChatPart kind: `simulation_suggestion`） |
| 智能体参与记录 | 节点 / 路径上调用指定智能体 CLI 的记录 | 操作留痕 + Companion data 目录 |

`simulationMeta` 扩展字段建议结构：

```typescript
interface SimulationMeta {
  topic: string;              // 推演主题
  currentRoundId: string;     // 当前轮次 ID
  previousRoundId?: string;   // 上一轮 ID（重算时）
}
```

> 注意：`currentStage` 不存入 `simulationMeta`，因为 Stage 是 Agent 内部状态，通过 `run.status` 的 label 实时传递，不需要持久化。

智能体参与记录结构：

```json
{
  "agentRunId": "agent_run_001",
  "agentId": "codex",
  "scope": "node",
  "targetId": "node_001",
  "roundId": "round_2",
  "purpose": "evidence_check",
  "status": "running",
  "outputSummary": null,
  "createdAt": "2026-06-25T10:00:00+08:00"
}
```

### 14.3 状态机

推演业务阶段（Stage）与平台 Run Status 的映射关系：

| 推演 Stage | 说明 | 平台 Run Status | SSE 事件 |
|-----------|------|----------------|----------|
| `init` | 已创建，尚未进入推演 | `accepted` | `run.accepted` |
| `probing` | 正在收集问题和补充条件 | `running` | `run.status`（label: "probing"） |
| `modeling` | 正在建模、整理主体与变量 | `running` | `run.status`（label: "modeling"） |
| `selecting` | 正在等待用户做入口或路径选择 | `waiting_user` | `clarification.required` |
| `simulating` | 正在跑路径和分支 | `running` | `run.status`（label: "simulating"） |
| `summarizing` | 正在生成结论摘要 | `running` | `run.status`（label: "summarizing"） |
| `reporting` | 正在生成报告 | `running` | `run.status`（label: "reporting"） |
| `done` | 推演完成 | `completed` | `run.finished` |
| `error` | 推演失败或中断 | `failed` | `run.error` |

状态流转遵循：

```text
init → probing → modeling → selecting → simulating → summarizing → reporting → done
```

- 允许从 `probing`、`modeling`、`selecting`、`simulating` 回退到上一轮重算
- 允许任意状态进入 `error`
- `selecting` 对应平台 `waiting_user`，用户完成选择后 Run 恢复为 `running`（`run.resumed`），开始新 Round
- 同一 Run 内的 Stage 切换通过 `run.status` 事件的 `label` 字段传递
- 用户选择（entry/path/variable 确认）= `clarification.required` → 用户提交 → `run.resumed` = 新 Round 开始

### 14.4 运行时事件

推演模块**复用平台已有 SSE 事件协议**，不自定义 `simulation.*` 事件。

事件映射关系：

| 推演业务事件 | 平台 SSE 事件 | 数据承载方式 |
|------------|-------------|------------|
| 推演开始 | `run.started` | — |
| 推演阶段变更（probing/modeling/simulating 等） | `run.status` | `label` 字段设为 Stage 名称 |
| 某轮开始 | `run.resumed` | 用户提交选择 → Run 恢复 → 新 Round 开始 |
| 需要用户做选择（硬选择点） | `clarification.required` | 复用需求卡机制，kind: `simulation_requirements` |
| 用户完成选择 | `run.resumed` | 选择结果通过 `POST /v1/runs/:runId/clarification` 提交 |
| 新节点生成 | `part.append` | ChatPart kind: `simulation_node`，payload 为 `SimulationNode` |
| 新边生成 | `part.append` | ChatPart kind: `simulation_edge`，payload 为 `SimulationEdge` |
| 路径概率或权重变化 | `part.patch` | ChatPart kind: `simulation_path`，payload 为变更字段 |
| 总结内容更新 | `part.patch` | ChatPart kind: `simulation_summary` |
| 报告可读 | `artifact.append` | Workspace 文件产物 |
| 推演完成 | `run.finished` | — |
| 推演失败 | `run.error` | — |
| 流式文本输出 | `message.delta` | Agent 中间推理文字 |

前端消费端（`chat-parts-reducer.ts`）按 `part.append` / `part.patch` 的 kind 字段分发渲染，推演模块新增的 ChatPart kind 需要在 `chatPartKindSchema` 中注册。

### 14.5 页面与接口

建议研发至少保留以下页面能力：

| 页面/能力 | 说明 |
|----------|------|
| 首页 | 新建推演、推演历史、续推建议 |
| 详情页 | 沙盘观察舱（画布 + 右侧工作区） |
| 导出 | Markdown |

建议接口能力至少包括：

| 接口 | 说明 | 平台映射 |
|------|------|---------|
| 创建推演 | 新建 session 与 topic | `POST /v1/runs`（moduleId: "simulation"） |
| 推演输入 | 用户补充问题、变量、假设 | `POST /v1/runs/:runId/clarification` |
| 推演执行 | 用户选择路径/确认重算 | `POST /v1/runs/:runId/clarification`（同 Run 内新 Round） |
| 续推 | 基于已完成的推演继续 | `POST /v1/runs`（新 Run，binding 携带 previousRunId） |
| 结果查询 | 获取画布、轮次、报告 | 通过 SSE 事件流实时获取；快照通过 Companion data 读取 |
| 导出结果 | 导出 Markdown | 复用平台 Workspace 导出能力 |

### 14.6 平台接入清单

推演模块需要在以下平台注册点对齐：

| 注册点 | 文件 | 当前状态 | 需要补充 |
|--------|------|---------|---------|
| `CreateRunBinding` | `companion/src/types.ts`、`web/src/lib/companion/types.ts` | 无 simulation 变体 | 加 `{ moduleId: "simulation"; previousRunId?: string; variableOverrides?: Record<string, unknown> }` |
| `ChatSurfaceModuleId` | `web/src/lib/module-chat-config.ts` | 不含 simulation | 加 `"simulation"` |
| `MODULE_WORKSPACE_SEGMENTS` | `companion/src/module-segments.ts` | 不含 simulation | 加 `simulation: "推演"` |
| `requirementsKindForRun()` | `companion/src/runs/requirements-parts.ts` | 无 simulation 分支 | 加 `"simulation_requirements"` |
| `normalizeRequirementsKind()` | `companion/src/runs/requirements-parts.ts` | 无 simulation 分支 | 加 simulation 分支 |
| `buildPromptContextNotes()` | `companion/src/runs/manager.ts` | 无 simulation 分支 | 加 simulation prompt 上下文 |
| `resolveSkills()` | `web/src/lib/module-registry.ts` | 无 simulation 分支 | 定义 `processSkill: "skill-simulation-base"` |
| `resolveTimeoutProfile()` | `companion/src/runs/manager.ts` | 无 simulation profile | 加 `"simulation"` profile |
| `chatPartKindSchema` | `packages/contracts/src/chat.ts` | 无 simulation kind | 加 `simulation_node`、`simulation_edge`、`simulation_path`、`simulation_summary`、`simulation_requirements`、`simulation_requirement_summary`、`simulation_suggestion` |

### 14.7 智能体 CLI 参与规格

推演模块允许用户在画布节点或路径上配置某个已接入的智能体 CLI 参与，但不要求实现完整多 Agent 编排器。

配置结构建议：

```json
{
  "agentRunId": "agent_run_001",
  "agentId": "codex",
  "scope": "node",
  "targetId": "node_001",
  "roundId": "round_2",
  "purpose": "evidence_check",
  "status": "running"
}
```

运行要求：

- 未配置智能体 CLI 时，推演仍使用默认 Agent 主干运行
- 配置智能体 CLI 时，必须绑定明确的 `scope` 和 `targetId`
- **MVP 限制：仅当 Run 处于 `waiting_user` 或 `completed` 状态时可触发 CLI 参与**，避免与平台 Run 队列冲突
- 智能体输出必须写回对应节点、路径或右侧工作区产物
- 输出结果需要保留摘要、来源 Agent 和创建时间

### 14.8 研发验收口径

以下条件满足后，研发可认为 MVP 具备可验收性：

- 能创建推演会话
- 能生成至少 1 个主题和 1 张沙盘画布
- 能展示至少 2 条路径或分支（建议 3 条，但不强制）
- 能输出推演总结
- 能输出综合分析报告（右侧工作区文件预览）
- 能给出至少 2 条后续推演建议
- 能导出 Markdown
- 能在失败时回传明确错误状态并可重试
- 用户做路径选择后能影响下一轮推演
- 用户修改变量确认重算后能在同一 Run 内生成新 Round，旧 Round 保留可回看
- 右侧工作区能展示推演报告和结构化结果

### 14.9 研发注意事项

- 画布节点不要只做静态图，必须能响应轮次变化
- 报告内容必须来源于推演过程，不能与画布脱节
- 推荐续推必须基于当前推演的结论，不要变成泛化问答
- 智能体 CLI 的参与范围要可追踪，至少保留 Agent ID、输入范围、输出摘要和关联画布对象
- MVP 不要求完整多 Agent 编排；只要求默认 Agent 主干 + 节点 / 路径级 CLI 参与
- 画布中的硬选择点必须可回传到状态机，不能只停留在视觉点击
- 每个新 Round 必须保存画布全量快照，不要依赖增量恢复
- 重算不删除旧 Round，新旧 Round 并存于推演历史
- 报告在右侧工作区打开，不做独立报告页路由

---

## 15. 交互流程说明

### 15.1 首页入口流

首页是推演的分流层，目标不是让用户立刻进入空白画布，而是先完成入口收敛。

主要入口：

- `开启新推演`
- `推演历史`
- `续推建议`

首页交互顺序建议为：

```text
进入首页
→ 点击开启新推演或选择历史推演
→ 进入问题收敛层
```

### 15.2 新建推演流

新建推演建议遵循以下顺序：

```text
输入推演问题
→ 上传文档/图片（可选）
→ AI 追问补充条件
→ 用户确认初始设定（内联需求卡）
→ 进入沙盘观察舱
```

这里的关键不是"提交一次就完"，而是要在进入沙盘前把问题尽量收敛。

### 15.3 推演详情页流

推演详情页采用"中间画布 + 右侧统一工作区"的结构：

- 左侧：推演历史
- 中间：沙盘观察舱，承载路径选择、节点查看、变量干预和轮次切换
- 下方：输入框、追问、重算、生成报告
- 右侧：统一工作区，承载报告（文件预览）、证据、快照、结构化结果和导出文件

页面内的核心动作建议为：

```text
查看当前路径
→ 点击节点查看解释（软选择点：inspect）
→ 选中焦点路线（硬选择点：path）
→ 必要时调整变量
→ 确认重算（硬选择点：variable，同 Run 内新 Round）
→ 更新总结与报告
```

### 15.4 画布选择流

画布中的选择点必须显式存在，分为硬选择点和软选择点（参见 §3.2）：

硬选择点（驱动状态机，每次选择 = 新 Round）：
- 入口确认（entry）：主题、主体、变量、初始假设和推演方向
- 路径选择（path）：R1 / R2 / R3 之类的焦点路线
- 变量确认（variable）：确认重算触发新 Round

软选择点（影响展示，不触发新 Round）：
- 情景切换（scenario）：主情景、风险情景、反事实情景
- 点击查看（inspect）：点击节点/路径查看解释详情
- 报告选择（report）：选择生成过程报告或综合分析报告

硬选择点的共同要求是：

1. 选择后要更新当前轮次（新 Round）
2. 选择后要留下可回看记录
3. 选择后要能驱动下一步推演（Run 从 `waiting_user` 恢复为 `running`）

### 15.5 报告阅读流

报告在右侧工作区以文件预览方式打开，建议采用"先摘要、后展开"的阅读方式：

```text
执行摘要
→ 当前局势
→ 各方动机
→ 情景研判
→ 风险与应对
→ 决策建议
→ 参考资料
```

报告底部应继续保留：

- 后续推演建议
- 发起新推演（新 Run）
- 回到沙盘

### 15.6 交互验收点

如果要验收交互流程，至少看以下事项：

**正向流：**

- 首页能不能顺利进入新推演
- 新推演前有没有完成问题收敛
- 进入沙盘后能不能选路径
- 选路径后能不能影响下一轮
- 报告能不能从推演结果自然生成并在右侧工作区打开
- 推荐续推能不能直接回到新推演入口

**异常/回退流：**

- 选错路径后能不能回退到上一轮（切换 Round 查看旧快照）
- 变量重算后能不能恢复原状态（切回旧 Round）
- 推演失败后能不能查看原因并重试
- 用户取消推演后能不能保留已有画布内容

### 15.7 交互原则

- 入口要先确认 AI 识别结果，不要直接塞进空白画布
- 画布要能选，不要只是展示
- 报告要能在右侧工作区打开，不做独立报告页
- 每次硬选择点都要留痕
- 每次留痕都要能回到状态机
- 重算不删除旧数据，新旧 Round 并存

---

## 16. 页面级交互规格

### 16.1 首页

首页承担"发现问题、选择入口、开始推演"的职责。

| 区域 | 组件 | 交互说明 |
|------|------|----------|
| 左侧导航 | 开启新推演 | 点击后聚焦到中间输入区，不直接进入空白画布 |
| 左侧导航 | 推演历史 | 查看和继续历史推演（仅展示标题+时间，详情进入画布查看） |
| 中间主区 | 通用推演入口 | 用户直接输入开放问题，系统自动识别主体、变量、假设和路径 |
| 中间主区 | 输入框 | 输入决策问题；输入为空时发送按钮禁用 |
| 中间主区 | 上传文档/图片 | 作为问题背景材料进入推演上下文 |
| 中间主区 | 续推建议 | 基于当前或历史推演结论继续发起新问题 |

### 16.2 新建推演确认

新建推演不建议直接跳入沙盘，应先进入一个轻量确认态。

**MVP 采用内联需求卡模式**（复用平台 `clarification.required` / `simulation_requirements` ChatPart），不单独做确认页。

确认态应展示（内联卡片）：

- 推演标题
- 问题摘要
- 已识别主体（可编辑）
- 已识别变量（可锁定/调整）
- 可选推演方向

用户可执行：

- 确认开始（提交需求卡）
- 修改问题（底部输入区补充）
- 补充材料（上传）
- 取消创建

> "预计消耗与耗时"暂不在 MVP 中展示，因为建模阶段无法准确预估算力。后续迭代可在 Skill prompt 模板中定义阶段数估算逻辑后加入。

### 16.3 沙盘观察舱

沙盘观察舱是推演模块的核心页面。

| 区域 | 组件 | 交互说明 |
|------|------|----------|
| 顶部状态栏 | 标题、时间、轮次、耗时、消耗 | 展示当前推演状态 |
| 路径选择区 | R1 / R2 / R3 | 选择当前焦点路线 |
| 画布区 | 节点、边、轮次 | 展示推演过程，可缩放、拖拽、点击 |
| 控制区 | 缩放、重置、全屏、轮次切换 | 控制画布视图 |
| 画布浮层 | 节点解释、变量变化、主体立场 | 展示当前选中对象的解释（软选择点：inspect） |
| 输入区 | 向 AI 提问或下达指令 | 对当前推演发起追问、重算或局部调整 |
| 右侧工作区 | 报告、证据、快照、结构化结果、导出文件 | 展示推演产物，并支持回跳到画布对象 |

### 16.4 报告内容结构

报告以 Markdown 文件存入 Workspace，在右侧工作区以文件预览方式打开。

报告内容应包含：

- 目录
- 执行摘要
- 当前局势
- 各方动机
- 情景研判
- 关键转折点
- 风险与应对
- 决策建议
- 参考资料

报告操作（右侧工作区内）：

- 复制
- 导出 Markdown
- 回到沙盘
- 基于某个结论发起新推演（新 Run）

> MVP 不做独立报告页路由，报告在右侧工作区打开。后续迭代可升级为独立阅读页。

---

## 17. 关键组件规格

### 17.1 路径选择器

路径选择器用于让用户决定当前重点观察哪条演化路线。

字段建议：

| 字段 | 说明 |
|------|------|
| `pathId` | 路径 ID，如 `R1` |
| `label` | 路径名称 |
| `probability` | 概率或置信度（0~1） |
| `status` | `available` / `locked` / `selected` / `excluded` |
| `summary` | 路径摘要 |
| `excludedReason` | 排除原因（status=excluded 时） |

交互要求：

- 当前选中路径必须高亮
- 不可选路径必须解释原因
- 切换路径后，画布和总结要同步更新

### 17.2 节点详情面板

节点详情面板用于解释用户点击的画布对象（软选择点：inspect）。

节点详情至少包含：

- 节点名称
- 节点类型
- 当前轮次状态
- 影响因素
- 相关证据
- 对结果的影响

### 17.3 变量控制器

变量控制器用于让用户调整关键假设。

变量类型建议：

| 类型 | 说明 | valueSchema 示例 |
|------|------|-----------------|
| 数值变量 | 连续数值，可设范围和单位 | `{ kind: "number", range: [0, 100], unit: "%" }` |
| 枚举变量 | 有限选项 | `{ kind: "enum", options: ["乐观", "中性", "悲观"] }` |
| 开关变量 | 布尔值 | `{ kind: "boolean" }` |
| 优先级变量 | 有序排列 | `{ kind: "priority", options: ["价格", "质量", "速度"] }` |
| 时间变量 | 日期或时间范围 | `{ kind: "datetime" }` |

交互要求：

- 用户修改变量后不立即静默重算，应先显示影响提示
- 重算前要展示"将影响哪些路径"
- 重算后要保留原版本（旧 Round），可回看对比

### 17.4 轮次切换控件

轮次切换控件用于让用户在画布中查看历史轮次。

应支持：

- 查看当前轮次（默认）
- 切换到某一历史轮次（加载对应 Round 的画布快照）
- 回到最新轮次
- 对当前路径继续追问或深挖

> MVP 不支持 Stage 级别切换。Stage 是 Agent 执行的内部阶段，用户看到的是 `run.status` label 的实时变化，不提供历史回看。

---

## 18. 画布操作能力规格

### 18.1 基础视图操作

画布必须支持基础视图控制，保证复杂推演仍然可读。

| 操作 | 说明 | MVP |
|------|------|-----|
| 缩放 | 支持放大、缩小、滚轮缩放 | 是 |
| 平移 | 支持拖动画布查看不同区域 | 是 |
| 重置视图 | 一键回到默认视角 | 是 |
| 全屏 | 进入沉浸式沙盘观察 | 是 |
| 适配画布 | 自动缩放到全部节点可见 | 是 |
| 小地图 | 展示当前视口在全图中的位置 | 否 |

### 18.2 节点操作

节点是画布的基本对象。用户必须能通过节点理解推演结构。

| 操作 | 说明 | 结果 |
|------|------|------|
| 点击节点 | 查看节点详情（软选择点：inspect） | 打开节点详情面板 |
| 双击节点 | 聚焦节点及其上下游 | 画布自动居中并高亮相关边 |
| 展开节点 | 展示子节点、证据或变量 | 生成局部展开态 |
| 折叠节点 | 收起子内容 | 保留摘要态 |
| 标记重点 | 将节点加入重点观察 | 写入当前推演记录 |
| 查看证据 | 打开支撑资料或引用 | 跳转证据面板 |

MVP 先做点击、聚焦、展开、折叠。

### 18.3 路径操作

路径是用户参与推演决策的核心入口。

| 操作 | 说明 | 结果 |
|------|------|------|
| 选择路径 | 选择 R1/R2/R3 或其他路径（硬选择点：path） | 从 `selecting` 进入 `simulating`（同 Run 内新 Round） |
| 对比路径 | 比较多条路径的概率、风险、收益 | 展示对比面板 |
| 锁定路径 | 固定某条路径作为后续主线 | 后续重算以该路径为主 |
| 排除路径 | 暂不考虑某条路径 | 记录排除原因 |
| 深挖路径 | 对某条路径发起下一轮推演 | Run 未完成：同 Run 内新 Round；Run 已 completed：新 Run |

MVP 先做选择路径、深挖路径、对比路径。

### 18.4 变量操作

变量操作用于让用户改变推演假设。

| 操作 | 说明 | 结果 |
|------|------|------|
| 锁定变量 | 指定变量不随推演自动变化 | 写入约束条件 |
| 调整变量 | 修改数值、等级、开关或枚举 | 进入影响预览 |
| 恢复默认 | 回到系统初始值 | 清除用户覆盖 |
| 查看影响 | 查看变量影响哪些路径和节点 | 展示影响范围 |
| 触发重算 | 用新变量启动下一轮（硬选择点：variable） | 同 Run 内新 Round（`clarification.required` → `run.resumed`） |

变量修改不能静默生效，必须先展示影响提示，再由用户确认重算。

### 18.5 轮次操作

推演画布要支持按轮次回看。

| 操作 | 说明 | 结果 |
|------|------|------|
| 切换 Round | 查看不同轮次的推演结果 | 画布加载对应 Round 的快照 |
| 回到最新 | 跳回最新推演结果 | 退出历史态 |

> MVP 不支持 Stage 切换。如需 Stage 级别回看，需补 `StageSnapshot` 数据结构，作为后续迭代。

### 18.6 画布输入操作

用户可以在画布上下达局部指令，但这些指令必须绑定到具体上下文。

支持输入类型（`scope` 枚举）：

| scope 值 | 说明 | 示例 |
|----------|------|------|
| `node` | 对当前节点提问 | 解释这个变量为什么会影响 R2 |
| `path` | 对当前路径追问 | R1 的前提假设在什么条件下会失效 |
| `variable` | 要求解释某个变量 | 为什么需求弹性被设为 -0.5 |
| `counterfactual` | 要求生成反事实路径 | 如果 OPEC+ 不减产，油价走势如何 |
| `resimulate` | 要求重新推演某一段 | 从某个节点 / 路径 / Round 开始用新假设重推 |

输入后必须带上上下文：

```json
{
  "scope": "node",
  "targetId": "node_001",
  "roundId": "round_2",
  "instruction": "解释这个变量为什么会影响 R2"
}
```

### 18.7 操作反馈

所有画布操作都必须给用户反馈。

| 操作结果 | 反馈方式 |
|----------|----------|
| 选中成功 | 高亮节点/路径，更新详情面板 |
| 需要确认 | 弹出影响提示或确认条 |
| 正在计算 | 显示当前阶段和进度（`run.status` label） |
| 操作失败 | 展示原因和可重试动作 |
| 影响报告 | 提示报告需要重新生成或局部更新 |

### 18.8 操作留痕

所有会影响推演结果的操作都要写入记录。

必须留痕的操作：

- 选择路径
- 锁定变量
- 调整变量
- 排除路径
- 触发重算
- 基于节点追问
- 基于路径深挖推演（同 Run 内新 Round）
- 基于路径续推（Run 已 completed 后新 Run）

留痕字段建议：

```json
{
  "actionId": "act_001",
  "type": "select_path",
  "targetId": "R1",
  "roundId": "round_1",
  "before": {},
  "after": {},
  "createdAt": "2026-06-25T10:00:00+08:00"
}
```

### 18.9 MVP 范围

第一版画布操作建议只做：

- 缩放
- 平移
- 重置
- 全屏
- 点击节点看详情（软选择点：inspect）
- 选择路径（硬选择点：path）
- 切换 Round
- 变量影响预览
- 确认后重算（硬选择点：variable）

---

## 19. 选择点数据规格

### 19.1 选择点定义

选择点是推演过程中需要用户确认方向的结构化对象。

建议结构：

```json
{
  "selectionId": "sel_001",
  "type": "path",
  "title": "选择下一轮重点推演路径",
  "description": "系统已形成三条主要路径，请选择下一轮重点观察方向。",
  "options": [
    {
      "optionId": "R1",
      "label": "最可能路径",
      "summary": "当前概率最高，适合作为主情景继续推演。",
      "impact": "进入下一轮主情景推演"
    },
    {
      "optionId": "R2",
      "label": "风险路径",
      "summary": "存在下行风险，适合观察不利情景。",
      "impact": "进入下一轮风险情景推演"
    },
    {
      "optionId": "R3",
      "label": "反事实路径",
      "summary": "假设条件反转的情景，适合压力测试。",
      "impact": "进入下一轮反事实情景推演"
    }
  ],
  "required": true,
  "defaultOptionId": "R1"
}
```

### 19.2 选择点类型

| 类型 | 说明 | 硬/软 |
|------|------|-------|
| `entry` | 入口确认，如主题、主体、变量、初始假设和推演方向 | 硬 |
| `path` | 路径选择，如 R1/R2/R3 | 硬 |
| `variable` | 变量选择，如锁定或调整变量（确认重算时为硬选择点） | 硬（确认时） |
| `scenario` | 情景切换，如主情景、风险情景、反事实情景 | 软 |
| `inspect` | 点击查看，如点击节点/路径查看解释详情 | 软 |
| `report` | 报告选择，如生成过程报告或综合分析报告 | 软 |

### 19.3 选择结果

选择结果需要写入推演记录。

建议结构：

```json
{
  "selectionId": "sel_001",
  "selectedOptionId": "R1",
  "selectedAt": "2026-06-25T10:00:00+08:00",
  "roundId": "round_1",
  "userEditable": true
}
```

`userEditable: true` 表示用户后续可以更改此选择（如从 R1 切换到 R2），更改时会在当前 Run 内创建新 Round，**不修改历史记录**。`userEditable: false` 表示此选择已锁定，不可更改。

---

## 20. 异常与边界流

### 20.1 输入不足

当用户输入不足以推演时，不进入沙盘。

系统应返回：

- 需要补充的问题
- 为什么需要补充
- 可选默认值

### 20.2 推演失败

当推演失败时，应保留当前已生成内容。

页面应展示：

- 失败原因
- 当前完成到哪一步
- 已保存的 Round 快照
- 可重试动作

### 20.3 成本过高

> 后续能力。MVP 不实现成本预估提示，因为建模阶段无法准确预估算力。后续迭代可在 Skill prompt 模板中定义阶段数估算逻辑后加入。

当推演预计消耗过高时，应在开始前提示。

提示内容：

- 预计耗时
- 预计 Token / 积分 / 算力消耗
- 可选降级模式

### 20.4 智能体 CLI 输出冲突

当节点级智能体 CLI 输出与当前推演判断冲突时，不应直接吞掉差异。

系统应展示：

- 冲突点
- 当前推演判断
- 智能体 CLI 的判断摘要
- 系统最终采用或保留分歧的理由

---

## 21. MVP 交互范围

第一版建议只做以下闭环：

1. 首页输入问题
2. AI 追问并生成初始主题、主体、变量（内联需求卡，`clarification.required`）
3. 用户确认入口设定（硬选择点：entry，同 Run 内 Round 1 开始）
4. 进入沙盘观察舱
5. 展示至少 2 条路径（建议 3 条，但不强制——Agent 可能无法始终生成 3 条）
6. 用户选择 1 条路径继续（硬选择点：path，同 Run 内 Round 2 开始）
7. 生成推演总结
8. 生成综合分析报告（右侧工作区打开）
9. 给出至少 2 条后续推演建议
10. 支持导出 Markdown
11. 用户修改变量确认重算后同 Run 内生成新 Round，旧 Round 保留可回看
12. 推演失败后展示原因并可重试

暂缓：

- 复杂自由拖拽编辑
- 多版本对比
- 公共案例广场
- 全球信号流
- 推演应用市场
- 预测准确率与回测统计
- PDF 导出
- Stage 级别快照与切换
- 独立报告页路由
- 推演进行中触发 CLI 参与
- 预计消耗与耗时展示
- 阶段级 CLI 参与（依赖 Stage 快照）
- 报告级 CLI 复核

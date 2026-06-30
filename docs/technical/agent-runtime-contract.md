# Agent Runtime Contract（Draft v0.1）

> 目标：把当前 `web -> companion -> runtime-core -> agent CLI` 的执行链路统一成一套可扩展到多租户、多个 Agent CLI 的稳定契约。

## 设计边界

- 前端只关心 `Run`、`RunEvent`、`WorkspaceHandle`、`AgentCapability`
- `companion` 是控制平面：排队、调度、恢复、审批、工作区分配
- `runtime-core` 是执行适配层：启动 CLI、解析输出、归一化事件
- 单个 CLI 的私有行为必须在 adapter 层被收敛，不能泄漏到 Web UI

## 核心对象

### Run

```ts
type RunRecord = {
  runId: string;
  tenantId: string;
  projectId: string;
  workspaceId: string;
  sessionId: string;
  turnId: string;
  agentId: string;
  agentModel: string;
  status:
    | "accepted"
    | "queued"
    | "starting"
    | "running"
    | "waiting_user"
    | "completed"
    | "failed"
    | "cancelled";
  queuePolicy: "enqueue" | "interrupt" | "steer" | "reject_if_busy";
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  parentRunId?: string;
  resumeToken?: string;
};
```

### Agent Capability

```ts
type AgentCapability = {
  agentId: string;
  label: string;
  available: boolean;
  supportsStreaming: boolean;
  supportsToolProgress: boolean;
  supportsNarration: boolean;
  supportsResumeThread: boolean;
  supportsInterrupt: boolean;
  supportsSteer: boolean;
  supportsApprovalPause: boolean;
  supportsWorkspaceMounts: boolean;
  supportsBrowser: boolean;
  supportsTerminal: boolean;
  inputStyle: "stdin" | "argv" | "jsonl";
  outputStyle: "plain" | "json" | "jsonl" | "sse-proxy";
  models?: Array<{ id: string; label: string }>;
};
```

### Workspace Handle

```ts
type WorkspaceHandle = {
  workspaceId: string;
  tenantId: string;
  projectId: string;
  rootLabel: string;
  executionRoot: string;
  readableRoots: string[];
  writableRoots: string[];
  tempRoot?: string;
  brokerMode: "sandbox" | "git_worktree" | "container_mount";
  workspaceKind: "sandbox" | "local_bound" | "cloud";
};
```

## 创建 Run

```ts
type CreateRunRequestV2 = {
  tenantId: string;
  projectId: string;
  workspaceId: string;
  sessionId: string;
  turnId: string;
  agentId: string;
  agentModel: string;
  mode: "fast" | "deep";
  queuePolicy: "enqueue" | "interrupt" | "steer" | "reject_if_busy";
  userMessage: {
    text: string;
    mentions?: Array<{ kind: "file" | "artifact"; id: string; path?: string }>;
    attachments?: Array<{ fileId: string; name: string; mimeType: string }>;
  };
  context?: {
    visibleMessages?: Array<{ role: "user" | "assistant"; content: string }>;
    processSkill?: string;
    platformNormSkill?: string;
    workspaceHints?: {
      cwd?: string;
      openFiles?: string[];
      selectedPaths?: string[];
    };
  };
};
```

## 队列语义

- `enqueue`：当前 run 继续执行，新输入进入会话队列
- `interrupt`：当前 run 收到取消信号，新输入成为下一轮正式执行
- `steer`：向当前 run 注入补充指令；若 Agent 不支持真 steer，则由 `companion` 自动降级为 `interrupt + enqueue`
- `reject_if_busy`：当前会话有活跃 run 时拒绝新输入

## RunEvent

```ts
type RunEvent =
  | { type: "run.accepted"; runId: string; message?: string }
  | { type: "run.queued"; runId: string; position: number; reason?: string }
  | { type: "run.started"; runId: string; cwd: string; agentId: string; capabilities?: string[] }
  | { type: "run.status"; runId: string; phase: string; label: string }
  | { type: "message.delta"; runId: string; turnId: string; text: string }
  | { type: "message.interim"; runId: string; turnId: string; text: string; alreadyStreamed?: boolean }
  | { type: "tool.progress"; runId: string; toolCallId?: string; tool: string; status: "running" | "done" | "failed"; message?: string }
  | { type: "artifact.append"; runId: string; artifact: Artifact }
  | { type: "artifact.patch"; runId: string; artifactId: string; merge: Record<string, unknown> }
  | { type: "todo.update"; runId: string; items: RuntimeTodoItem[] }
  | { type: "approval.required"; runId: string; approvalId: string; action: string; risk?: string }
  | { type: "clarification.required"; runId: string; clarificationId: string; question: string; options?: string[] }
  | { type: "run.waiting_user"; runId: string; waitingFor: "approval" | "clarification" | "auth" | "file_pick" }
  | { type: "run.resumed"; runId: string }
  | { type: "run.finished"; runId: string; summary?: string }
  | { type: "run.error"; runId: string; code: string; message: string }
  | { type: "run.cancelled"; runId: string };
```

## Artifact 统一模型

```ts
type Artifact =
  | { kind: "text_block"; id: string; markdown: string }
  | { kind: "tool_batch"; id: string; summary: string; entries?: Array<{ tool: string; status?: "running" | "done" | "failed"; message?: string }> }
  | { kind: "file_read"; id: string; path: string }
  | { kind: "file_edit"; id: string; path: string; diff?: string }
  | { kind: "command"; id: string; command: string; exitCode?: number | null }
  | { kind: "deliverable"; id: string; title: string; fileId?: string; path?: string }
  | { kind: "todo"; id: string; items: RuntimeTodoItem[] }
  | { kind: "citation"; id: string; source: string; target?: string }
  | { kind: "approval_card"; id: string; approvalId: string; action: string }
  | { kind: "browser_snapshot"; id: string; url: string; title?: string };
```

## 实施约束

- `web` 侧不得再分支判断“这是 codex/claude/hermes 的专属事件”
- `runtime-core` 允许保留各 CLI 的解析器，但输出必须映射到统一 `RunEvent`
- `companion` 负责 run 队列与等待用户态；前端只读状态，不持有权威队列
- 工作区真实路径必须由 broker 分配，前端与 Agent 都不直接信任 UI 传来的路径

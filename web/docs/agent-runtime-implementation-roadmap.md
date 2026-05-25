# Agent Runtime 落地路线图（v0.1）

> 目标：基于当前仓库，把 `hermes-webui` 值得借鉴的交互能力，落到 `web + companion + runtime-core` 的多 Agent CLI 平台化骨架上。

## Iteration 1：统一 RunEvent 与 RunRecord

### 目标

- 把当前 Hermes/Companion/未来 CLI 的事件流统一成 `RunEvent`
- 让 `web` 不再感知某个具体 CLI 的私有输出格式

### 触达文件

- `packages/contracts/src/runtime.ts`
- `packages/runtime-core/src/types.ts`
- `web/src/lib/chat-stream.ts`
- `web/src/lib/chat-run-started.ts`
- `web/src/components/chat/useChatSend.ts`
- `companion/src/runs/manager.ts`

### 验收

- `web` 只消费统一事件，不再按 `agentId` 分支 UI 逻辑
- `companion` 发出的事件名与字段有单一基线

## Iteration 2：服务端队列与控制面

### 目标

- 在 `companion` 引入 `enqueue / interrupt / steer / reject_if_busy`
- 前端只表达意图，不维护权威队列

### 新增建议

- `companion/src/runs/queue.ts`
- `companion/src/runs/control.ts`
- `companion/src/runs/store.ts`

### Web 侧改动

- `web/src/components/chat/ChatComposer.tsx`
- `web/src/components/chat/useChatRunController.ts`
- `web/src/components/chat/ChatSessionStatusIndicator.tsx`

### 验收

- 同一 session 可以显式排队、打断、转向
- 当前 run 忙时的用户输入行为稳定可预测

## Iteration 3：等待用户态协议

### 目标

- 把粗粒度 `waiting_user` 细化为业务可执行卡片

### 新增建议

- `web/src/components/chat/parts/ApprovalCard.tsx`
- `web/src/components/chat/parts/ClarificationCard.tsx`
- `companion/src/routes/runs-control.ts`

### 验收

- 支持审批、补充说明、认证、文件选择等等待态
- 前端卡片可以驱动 run 恢复

## Iteration 4：Run 恢复与事件回放

### 目标

- 支持刷新、断线、切设备后的 active run 恢复

### 新增建议

- `companion/src/runs/events-store.ts`
- `companion/src/sessions/run-context.ts`
- `web/src/lib/chat-session-sync.ts`

### 验收

- `GET /v1/runs/{id}/events` 可回放
- 前端刷新后可重新挂接活跃 run

## Iteration 5：Workspace Broker

### 目标

- 把 `workspaceId` 和真实执行目录隔离
- 支持未来扩展到 sandbox/worktree/container

### 新增建议

- `companion/src/workspace/broker.ts`
- `companion/src/workspace/types.ts`
- `companion/src/routes/workspaces.ts`

### 验收

- `web` 不再依赖真实路径作为执行入口
- run 创建时只传 `workspaceId`

## Iteration 6：Agent Capability Registry

### 目标

- 从固定三款 CLI 走向任意 adapter 可扩展

### 新增建议

- `packages/runtime-core/src/agents/capabilities.ts`
- `packages/runtime-core/src/agents/register.ts`

### 验收

- 每个 agent 独立声明能力
- `companion` 可下发 `GET /v1/agents/capabilities`

## Iteration 7：Artifact 总线与审计面

### 目标

- 统一交付物、文件改动、命令摘要、todo、browser snapshot
- 为多租户审计与回放铺底座

### 触达文件

- `web/src/lib/chat-parts.ts`
- `web/src/lib/canonical-output.ts`
- `companion/src/audit/store.ts`

### 验收

- 单轮执行可回放
- 具备租户级可审计事件记录

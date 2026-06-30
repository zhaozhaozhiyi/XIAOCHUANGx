# Web 对话 BFF（原型临时通道）

> **产品目标（见 PRD §12.5.6）：** 模式 B 下对话应由 **本地 Companion** 按用户选择的 `agentId`（`codex` / `claude` / `hermes`）**spawn 对应本机 CLI**，三款为平行选项。  
> **本文档描述的是开发期捷径：** 当前 `web` 将**所有** Agent 的对话统一代理到 Hermes Gateway 或 Mock，便于先联调 UI/SSE；**不代表**量产架构。Hermes 只是三款 CLI 之一，不是全局网关。

## 当前原型架构

```
浏览器 → POST /api/chat (SSE) → Hermes Gateway :8642/v1/chat/completions
                              或 HERMES_USE_MOCK
```

量产目标：

```
浏览器 → Companion (localhost) → spawn(codex|claude|hermes) → projectId 工作区
```

- **UI**：`web/src/components/chat/*`
- **BFF**：`web/src/app/api/chat/route.ts`
- **底座**：`hermes gateway`（需开启 API Server）

## 启动 Hermes 底座

在 `~/.hermes/.env` 中：

```bash
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
```

启动：

```bash
hermes gateway
```

应看到：`API server listening on http://127.0.0.1:8642`

## 配置 Web

```bash
cd web
cp .env.local.example .env.local
# 编辑 HERMES_API_KEY 与 ~/.hermes/.env 中一致
npm run dev
```

仅调试 UI、未启动 Hermes 时，可在 `.env.local` 设置：

```bash
HERMES_USE_MOCK=true
```

## 健康检查

- `GET /api/hermes/health` — 检测 BFF 到 Hermes 的连通性
- 对话顶栏模型选择器左侧圆点：绿 = 已连接，红 = 未连接，灰 = 检测中（悬停查看详情）

## 会话与 Agent

每个 `/chat/[id]` 的 `id` 会作为 `X-Hermes-Session-Id` 的一部分（前缀 `HERMES_SESSION_PREFIX`），在 Hermes 侧保持多轮上下文。

顶栏选择的 **Agent**（`codex` / `claude` / `hermes`）与 **模型档位** 会随 `POST /api/chat` 一并提交：

- `agentId`、`agentModel` — 必填；不可用时返回 422
- `X-Hermes-Session-Key` — `{prefix}:{sessionId}:{agentId}`，按 Agent 隔离记忆
- `system` 消息 — 注入当前 Agent 说明
- `model` — 非 `default` 时使用用户所选档位

Mock 模式（`HERMES_USE_MOCK=true`）下回复会带 Agent 名称前缀，便于联调。

## 对话模式

| 模式 | 行为 |
|------|------|
| 快速 | 简洁回答的系统提示 |
| 深度 | 分步推理或完整研究（由助手按问题复杂度决策） |

模式通过 `system` 消息注入，后续可映射到 Hermes profile 或 `/model` 命令。

## 后续扩展

- 工具进度：已解析 SSE `hermes.tool.progress` 事件
- 审批 / 澄清：可改用 `POST /v1/runs` + `/v1/runs/{id}/events`
- 历史会话列表：对接 Hermes `session.list` 或自建存储

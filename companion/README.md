# @jlcresearch/companion

小窗 — **本机 Companion**（模式 B）。

按用户选择的 `agentId`（`codex` / `claude` / `hermes`）在 `projectId` 工作区根目录执行 Agent 任务，经 SSE 回传前端。**当前产品定义中，Companion 主要服务于 Desktop 的本地文件夹工作区路径**；浏览器直连仅用于当前实现、联调与降级入口。契约见 [companion-api.md](../docs/technical/companion-api.md)、PRD §8.5。

## 快速开始

```bash
# 在仓库根目录
pnpm install

# 启动 Companion（默认 http://127.0.0.1:9477，COMPANION_RUN_MODE=cli）
pnpm --filter @jlcresearch/companion dev
```

另开终端，配置 Web：

```bash
# web/.env.local
CHAT_EXECUTION=companion
COMPANION_USE_MOCK=false
COMPANION_BASE_URL=http://127.0.0.1:9477

pnpm --filter web dev
```

浏览器打开对话页，顶栏状态点应为 **Companion 已连接**；发送消息后 SSE 事件来自本进程。

无本机 CLI 时（仅 UI 演示）：

```bash
COMPANION_RUN_MODE=simulate pnpm --filter @jlcresearch/companion dev
# 或 CLI 失败回退模拟：COMPANION_CLI_FALLBACK=simulate
```

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `COMPANION_HOST` | `127.0.0.1` | 监听地址（仅 loopback） |
| `COMPANION_PORT` | `9477` | 端口 |
| `COMPANION_DATA_DIR` | `~/.jlcresearch/companion` | Companion 元数据目录（如 `projects.json`、内部迁移用数据） |
| `COMPANION_API_TOKEN` | （空） | 设置后要求 `Authorization: Bearer` |
| `COMPANION_RUN_MODE` | `cli` | `simulate` \| `spawn` \| `cli` |
| `COMPANION_CLI_FALLBACK` | `error` | `error` = 失败仅 `run.error`；`simulate` = 回退模拟正文 |
| `COMPANION_DEFAULT_AGENT` | `codex` | `/v1/agents` 默认推荐 |
| `COMPANION_LOG_LEVEL` | `info` | Fastify 日志级别 |

## 已实现端点（`0.1.0-alpha` 骨架）

| 方法 | 路径 |
|------|------|
| GET | `/v1/health` |
| GET / POST | `/v1/agents`、`/v1/agents/detect` |
| GET / POST | `/v1/projects`（POST 仅内部 / 迁移用途，非当前 Desktop 主路径） |
| POST | `/v1/projects/import-folder`（`local_bound` 绑定，F-RT-007c） |
| POST | `/v1/projects/ensure`（演示/MOCK 对齐） |
| GET | `/v1/projects/:id/tree` |
| GET | `/v1/projects/:id/files?path=` |
| POST | `/v1/runs`（SSE） |
| POST | `/v1/runs/:runId/cancel` |

## 运行模式

- **simulate**：探测 CLI 是否安装；流式输出为服务端模拟（按 `agentId` 区分文案），用于无 CLI 的 UI 联调。
- **spawn**：在 `cwd` 下执行 `{agent} --version` 探测后，仍用 simulate 输出正文。
- **cli（默认）**：通过 [`@jlc/runtime-core`](../packages/runtime-core/) spawn 平台已适配 CLI，解析 stdout 流；默认 `COMPANION_CLI_FALLBACK=error` 不回退模拟。

## 目录结构

```
companion/src/
  agents/detect.ts    # 探测平台登记 CLI 适配集
  projects/           # local_bound 为主，附带内部/迁移元数据
  runs/               # SSE 执行与取消
  routes/             # Fastify 路由
  server.ts
  index.ts
```

## 下一步

1. PTY 终端转发（F-RT-006）
2. 配对鉴权（`/v1/pair/*`）、桌面 HMAC（`/v1/desktop/register`），归入 Desktop Beta 验收
3. Hermes ACP 长会话（当前 `cli` 模式为 `hermes chat -q` 单次问答）

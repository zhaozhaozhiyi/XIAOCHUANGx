# 小窗（原型 Monorepo）

| 包 | 说明 |
|----|------|
| [`web/`](./web/) | Next.js 前端 + BFF |
| [`api/`](./api/) | NestJS 业务 API（账号、项目、对话会话元数据） |
| [`packages/contracts/`](./packages/contracts/) | 共享 DTO / Zod 契约 |
| [`companion/`](./companion/) | 本机 Companion（模式 B） |
| [`apps/desktop/`](./apps/desktop/) | Electron 桌面壳（`pnpm desktop:dev`） |

文档：[PRD v3.6.7](./PRD-小窗.md)（**MVP = 对话 + 桌面壳 + 多 CLI / 多模型/API 接入核心能力**；实现快照 §12.5.9）· [工作区架构](./web/docs/workspace-architecture.md) · [设计文档审计建议](./docs/design-doc-audit-recommendations.md) · [技术方案](./技术方案.md) · [功能清单](./功能清单.md) · [会议纪要模块 PRD](./web/docs/meeting-module-prd.md) · [写作模块 PRD](./web/docs/writing-module-prd.md) · [PPT 模块 PRD](./web/docs/ppt-module-prd.md) · [MVP 收口清单](./web/docs/mvp-closure-checklist.md) · [执行路线图](./web/docs/chat-execution-roadmap.md) · [桌面壳](./web/docs/desktop-shell.md) · [Companion API](./web/docs/companion-api.md) · [业务 API](./api/README.md)

## 本地开发

## 运行前置条件（必须）

- **必须先启动 Companion**：未启动时，项目树读取、文件导入、Agent 执行链路将不可用。
- 启动命令（建议单独终端常驻）：

```bash
pnpm companion:dev
# → http://127.0.0.1:9477
```

- 建议启动后先做健康检查：

```bash
curl -s http://127.0.0.1:9477/v1/health
```

返回 `{"ok":true,...}` 后，再继续启动 API / Web / Desktop。

**推荐主启动方式**：直接在仓库根目录运行：

```bash
pnpm dev
```

它会自动启动 API、Companion、Web，并在 Web / Companion 就绪后拉起桌面壳。

如需分开调试，MVP 联调仍可按四个进程分别启动：API、Companion、Web；桌面壳为推荐交付形态。

```bash
# 1. 依赖服务
docker compose up -d

# 2. 安装
pnpm install
pnpm contracts:build && pnpm runtime-core:build

# 3. 数据库（首次）
cp api/.env.example api/.env
pnpm db:push

# 4. 启动 API（终端 A）
pnpm dev:api
# → http://localhost:3001/v1  Swagger: http://localhost:3001/docs

# 5. 启动 Companion（终端 B，必需 — Agent 执行、项目树、文件夹导入）
pnpm companion:dev
# → http://127.0.0.1:9477

# 6. 启动 Web（终端 C）
pnpm dev:web
# → http://localhost:3000

# 7. 桌面壳（终端 D，MVP 推荐）
pnpm desktop:dev
```

Web 默认 `CHAT_EXECUTION=companion`、`COMPANION_BASE_URL=http://127.0.0.1:9477`；无本机 CLI 时可 `COMPANION_RUN_MODE=simulate pnpm companion:dev` 做 UI 演示。详见 [companion/README.md](./companion/README.md)。

开发登录：`.env` 中 `AUTH_DEV_MODE=true` 时验证码为 **123456**。

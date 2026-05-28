# 小窗业务 API（NestJS）

云端业务服务：账号登录、研究项目元数据、对话会话元数据。执行面（Companion / Runtime）为独立服务，见 [技术方案.md](../技术方案.md)。

**MVP 数据分工：** 消息正文与 Agent 执行在 **Companion**；本服务管账号与会话**索引**。纪要/文稿等业务任务（V1.1）：**索引在本服务，正文权威在 `projectId` 工作区**（§6.0.4）。详见 PRD [§8.6](../PRD-小窗.md#86-会话项目与消息的数据分工mvp)、[§6.0.4](../PRD-小窗.md#604-业务历史与正文权威源已决v367--d-31)。

## 技术栈

| 项 | 选型 |
|----|------|
| 框架 | NestJS 11 |
| ORM | Prisma + PostgreSQL |
| 缓存 | Redis（验证码、限流） |
| 契约 | `@jlc/contracts`（workspace 包） |
| 文档 | Swagger `/docs` |

## 快速开始

### 1. 依赖服务

```bash
# 仓库根目录
docker compose up -d
```

### 2. 安装与配置

```bash
cd ..   # 仓库根目录
pnpm install
cp api/.env.example api/.env
pnpm db:generate
pnpm db:push
```

### 3. 启动

```bash
pnpm dev:api
```

- API：`http://localhost:3001/v1`
- Swagger：`http://localhost:3001/docs`
- 健康检查：`GET /v1/health`

### 开发模式登录

`.env` 中 `AUTH_DEV_MODE=true` 时，验证码固定为 **123456**（与 `web/` 原型一致）。

## API 一览（MVP）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/v1/auth/send-code` | 发送验证码 |
| `POST` | `/v1/auth/login` | 登录即注册，返回 `sessionToken` |
| `POST` | `/v1/auth/logout` | 退出（需 Bearer 或 Cookie） |
| `GET` | `/v1/auth/me` | 当前用户 |
| `POST` | `/v1/projects` | 创建研究项目 |
| `GET` | `/v1/projects` | 项目列表 |
| `GET` | `/v1/projects/:id` | 项目详情 |
| `POST` | `/v1/chat-sessions` | 创建对话会话（绑定 projectId） |
| `GET` | `/v1/chat-sessions` | 会话列表 |
| `GET` | `/v1/chat-sessions/:id` | 会话详情 |
| `POST` | `/v1/chat-sessions/:id/branch` | 分支新会话（继承 `projectId`） |
| `GET` | `/v1/health` | 依赖连通性 |

鉴权：请求头 `Authorization: Bearer <sessionToken>`，或 Cookie `jlc_session=<sessionToken>`（供 Next.js BFF 转发）。

## 与 Web BFF 对接

Next.js `web/src/app/api/auth/*` 后续改为代理至本服务，例如：

```text
POST /api/auth/login  →  POST http://localhost:3001/v1/auth/login
                         →  Set-Cookie jlc_session=<sessionToken>
```

环境变量建议（`web/.env.local`）：

```bash
JLC_API_BASE_URL=http://localhost:3001/v1
```

## 目录结构

```text
api/
├── prisma/schema.prisma   # 数据模型
├── src/
│   ├── auth/              # 登录、会话 JWT
│   ├── projects/          # 研究项目
│   ├── sessions/          # 对话会话（chat-sessions）
│   ├── health/
│   ├── prisma/
│   └── redis/
└── .env.example
```

## 后续模块（未实现）

- 知识库索引、会议纪要元数据
- BullMQ 异步任务（`src/jobs/` 已占位）
- 短信网关真实接入：实现 `src/integrations/sms/sms.provider.ts` 中的 `SmsProvider`（**需确认阿里云/腾讯云**）

## 待你确认的第三方组件

| 组件 | 用途 | 建议 | 状态 |
|------|------|------|------|
| 短信 | 登录验证码 | 阿里云短信 / 腾讯云短信 二选一 | 未接入，开发模式日志 |
| 对象存储 | 模式 A 工作区、上传 | OSS / COS / MinIO | 未接入 |
| BullMQ | 异步转写、索引 | `bullmq` + `@nestjs/bullmq` | 仅占位模块 |

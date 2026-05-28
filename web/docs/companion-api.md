# 本地 Companion HTTP API 契约（v1.1）

> **定位：** 模式 B 下 Web/桌面壳与**本机 Companion** 的唯一执行接口。Companion 按 `agentId` **spawn** 对应 CLI（`codex` / `claude` / `hermes`），在 `projectId` 工作区根目录执行，经 **SSE** 回传进度与文本。  
> **对齐：** PRD **v3.6.7** §8.5、§5.3.2.1a/b、§5.3.2.2；[folder-import-and-desktop-shell.md](./folder-import-and-desktop-shell.md)；TypeScript 类型见 `web/src/lib/companion/types.ts`。

## 基址与安全

| 项 | 约定 |
|----|------|
| 默认地址 | `http://127.0.0.1:9477`（环境变量 `COMPANION_BASE_URL`） |
| 监听 | 仅 loopback；禁止 `0.0.0.0` 公网暴露 |
| 鉴权 | `Authorization: Bearer <COMPANION_API_TOKEN>`（配对后下发，PRD OQ-13） |
| API 版本 | 路径前缀 `/v1`；响应头可选 `X-JLC-Api-Version: v1` |

## Web BFF 接入（当前原型）

| 环境变量 | 说明 |
|----------|------|
| `CHAT_EXECUTION=companion` | `POST /api/chat` 走 Companion 契约（否则走 Hermes Gateway 捷径） |
| `COMPANION_BASE_URL` | Companion 基址 |
| `COMPANION_USE_MOCK=true` | 无 daemon 时由 BFF 模拟 SSE（仍按所选 `agentId` 标注） |
| `COMPANION_API_TOKEN` | 可选 Bearer |

健康检查（统一）：`GET /api/runtime/health`（根据 `CHAT_EXECUTION` 探测 Companion 或 Hermes）。

---

## 1. 健康与探测

### `GET /v1/health`

**响应 200：**

```json
{
  "ok": true,
  "version": "0.1.0",
  "apiVersion": "v1",
  "companionId": "host-macbook-01",
  "dataDir": "/Users/me/.jlcresearch/companion"
}
```

### `GET /v1/agents`

返回三款预置 CLI 探测结果（与设置页卡片一致）。

```json
{
  "inferenceChannel": "cli",
  "defaultAgentId": "codex",
  "agents": [
    {
      "agentId": "codex",
      "bin": "codex",
      "status": "available",
      "version": "0.7.0"
    },
    {
      "agentId": "claude",
      "bin": "claude",
      "status": "needs_login",
      "version": null,
      "hint": "请在终端执行 claude 完成登录"
    }
  ]
}
```

| `status` | 含义 |
|----------|------|
| `available` | 可 spawn |
| `not_installed` | 未检测到可执行文件 |
| `needs_login` | 已安装需授权 |
| `outdated` | 版本低于企业矩阵 |

### `POST /v1/agents/detect`

重新探测；响应同 `GET /v1/agents`。

**V1.1 扩展字段（对齐 Open Design `AgentInfo`）：**

| 字段 | 说明 |
|------|------|
| `path` | 探测到的可执行路径（设置页 tooltip） |
| `models` | `{ id, label }[]` 模型档位列表 |
| `modelsSource` | `live`（来自 CLI）或 `fallback`（静态兜底） |

### `POST /v1/agents/test`

Body：`{ "agentId": "codex" \| "claude" \| "hermes" }`  
轻量连通性测试（复用单 Agent 探测，不发起完整 Run）。

```json
{ "ok": true, "agentId": "codex", "message": "已就绪（0.7.0）" }
```

**Web BFF（V1.1）：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/agents` | 代理 `GET /v1/agents` + Companion 健康 |
| `POST` | `/api/agents` | 代理 `POST /v1/agents/detect` |
| `POST` | `/api/agents/test` | 代理 `POST /v1/agents/test` |

---

## 2. 研究项目（工作区）

### `GET /v1/projects`

列出本机可见项目（用户 `local_bound` + 平台默认 XIAOCHUANG 任务目录；内部 `sandbox` 仅迁移用）。

### `POST /v1/projects`

**仅创建内部沙箱**（迁移/演示；**非**「不绑定课题文件夹」用户路径）：

```json
{ "workspaceKind": "sandbox", "name": "临时工作区" }
```

**本地目录绑定请使用** `POST /v1/projects/import-folder`（§2.1），勿在 Web 渲染进程直接 POST 未校验的 `baseDir`（PRD §5.3.2.2）。

### `POST /v1/projects/import-folder`（MVP，F-RT-007c）

将用户目录登记为 `local_bound`：**绑定不复制**，Agent `cwd` = `realpath(baseDir)`。

**请求：**

```json
{
  "name": "蒙电十五五",
  "baseDir": "~/Projects/蒙电十五五"
}
```

| 字段 | 说明 |
|------|------|
| `baseDir` | 用户手填（Web）或桌面主进程选目录后的绝对路径 |
| `name` | 可选；默认取目录名 |

**响应 200：**

```json
{
  "projectId": "proj-abc123",
  "name": "蒙电十五五",
  "workspaceKind": "local_bound",
  "pathSummary": "~/Projects/蒙电十五五"
}
```

**Companion 校验：** `realpath`；目录须存在；默认限制在用户 `$HOME` 下；禁止 `dataDir` 内路径（PRD §7.6）。

**桌面受信导入（V1.1+）：** 请求头 `X-JLC-Desktop-Import-Token`（HMAC）；成功项标记 `metadata.fromTrustedPicker: true`。

**幂等（import-folder，实现二选一，须在 release notes 写明）：** 同 `realpath(baseDir)` 返回已有 `projectId`，或每次新建 `projectId`。

**Web BFF：** `POST /api/projects/import-folder` → 转发本接口。

### `POST /v1/projects/ensure-default-task-project`（V1.1，§5.3.2.1a）

UI「不绑定课题文件夹」且模块产出工作区 Artifact 时，按 **模块 + 任务** 自动建 XIAOCHUANG 目录并登记 `local_bound`（`bindingSource=platform_default`）。Web **不得**传入任意 `baseDir`。

**请求：**

```json
{
  "moduleId": "chat",
  "taskTitle": "原油周报",
  "taskId": "sess-optional-correlation"
}
```

| 字段 | 说明 |
|------|------|
| `moduleId` | 模块注册表 ID（`chat` / `meeting` / `writing` / `ppt` / `translate` 等） |
| `taskTitle` | 可选；sanitize 后作 `{标题简写}`；缺省用模块默认名 |
| `taskId` | 可选；与会话/任务 ID 关联，便于幂等 |

**响应 201：**

```json
{
  "projectId": "proj-x7k2m9",
  "name": "原油周报",
  "workspaceKind": "local_bound",
  "bindingSource": "platform_default",
  "pathSummary": "~/Documents/XIAOCHUANG/会话/2026-05-27/原油周报",
  "baseDir": "/Users/me/Documents/XIAOCHUANG/会话/2026-05-27/原油周报"
}
```

**Companion 行为：** `mkdir -p` 叶子目录；`moduleSegment` 读 `module-registry.workspaceSegment`；同 `{YYYY-MM-DD}/{标题简写}` 冲突递增 `_2`（§5.3.2.1b）。**禁止**回退 `sandbox-default`。

**Web BFF：** `POST /api/projects/ensure-default-task-project` → 转发本接口（已实现；`web/src/app/api/projects/ensure-default-task-project/route.ts`）。

**幂等：** 同一 `taskId`（或业务约定的 dedupe 键）返回已有 `projectId`。

### `POST /v1/projects/ensure`（原型 / 演示）

固定 `projectId` 登记，用于 MOCK 列表与 Companion 对齐；**不能**替代受信选目录。

```json
{
  "projectId": "proj-mengdian",
  "workspaceKind": "local_bound",
  "name": "蒙电十五五",
  "baseDir": "/Users/me/Projects/蒙电十五五"
}
```

BFF 在拉树 / 发对话前可调用；UI「添加新项目」主流程应走 `import-folder`。

### `GET /v1/projects/{projectId}/tree`

文件树 JSON（供 Web 侧栏；深度与忽略规则实现阶段定义）。

### `GET /v1/projects/{projectId}/files`

查询参数 `path`（相对项目根）。返回内容与 MIME，供预览/下载。

---

## 2.5 会话消息持久化（S3.4）

### `GET /v1/sessions/{sessionId}/messages`

返回该 UI 会话的完整消息数组（含 `parts[]`）。无记录时 `messages: []`。

### `PUT /v1/sessions/{sessionId}/messages`

**请求体：**

```json
{
  "projectId": "proj-mengdian",
  "messages": [
    { "id": "user-1", "role": "user", "content": "…" },
    {
      "id": "assistant-1",
      "role": "assistant",
      "content": "…",
      "status": "complete",
      "parts": []
    }
  ]
}
```

存储路径：`{COMPANION_DATA_DIR}/sessions/{sessionId}.json`。Web BFF：`GET/PUT /api/sessions/{id}/messages`（Companion 不可用时回退浏览器 localStorage）。

Web 发对话时 **`useClientHistory: true`**（始终携带已持久化历史）；Hermes Gateway 会话键与 Web BFF 统一为 `jlcresearch:{sessionId}:{agentId}`（`HERMES_SESSION_PREFIX` 可覆盖）。

---

## 3. Agent 运行（核心）

### `POST /v1/runs`

**请求头：** `Content-Type: application/json`，`Accept: text/event-stream`

**请求体（`CreateRunRequest`）：**

```json
{
  "sessionId": "1747824000123",
  "projectId": "none",
  "workspaceProjectId": "proj-x7k2m9",
  "moduleId": "chat",
  "binding": { "moduleId": "chat", "mode": "fast" },
  "agentId": "codex",
  "agentModel": "default",
  "messages": [{ "role": "user", "content": "上周螺纹钢库存" }],
  "useClientHistory": false,
  "processSkill": "skill-qa-fast",
  "platformNormSkill": "skill-platform-research-norms"
}
```

| 字段 | 说明 |
|------|------|
| `projectId` | UI 绑定（含 `none`） |
| `workspaceProjectId` | 解析后的工作区 ID（`none` → 沙箱 ID） |
| `agentId` | **决定 spawn 哪一款 CLI**，必填 |
| `binding` | 模块注册表键；对话为 `{ moduleId, mode }` |
| `processSkill` / `platformNormSkill` | spawn 前从 `skills/<slug>/SKILL.md` 加载并注入 prompt（见 PRD F-RT-003、`skills/README.md`） |
| `orchestrationMode` | 对话编排模式；`moduleId=chat` 时为 `"hybrid-steer"`（F-RT-008） |
| `catalogVersion` / `catalogSlugs` | 本轮可见 Skill Catalog（摘要已进 system；全文 Agent 按需 Pull） |

**SSE 事件（补充）：**

| 事件 | 说明 |
|------|------|
| `run.accepted` | 连接建立后立刻发送，含 `message`（加载 Skill/Kit 等），用于首包可感知 |
| `run.started` | Run 元数据（runId、skills、orchestration） |
| `message.delta` | 正文增量 |
| `tool.progress` | 工具/阶段进度 |
| `run.finished` / `run.error` / `run.cancelled` | 结束态 |
| `part.append` (`kind: deliverables`) | CLI 成功后扫描工作区新增/修改文件（`.md`/`.pptx`/图等），或 simulate 深度研究 mock |

**Companion 行为：**

1. 校验 `agentId` 在探测结果中为 `available`（否则 422 `agent_unavailable`）
2. `cwd` = 解析 `workspaceProjectId` 的根路径
3. `spawn(bin(agentId), …)`，禁止未登记扩展 CLI
4. **多轮对话（对齐 Open Design）**：每轮 `codex` / `claude` / `hermes` 均 **冷启动 spawn**，将 **Instructions + transcript** 合并后经 **stdin** 投递（单条 prior 消息最多 12k 字符截断）；**不使用** `codex exec resume`。
5. **超长会话自动压缩**：历史 ≥ 约 120k 字符或 ≥ 24 条消息时，较早轮次压成「自动压缩摘要」+ 保留最近 8 条原文后继续 Run；界面侧完整历史不变。仅压缩后仍超约 1.2MB 才 `prompt_too_large`。
5. 将 stdout/结构化流转换为下方 SSE

**响应：** `200` + `text/event-stream`；可选响应头 `X-JLC-Run-Id`

**错误：** `422` agent 不可用；`403` 路径越权；`502` CLI 异常退出

### `POST /v1/runs/{runId}/cancel`

取消运行；已生成内容保留，发送 `run.cancelled`。

---

## 4. SSE 事件

| `event` | `data` 示例 | UI |
|---------|-------------|-----|
| `run.started` | `{ "runId", "agentId", "cwd", "processSkill", "platformNormSkill", "orchestrationMode", "catalogVersion", "catalogSlugs", "skillsRoot", "promptsRoot", "injectedSkills", "missingSkills", "agentKitPath" }` | 可选阶段条；`agentKitPath` 仅 CLI 模式；对话见 F-RT-008 |
| `message.delta` | `{ "content": "片段" }` | 聊天流式正文 |
| `tool.progress` | `{ "tool": "read_file", "status": "running" }` | Activity 区工具行（见 [chat-message-parts.md](./chat-message-parts.md)） |
| `run.finished` | `{ "runId" }` | 结束态 |
| `run.error` | `{ "code", "message" }` | 错误气泡 |
| `run.cancelled` | `{ "runId" }` | 已中断 |

**V1.1 扩展（可选）：** `part.append` / `part.patch` 直接推送 `ChatPart` 块，类型见 `@jlc/contracts` `chat.ts` 与 [chat-message-parts.md](./chat-message-parts.md) §5.3。

Web BFF 转发时设置响应头 `X-JLC-Execution: companion`，前端 `consumeChatSse(..., { format: "companion" })` 解析，经 `chat-parts-reducer` 写入消息的 `parts[]`。

---

## 5. 桌面壳注册（V1.1+）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/v1/desktop/register` | 桌面壳启动时注册，返回 HMAC `secret`（loopback only） |

详见 [desktop-shell.md](./desktop-shell.md)、[folder-import-and-desktop-shell.md](./folder-import-and-desktop-shell.md) §4.3。

---

## 6. 配对（V1.1，OQ-13）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/v1/pair/request` | 浏览器展示一次性码 |
| `POST` | `/v1/pair/confirm` | Companion 确认后签发 `COMPANION_API_TOKEN` |

MVP 原型可省略配对，仅 loopback + 空 token。

---

## 7. 实现分期

| 阶段 | Companion 仓库 | Web / 桌面 |
|------|----------------|------------|
| **骨架** | [`companion/`](../../companion/README.md) Fastify；`simulate` / `spawn` 探测 | `CHAT_EXECUTION=companion` + BFF 转发 |
| **原型（当前）** | `cli` + `composeRunPrompts` + `sessions` 持久化 + F-RT-009-A 压缩 | 默认 `CHAT_EXECUTION=companion`；`ProjectWorkPicker` 手填路径 + 桌面 IPC |
| **MVP** | `import-folder` 联调；`pnpm smoke:companion` | 见 [mvp-closure-checklist.md](./mvp-closure-checklist.md)、PRD §12.5.9 |
| **MVP** | Electron `pickAndImportFolder`（主进程 → `import-folder`） | 见 [desktop-shell.md](./desktop-shell.md) |
| **V1.1** | 桌面 HMAC、`/v1/desktop/register`；PTY、配对 | 防伪造 `baseDir` |

参考技术栈：[技术方案.md](../技术方案.md) §4.3；实现可参考 Open Design `apps/daemon` 模块划分。

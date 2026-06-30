# `0.1.0-alpha` / Desktop Alpha 收口验收清单

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.2 |
| 日期 | 2026-06-26 |
| 范围 | PRD **v4.1** §10.2：对话内容 + Electron 桌面壳 + 模式 B 横切 |
| 实现快照 | PRD [§1.2 当前实现进展](../product/PRD-小窗.md#12-当前范围) |
| 路线图 | [chat-execution-roadmap.md](./chat-execution-roadmap.md) |

---

## 1. 自动化冒烟（必须先过）

在仓库根目录，Companion 已启动且本机 `codex` 可用：

```bash
# 终端 A
COMPANION_RUN_MODE=cli pnpm companion:dev

# 终端 B（仓库根）
pnpm mvp:verify
```

| 命令 | 通过含义 |
|------|----------|
| `pnpm skills:verify` | `composeRunPrompts` 能加载 platform + `skill-qa` + 横切规范 + Agent Kit 路径 |
| `pnpm smoke:companion`（codex 严格档） | `/v1/health` runMode=cli；codex 短 Run 有 `run.started`（含 `orchestrationMode`）→ `tool.progress` → `message.delta` → `run.finished`。**本机未装 codex 时会 FAIL；想跳过用 `pnpm smoke:companion:codex`**。 |
| `pnpm smoke:companion:claude` | claude 短 Run 同上事件链；`--soft`：未装时 SKIP（exit 0） |
| `pnpm mvp:verify` | `skills:verify` + codex/claude 各跑一次（任一缺失自动 SKIP）+ `smoke-companion-any.mjs` 兜底（要求至少一个 CLI 真流通过） |

**Web 环境（`web/.env.local`）：**

```env
CHAT_EXECUTION=companion
COMPANION_BASE_URL=http://127.0.0.1:9477
COMPANION_USE_MOCK=false
```

Companion 进程：

```env
COMPANION_RUN_MODE=cli
COMPANION_CLI_FALLBACK=error
```

---

## 2. 对话 P0（人工点验，约 30 分钟）

| # | 项 | 操作 | 通过 |
|---|-----|------|------|
| D1 | 真流式（codex） | 新建对话 → 选 codex → 发「只回复：好」 | ✅ CLI 真流已验：`pnpm mvp:verify` / `smoke:companion:codex` PASS（codex-cli 0.130.0）；GUI 回归覆盖长会话、刷新、文件链接 |
| D1c | 真流式（claude） | 新建对话 → 切到 claude → 发「只回复：好」 | ✅ CLI 真流已验：`pnpm mvp:verify` / `smoke:companion:claude` PASS（Claude Code 2.1.161）；事件序列含 `tool.progress`/`message.delta`/`canonical.output`/`run.finished` |
| D2 | 停止 | 长问题中途点停止 | ✅ 2026-06-26 复测并修复快速取消竞态：`/v1/runs/:runId/cancel` → `run.cancelled`，Run 记录 `status:"cancelled"`，无残留 `codex exec` 进程 |
| D3 | 自动问答策略 | 新对话不展示快/深选择；简单/复杂问题均能发起 | ✅ 代码已完成：默认 `auto` → `skill-qa`，`fast/deep` 仅兼容旧会话 |
| D4 | parts 交错 | 深度或带工具的问题 | ✅ 代码已完成：`parts[]` reducer + `tool_batch` 默认折叠 |
| D5 | Turn 吸顶 | 多轮后上下滚 | ✅ 已修复并自动化验收：`useActiveTurn` 现在只把覆盖/接近 sticky 锚点的 Turn 标为 active，避免已滚出父容器的上一轮继续吸顶；`pnpm -C web test:e2e chat.spec.ts --project=chromium --grep "stable long-session"` PASS（2026-06-26） |
| D6 | 状态点 | 看顶栏圆点 tooltip | ✅ 2026-06-26 GUI DOM 复检：`/chat` 顶栏 tooltip 为「Companion 已连接 · codex CLI 可用 · cli」；`/api/runtime/health` 返回 `/v1/agents` 状态 |
| D7 | Companion 挂掉 | 停 Companion 再发消息 | ✅ 2026-06-26 复测：停 Companion 后 `/api/runtime/health` 返回 `{ok:false,error:"fetch failed"}`，`POST /api/chat` 返回 HTTP 422 `agent_unavailable`，非静默模拟成功 |
| D8 | 历史种子 | 打开带示例 parts 的会话 | ✅ 代码已完成：旧 `content` + `parts[]` 兼容渲染 |
| D9 | 会话持久化 | 发多轮 → 刷新页 → 历史仍在 | ✅ 2026-06-26 GUI 回归：大纲确认后刷新仍保留用户编辑；`stable long-session` / `persists committed outline` PASS |

勾选后可在 roadmap「S1.2 / S1.3」验收条打勾。

---

## 3. 项目与工作区（`0.1.0-alpha` 最小集）

| # | 项 | 通过 |
|---|-----|------|
| W1 | 未选课题文件夹 → 首条消息前可草稿；发送后 `ensure-default-task-project` 创建 XIAOCHUANG 任务目录（§5.3.2.1a） | ✅ |
| W2 | 侧栏/下拉能列项目；平台默认任务归入「默认工作区（XIAOCHUANG）」 | ✅ |
| W3 | Web 手填路径导入文件夹 → 新建会话绑定 | ✅ 后端契约 + GUI（2026-06-06：`POST /v1/projects/import-folder` `~/Projects/jlc-smoke-test` → `proj-c8e31e49`，`baseDir` 不外泄；用户 GUI 验证通过） |
| W4 | 对话内点击文件路径打开工作区（F-QA-010） | ✅ 后端契约 + GUI（2026-06-26：Markdown 相对链接 `../../../docs/product/PRD-小窗.md` 可打开右侧工作区文件；`opens workspace file links` PASS） |
| W5 | 六模块导航与下线范围一致 | ✅ 已完成：现行导航与模块注册已收口到对话 / 写作 / PPT / 3D绘图 / 视频 / 推演；翻译、会议、知识库已移出当前导航 |

---

## 4. 桌面壳（有 Electron 时）

| # | 项 | 通过 |
|---|-----|------|
| E1 | `pnpm desktop:dev` 加载 `http://localhost:3000` | ✅ 后端联通 + GUI（2026-06-06：`pnpm desktop:dev` Electron 主进程加载 `JLC_WEB_URL=http://localhost:3000`；用户 GUI 验证通过） |
| E2 | 「添加项目」系统选目录 → 列表出现新项目 | ✅ 后端契约 + GUI（同 W3：`pickAndImportFolder` IPC → Companion `import-folder`；用户 GUI 验证通过） |
| E3 | `pnpm desktop:pack:dir` 解包后启动（可选） | ✅ 打包目录与冷启动通过：`pnpm --filter @jlc/desktop pack:dir` PASS（2026-06-26），产物 `apps/desktop/release/mac-arm64/小窗.app` 含 `web-standalone`、`companion/companion.cjs`、`skills`、`prompts`；从无 dev Companion 的状态启动 `.app` 后，内置 `Contents/Resources/companion/companion.cjs` 自启动并通过 `GET /v1/health` |
| E4 | HMAC 注册与受信导入 | ✅ 代码已完成：`companion-register` + `X-JLC-Desktop-Import-Token`；需打包态复测 |
| E5 | 托盘 / Companion 守护 / 自动更新 | ✅ 代码已接入主进程；需按 Desktop Beta 路线单独验收 |

---

## 5. 明确不在 `0.1.0-alpha` 收口内

- Nest `api/` 全量替代 Web Mock 登录与会话列表（见 PRD §8.6）
- S3.5 思考耗时 / **DeliverablesCard** 成品卡 UI（SSE `deliverables` 可有）
- 写作 / PPT / 3D / 视频 / 推演的正式业务闭环验收（入口可见，按 Beta / 子线计划单独验收）
- 模式 A 云端完整工作区
- F-RT-009-B LLM Handoff（依赖 BYOK）
- `web` 全量 `tsc --noEmit` 零错误不再作为排除项；2026-06-26 已通过 `pnpm -C web exec tsc --noEmit --pretty false`

---

## 6. 收口结论模板

```text
0.1.0-alpha 收口：通过 / 有条件通过 / 未通过
日期：
自动化：mvp:verify [ PASS | FAIL ] · CLI 通过：[ codex | claude | both ]
人工：D1/D1c–D9 [ n/10 ]，W1–W4 [ n/4 ]，E1–E2 [ n/2 | N/A ]
阻塞项：
下一迭代：S3.5 deliverables UI / Nest 对接 / Desktop Beta 主线与 3D / 视频 / 推演子线
```

## 7. 当前收口记录（2026-06-26）

```text
0.1.0-alpha 收口：有条件通过
日期：2026-06-26
自动化：`pnpm mvp:verify` PASS；pnpm qa:writing-ppt-ai-ui PASS；pnpm -C web exec tsc --noEmit --pretty false PASS；pnpm -C web build PASS（保留 Turbopack NFT tracing warning）；pnpm -C web test:e2e chat.spec.ts --project=chromium --grep "stable long-session|persists committed outline" PASS；pnpm --filter @jlc/desktop pack:dir PASS；打包态 `.app` 冷启动 + 内置 Companion `/v1/health` PASS
CLI 通过：both（`smoke:companion:codex` PASS，codex-cli 0.130.0；`smoke:companion:claude` PASS，Claude Code 2.1.161）；`pnpm smoke:writing-ppt-ai-ui -- --agent codex --flow T2 --soft` PASS
人工：D1/D1c CLI 真流、D2 停止、D5 长会话吸顶、D6 状态点、D7 Companion 断连、D9 刷新持久化、W4 文件链接已完成抽检/回归；E3 已完成 mac-arm64 解包产物与冷启动验证
阻塞项：无代码阻塞；剩余为证书签名、公证与 Desktop Beta 体验打磨
下一迭代：Desktop Beta 系统托盘体验、自动更新、写作/PPT CLI smoke 覆盖扩展
```

备注：`smoke-companion-sse.mjs` / `smoke-companion-any.mjs` 已加入 Companion 健康检查短重试，避免 `skills:verify` 触发 dev watch 重启时产生瞬时 `ECONNREFUSED` 假失败。

补充记录（2026-06-26）：抽检发现快速取消竞态，原因是 Run 在 `AbortController` 已 aborted 后才进入 `runAgent` 并挂监听；已在 `run-agent.ts` 增加已取消 signal 的前置处理与 spawn 后立即中断处理。复测同类快速取消：1 秒内收到 `run.cancelled`，Run 记录为 `cancelled`，无残留 CLI 进程。

---

*文档结束*

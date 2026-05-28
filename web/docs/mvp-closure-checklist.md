# MVP 收口验收清单（v3.0）

| 属性 | 内容 |
|------|------|
| 版本 | v1.1 |
| 日期 | 2026-05-23 |
| 范围 | PRD **v3.5** §10.2：对话内容 + Electron 桌面壳 + 模式 B 横切 |
| 实现快照 | PRD [§12.5.9](../../PRD-小窗.md#1259-实现快照2026-05-23) |
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
| `pnpm skills:verify` | `composeRunPrompts` 能加载 platform + `skill-qa-fast` + 横切规范 + Agent Kit 路径 |
| `pnpm smoke:companion` | `/v1/health` runMode=cli；短 Run 有 `run.started`（含 `orchestrationMode`）→ `tool.progress` → `message.delta` → `run.finished` |

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
| D1 | 真流式 | 新建对话 → 选 codex → 发「只回复：好」 | 有过程行 + 流式正文，非 Mock 固定话术 |
| D2 | 停止 | 长问题中途点停止 | 保留已输出；状态变 idle |
| D3 | 两档模式 | 切换快速/深度各发一问 | 深度回答更长或带步骤（不要求完全一致） |
| D4 | parts 交错 | 深度或带工具的问题 | 过程与正文按时间序出现；`tool_batch` 完成后默认折叠 |
| D5 | Turn 吸顶 | 多轮后上下滚 | 当前视口对应用户问 sticky，非永远顶栏标题 |
| D6 | 状态点 | 看顶栏圆点 tooltip | 含「Companion 已连接 · {agentId} CLI 可用」 |
| D7 | Companion 挂掉 | 停 Companion 再发消息 | 明确错误，非静默模拟成功 |
| D8 | 历史种子 | 打开带示例 parts 的会话 | 旧 `content` 仍可渲染 |
| D9 | 会话持久化 | 发多轮 → 刷新页 → 历史仍在 | Companion `sessions` 或 localStorage 回退均可见历史 |

勾选后可在 roadmap「S1.2 / S1.3」验收条打勾。

---

## 3. 项目与工作区（MVP 最小集）

| # | 项 | 通过 |
|---|-----|------|
| W1 | 未选课题文件夹 → 首条消息前可草稿；发送后 `ensure-default-task-project` 创建 XIAOCHUANG 任务目录（§5.3.2.1a） | ✅ |
| W2 | 侧栏/下拉能列项目；平台默认任务归入「默认工作区（XIAOCHUANG）」 | ✅ |
| W3 | Web 手填路径导入文件夹 → 新建会话绑定 | ⬜ |
| W4 | 对话内点击文件路径打开工作区（F-QA-010） | ⬜ |

---

## 4. 桌面壳（有 Electron 时）

| # | 项 | 通过 |
|---|-----|------|
| E1 | `pnpm desktop:dev` 加载 `http://localhost:3000` | ⬜ |
| E2 | 「添加项目」系统选目录 → 列表出现新项目 | ⬜ |
| E3 | `pnpm desktop:pack:dir` 解包后启动（可选） | ⬜ 不挡 MVP 演示 |

---

## 5. 明确不在 MVP 收口内

- Nest `api/` 全量替代 Web Mock 登录与会话列表（见 PRD §8.6）
- S3.5 思考耗时 / **DeliverablesCard** 成品卡 UI（SSE `deliverables` 可有）
- 纪要 / 写作 / PPT / 翻译业务模块
- 模式 A 云端完整工作区
- F-RT-009-B LLM Handoff（依赖 BYOK）
- `web` 全量 `tsc --noEmit` 零错误（存在已知类型债，不挡演示）

---

## 6. 收口结论模板

```text
MVP 收口：通过 / 有条件通过 / 未通过
日期：
自动化：mvp:verify [ PASS | FAIL ]
人工：D1–D9 [ n/9 ]，W1–W4 [ n/4 ]，E1–E2 [ n/2 | N/A ]
阻塞项：
下一迭代：S3.5 deliverables UI / Nest 对接 / V1.1 模块
```

---

*文档结束*

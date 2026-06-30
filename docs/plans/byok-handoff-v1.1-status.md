# BYOK + Handoff · Desktop Beta 实现状态（2026-06-08）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.1 |
| 修订日期 | 2026-06-08 |
| 上级文档 | [docs/product/PRD-小窗.md §F-RT-002 / §F-RT-009-B](../product/PRD-小窗.md) |
| 关联代码 | `packages/runtime-core/src/transcript-handoff.ts`、`web/src/lib/byok/server.ts`、`web/src/lib/chat-handoff.ts`、`web/src/app/api/sessions/[id]/compress-context/route.ts`、`web/src/components/chat/useChatSend.ts` |

## 1. 决策（2026-06-08）

把 PRD 中 F-RT-002 + F-RT-009-B 的全量需求拆为 **Desktop Beta 桌面单机最小闭环** 与 **Desktop Beta 后期 polish / Web Sandbox**：

| 段 | Desktop Beta 桌面单机最小闭环 | Desktop Beta 后期 polish | Web Sandbox |
|----|----------------------|------------------|------|
| F-RT-002 | 沿用现有 BYOK 设置面板（multi-vendor、SSRF、Anthropic ↔ OpenAI 转换） | 降级横幅 / connection-test→保存 gating / 错误文案收口 | admin gate / Postgres 加密存储 / audit 日志 |
| F-RT-009-B1 LLM Handoff 摘要 | ✅ 落地（`buildLlmHandoffSummary`） | — | — |
| F-RT-009-B2 触发策略 | ✅ 自动触发（`shouldAutoCompressBeforeSend`） | 手动按钮（"压缩上下文并继续"） | — |
| F-RT-009-B3 摘要持久化 | ✅ 落地（`ChatSessionRecord.contextCompression`） | 顶栏 Badge / 侧栏 tooltip 真正使用该字段 | 服务端持久化 |
| F-RT-009-B4 用摘要开新对话 | ✅ helper 落地（`openHandoffNewChat`） | UI 按钮 + 标题回填 | — |
| F-RT-009-B5 双通道一致 | — | — | API 通道写 prepend；CLI 通道由 companion 接 |
| F-RT-009-B6 成本/配额/审计 | — | — | admin 配额面板 |
| F-RT-009-B7 失败降级 | ✅ Server 路由内自动回退确定性（`fallback.from`） | — | — |
| F-RT-009-B8 SSE 断线重连 | — | — | 与桌面壳重连一并做 |

**推到 Web Sandbox 的理由**（历史 memory 仍沿用 V1.1 命名）：admin gate、Postgres 加密存储、audit 日志、配额面板都依赖 Nest 多用户后台，与"本机单用户 + Companion"形态正交。

---

## 2. 数据通路

```
ChatComposer
   └─ useChatSend.sendMessage()
       └─ baseMessages.length 字符 ≥ 120k → callCompressContext({ mode: "auto" })
                                             │
                                  POST /api/sessions/{id}/compress-context
                                             │
            ┌────────────────────────────────┴───────────────────────────────┐
            │                                                                │
   "deterministic"                                                  "llm-handoff"
   (runtime-core)                                                  (BYOK provider)
   compressConversationMessages                          oneShotApiProviderCompletion
                                                          ↓ summarizer
                                                buildLlmHandoffSummary
                                                          │
            └────────────────────────────────┬───────────────────────────────┘
                                             ▼
                              { summary, summaryPreview, droppedCount, ... }
                                             │
                                      持久化到 ChatSessionRecord.contextCompression
                                      historyForApi 替换为 [summary, ...recent, userMsg]
                                      historyForUi  保留全文（用户能看到原文）
                                             │
                                       streamChatCompletion(historyForApi)
```

**关键不变量：**

1. **UI 历史不被静默截断** —— `historyForUi` 始终保留所有 user/assistant 原文，用户能看到。`historyForApi` 才是替换过的"压缩版"发到 chat 路由。
2. **失败永远不阻塞发送** —— `compress-context` 路由失败时 `useChatSend` 仅 `console.warn` 走原 `historyForApi`，Companion 侧的 `prepareMessagesForRun` 兜底确定性截断。
3. **server 路由内做 B7 回退** —— LLM Handoff 失败时 server 自动转 deterministic 并在 response.fallback 字段透出原因；client 不需要感知。

---

## 3. 文件清单

| 文件 | 状态 | 用途 |
|------|------|------|
| `packages/runtime-core/src/transcript-handoff.ts` | ✅ 新增 | 5 标题 Markdown 摘要构建器；纯函数；接受 `summarizer` 注入；`assertHandoffSummaryShape` 兜底缺标题 |
| `packages/runtime-core/src/index.ts` | ✅ 改 | 导出 `buildLlmHandoffSummary` 等 |
| `web/src/lib/byok/server.ts` | ✅ 改 | 新增 `oneShotApiProviderCompletion`（一次性非流式调 BYOK） |
| `web/src/app/api/sessions/[id]/compress-context/route.ts` | ✅ 新增 | POST 路由；mode = auto / deterministic / llm-handoff；B7 回退 |
| `web/src/lib/chat-history.ts` | ✅ 改 | `ChatSessionRecord` 加 `contextCompression`；`patchChatSession` 接受该字段；新 helper `setSessionContextCompression` / `clearSessionContextCompression` |
| `web/src/lib/chat-handoff.ts` | ✅ 新增 | 客户端集成层：`shouldAutoCompressBeforeSend` / `callCompressContext` / `applyCompressionToMessages` / `persistCompressionRecord` / `openHandoffNewChat`（B4 helper） |
| `web/src/components/chat/useChatSend.ts` | ✅ 改 | 发送前自动压缩；UI 历史不动 |

---

## 4. 验收（Desktop Beta 桌面单机最小闭环）

- [x] 长会话（> 120k 字符）触发自动压缩，下一轮 Run 仍能延续「已决事项」与「当前焦点」（手测：跑长对话后看 `historyForApi` 缩短）
- [x] BYOK 不可用时 `compress-context` 自动走确定性，对话不中断
- [x] 配置 BYOK 后，longer 长度（> 800 KB 字节估算）首选 LLM Handoff
- [x] LLM Handoff 失败时 response 含 `fallback: { from: "llm-handoff", reason }`，client 透传持久化
- [x] `ChatSessionRecord.contextCompression.summaryPreview` 持久化，可后续接入顶栏 Badge
- [ ] 顶栏 / 侧栏可识别「已压缩上下文」状态 —— UI 入口待 polish
- [ ] 「用摘要开新对话」按钮 —— 待 polish（helper 已就位 `openHandoffNewChat`）

---

## 5. 后续 polish 实现指引

### 5.1 加"压缩上下文并继续"按钮（手动 B2）

`ChatComposer.tsx` 在工具栏增加按钮，点击调：
```ts
import { callCompressContext, applyCompressionToMessages, persistCompressionRecord } from "@/lib/chat-handoff";
const payload = await callCompressContext({ sessionId, messages, mode: "auto", force: true, apiProvider });
persistCompressionRecord(sessionId, payload);
setMessages(applyCompressionToMessages(messages, payload));
```

### 5.2 加"用摘要开新对话"按钮（B4）

`ChatThread.tsx` 顶栏 / 设置菜单中：
```ts
import { openHandoffNewChat } from "@/lib/chat-handoff";
const newId = await openHandoffNewChat({
  parentSessionId: id,
  summary: latestCompressionSummary,
  projectId: sessionProjectId,
});
router.push(`/chat/${newId}`);
```

### 5.3 顶栏 Badge

读 `getChatSession(id)?.contextCompression?.summaryPreview` 显示。
`source === "deterministic"` 时显示「本地摘要」、`"llm-handoff"` 时显示「智能摘要 · {modelId}」。

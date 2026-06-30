# 工作区架构 — XIAOCHUANG 与 projectId

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0 |
| 修订日期 | 2026-05-27 |
| 状态 | 已定（与 PRD v3.6.7 一致） |
| 上级文档 | [PRD-小窗.md](../product/PRD-小窗.md) **§5.3.2.1a/b/c**、**§6.0.3**、**§6.0.4**、**§12.5.3** |
| 关联 | [companion-api.md](./companion-api.md)、[folder-import-and-desktop-shell.md](./folder-import-and-desktop-shell.md)、[module-registry.ts](../../web/src/lib/module-registry.ts) |

> **定位：** 研发/验收用的**工作区单一入口文档**。产品细则以 PRD 为准；Companion 契约见 `companion-api.md`。

---

## 1. 核心原则

| 原则 | 说明 |
|------|------|
| 始终有 `projectId` | 未选用户课题目录 ≠ 无工作区；平台在 XIAOCHUANG 自动建任务目录 |
| 一任务一叶子目录 | 新建对话/写作/PPT 等 = 一个 `{YYYY-MM-DD}/{标题简写}/` + 一个 `projectId` |
| Agent `cwd` | = 任务叶子目录（`baseDir`）；日期目录仅分组 |
| 固定绑定 | 会话/任务创建后 `projectId` **不可改**；换课题 = **新建**会话 |
| 分支继承 | 对话分支、Handoff 开新对话 → 新 `sessionId`，**继承**父 `projectId`，**不**新建目录 |
| 禁止回退 | 量产路径**不得**长期使用 `sandbox-default` 作为用户默认工作区 |
| Web / Desktop 默认不互通 | `cloud` 与本地工作区属于不同存储域；禁止自动同步、禁止跨端 fallback 读写对方工作区 |
| 共享后台不等于共享工作区 | 账号、登录、项目元数据可由同一业务 API 管理；工作区文件、执行目录、运行缓存、任务执行状态必须按 `workspaceKind` 隔离 |

---

## 2. 目录树（模式 B）

```text
{defaultWorkspaceRoot}/          ← 默认 ~/Documents（macOS 文稿）
  XIAOCHUANG/
    {moduleSegment}/             ← module-registry.workspaceSegment
      {YYYY-MM-DD}/              ← 仅分组，非 cwd
        {标题简写}/              ← Agent cwd；一任务一目录
          …产出文件…
```

**示例：**

```text
~/Documents/XIAOCHUANG/会话/2026-05-27/原油周报/
~/Documents/XIAOCHUANG/写作/2026-05-27/政策解读-储能/
~/Documents/XIAOCHUANG/PPT/2026-05-27/路演初稿/
```

**模块 segment（首期）：**

| `moduleId` | `workspaceSegment` | 备注 |
|------------|-------------------|------|
| `chat` | `会话` | 每条新对话任务 |
| `writing` | `写作` | 每次新建文稿任务 |
| `ppt` | `PPT` | 每次新建 deck 任务 |

Segment 来源：`web/src/lib/module-registry.ts`，Companion **禁止**硬编码。

---

## 3. 下一大版本 Web 工作区（OSS 等价路径）

当 Web 升级为正式在线沙箱产品后，`workspaceKind = cloud`；语义与上表一致，物理存储为对象存储：

```text
tenants/{tenantId}/users/{userId}/XIAOCHUANG/{moduleSegment}/{YYYY-MM-DD}/{标题简写}/
```

详见 PRD §5.3.2.1c、[技术方案.md](./技术方案.md) §5.1.1。**不**读写用户本机 `~/Documents`，也不通过 Companion 代理本地目录。这属于下一大版本目标，不是当前 Desktop 主路径。

---

## 4. `workspaceKind` 与 `bindingSource`

| `workspaceKind` | 场景 | 模式 B 根 | `bindingSource`（仅 local_bound） |
|-----------------|------|-----------|-----------------------------------|
| `local_bound` | 用户选课题文件夹 | 用户 `baseDir` | `user_picked` |
| `local_bound` | 平台默认 XIAOCHUANG | 自动建叶子目录 | `platform_default` |
| `cloud` | 下一大版本 Web 在线工作区 | OSS 前缀 | - |
| `sandbox` | 内部/迁移 | Companion `dataDir` | - |

`platform_default`：**产品预授权**，新建任务不需每次弹本地授权；路径白名单见 PRD §5.3.2.2.1。

---

## 5. 新建 vs 分支

| 触发 | 新建 `{YYYY-MM-DD}/{标题简写}/` | `projectId` |
|------|--------------------------------|-------------|
| 新建对话（未选用户课题） | ✅ | 新建 |
| 新建写作 / PPT | ✅ | 新建 |
| 对话分支、Handoff 开新对话 | ❌ | **继承**父会话 |
| 用户选课题后新建 | 可选新建子目录或复用 | 新建或复用 |
| 用户选课题后分支 | ❌ | **继承** |

---

## 6. UI 分组 vs `projectId`

| UI 层 | 规则 |
|-------|------|
| **ProjectWorkPicker** | 选项：用户课题列表 +「不绑定课题文件夹」（仅影响**下一次新建**） |
| **Composer 草稿态** | 首条消息前可无 `projectId`（`NO_PROJECT_ID`） |
| **任务创建后** | 展示 `name` + `pathSummary`；与用户课题**同一套**工作区逻辑 |
| **侧栏历史** | 用户课题按课题名分组；平台默认任务与历史兼容的未绑定会话统一归入 **「默认工作文件夹（XIAOCHUANG）」**；正式任务不应长期停留在 `NO_PROJECT_ID` |
| **禁止** | 任务已创建后长期显示「无项目」 |
| **文件树 / `@`** | Scope = 当前会话/任务的 `projectId` 根；不展示整个 XIAOCHUANG 树 |

---

## 7. Companion API（摘要）

| 接口 | 用途 |
|------|------|
| `POST /v1/projects/import-folder` | 用户课题：`user_picked` + `baseDir` |
| `POST /v1/projects/ensure-default-task-project` | 平台默认：`platform_default` + 自动路径（Desktop Alpha 已接入，Desktop Beta 继续验收） |
| `GET /v1/projects/{id}/tree` | 列当前任务工作区 |

完整契约：[companion-api.md](./companion-api.md) §2。

---

## 8. 数据权威（§6.0.4）

| 模块 | 列表/索引 | 正文权威 |
|------|-----------|----------|
| 对话 | Nest `chat-sessions` | Companion `sessions/{id}.json` |
| 写作 / PPT | Nest 业务任务表 | **`projectId` 工作区文件** |

当前 Desktop Alpha 的对话正文权威仍在 Companion；Web Sandbox 1.0 上线后，Web Run 正文与产物权威转为 `cloud workspace` + 服务端 Run 索引。两者不自动同步。

---

## 9. 实现差距（原型）

| 项 | 现状 | 目标 |
|----|------|------|
| Web 首条发送 | `resolveCompanionWorkspaceProjectId` → `ensure-default-task-project` | ✅ v1.1 原型已接 |
| Companion store | `ensureDefaultTaskProject()` + HTTP 路由 | ✅ |
| 侧栏 / 文案 | 「默认工作文件夹（XIAOCHUANG）」作为唯一默认根概念；默认创建任务仍保留真实 `projectId` + `pathSummary` | ✅ |
| Web BFF | `GET/POST /api/projects*` | ✅ |
| Nest 分支 | `sessions.service.branch` 继承 `projectId`；Web `branchChatSession`  helper | ✅ API + 本地 helper |

跟踪：[design-doc-audit-recommendations.md](../audits/design-doc-audit-recommendations.md)（v1.8）— C-01～C-07 已落实，遗留项见审计 §四备注。

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-05-27 | §9 实现差距全部标 ✅；脚注更新为 v1.8 审计 doc |
| v1.0 | 2026-05-27 | 初稿：N-01；汇总 PRD v3.6.7 工作区已决项 |

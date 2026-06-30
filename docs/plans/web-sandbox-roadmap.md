# Web Sandbox 路线图（v0.1）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.1 |
| 日期 | 2026-06-25 |
| 适用范围 | Web 在线沙箱产品规划 |
| 当前平台版本 | `0.1.0-alpha` / Desktop Alpha |
| 对齐文档 | [docs/product/platform-workspace-boundary.md](../product/platform-workspace-boundary.md)、[docs/product/需求整理.md](../product/需求整理.md)、[docs/technical/技术方案.md](../technical/技术方案.md)、[docs/technical/workspace-architecture.md](../technical/workspace-architecture.md) |

---

## 1. 目标与结论

本文件回答三个问题：

1. 当前 `Web` 距离“正式在线沙箱产品”还差什么。
2. 推荐采用什么目标架构。
3. 应按什么阶段推进，既不污染 Desktop 主路径，也能让 Web 后续独立成立。

**结论先行：**

- `Desktop` 继续沿用 **本地工作区 + 本机 Companion + 本机 CLI** 主路径。
- `Web` 不再依赖用户本机 Companion，也不依赖用户本机 CLI。
- `Web` 的正式目标架构应固定为：  
  **Web Frontend -> BFF / App Server -> Cloud Sandbox Runtime -> Cloud Workspace**
- `Web` 如需继续使用 `codex` / `claude` / `hermes` 一类智能体 CLI，应运行在**云端 Runtime 镜像**内，而不是运行在用户设备上。
- `Hermes gateway` 如继续保留，只能作为开发 / 演示捷径，不能再定义为正式 Web 架构分支。

---

## 2. 当前差距清单

### 2.1 已有可复用基础

- `web/` 已具备对话主壳、工作区 UI、文件预览、SSE 消费能力。
- `packages/contracts/` 与 `packages/runtime-core/` 已提供统一事件、Prompt 组装、Agent 适配基础。
- `companion/` 已跑通本地执行链路，可复用其 Run 协议、事件模型、工作区抽象思路。
- 工作区、`projectId`、`workspaceKind`、交付物卡片等上层产品心智已经形成。

### 2.2 当前核心缺口

| 类别 | 当前状态 | Web 正式目标缺口 |
|------|----------|------------------|
| 执行面 | 仍可借本机 Companion 联调 | 需要独立 Cloud Runtime |
| 工作区 | 在线沙箱语义已定义 | 需要真实 Cloud Workspace 闭环 |
| 文件存储 | 方案已写 OSS/S3 | 需要真实上传、列树、读写、下载链路 |
| 会话权威 | 部分仍带原型/降级逻辑 | 需要服务端权威会话与 Run 状态 |
| 安全隔离 | 产品原则已写 | 需要租户、用户、任务级隔离与清理策略 |
| 运维能力 | 多为文档级设计 | 需要部署、镜像、监控、日志、审计 |

### 2.3 当前最不该继续延续的实现

- `Web` 通过本机 `Companion` 执行正式任务
- `Web` 回退到本地项目目录或本地路径录入
- `Web` 将关键执行权威状态放在浏览器本地
- `Web` 与 `Desktop` 共用同一份工作区或同一执行目录

---

## 3. 推荐方案

### 3.1 推荐架构

```text
浏览器
  -> Web Frontend（Next.js）
  -> BFF / App Server
  -> Cloud Sandbox Runtime
  -> Cloud Workspace（OSS / S3）
  -> PostgreSQL / Redis / Audit Store
```

### 3.2 分层职责

| 层 | 职责 | 说明 |
|----|------|------|
| Web Frontend | 对话、文件树、上传、预览、运行状态展示 | 不感知本机路径、本机 CLI、本机 Companion |
| BFF / App Server | 鉴权、会话、项目元数据、SSE 代理、上传授权、任务编排 | Web 的服务端入口 |
| Cloud Sandbox Runtime | 分配工作区、运行 Agent、产出事件、回写文件 | Web 的正式执行面 |
| Cloud Workspace | 文件存储、目录树、交付物落盘、上传资料管理 | `workspaceKind = cloud` |
| Data Plane | PostgreSQL、Redis、审计日志、对象存储 | 状态、索引、恢复、权限与审计 |

### 3.3 CLI 策略

Web 有两种可选执行策略：

| 方案 | 是否推荐 | 说明 |
|------|----------|------|
| 云端 Runtime 内预装 CLI | **推荐** | 最大化复用现有 `runtime-core` 与多 Agent 适配 |
| 云端 Runtime 直连模型 Provider API | 可作为后续增强 | 更轻，但需另补工具循环、事件映射、兼容策略 |

**推荐结论：**  
Web 第一版优先采用“**云端 Runtime 内预装 CLI**”方案。这样可以最大程度复用当前 Desktop 路径已验证过的 Agent 适配、SSE 事件、Prompt 组装和交付物流。

---

## 4. 复用与替换建议

### 4.1 可以直接复用

- `web/` 的对话 UI、工作区 UI、文件预览与交付物卡片
- `packages/contracts/` 的事件契约
- `packages/runtime-core/` 的 Prompt 组装、Skill 注入、Agent 适配抽象
- `projectId` / `workspaceKind` / `RunEvent` 等上层模型

### 4.2 建议抽象后复用

- `companion` 的 Run 管理逻辑
- `companion` 的工作区分配思路
- `companion-api` 中和本地无关的运行协议
- `skills/` 体系：流程主驱动层，负责场景路由、模板切换、步骤编排与输出约束

### 4.2.1 Web Sandbox 的 Skill 策略

Web Sandbox 不是“去 Skill 化”，而是“把 Skill 变成在线工作区的流程骨架”。

- `chat`、`writing`、`ppt` 继续各自保留基座 Skill。
- 复杂场景优先由 Skill 切换，而不是由 UI 增加更多按钮。
- Skill 可引用模板、参考资料、输出规范、检查清单、交付格式。
- Runtime 只负责执行和回传，不负责重新发明流程。
- 对用户暴露的是任务意图与产物，不暴露 Skill 内部细节。

### 4.3 必须替换

- 本机 `Companion` 进程本身
- 本机路径依赖
- 浏览器侧任何“选择本地目录 / 手填本地路径 / 访问本机文件树”的正式入口
- 依赖 `localhost` 的正式 Web 执行链路

---

## 5. 分阶段实施方案

### P0：边界收口与双轨兼容

**目标：** 不立刻重写 Web，但先把正式边界锁死，避免继续朝错误方向叠代码。

**任务：**

- 明确 `Web` 正式环境禁止连接本机 Companion。
- 保留当前联调路径，但仅允许 `dev` / `demo` 环境使用。
- 在配置层区分：
  - `CHAT_EXECUTION=companion` 仅开发态
  - `CHAT_EXECUTION=cloud-runtime` 为正式 Web 目标
- 引入 `surfaceProfile`：`desktop` / `web` / `dev-only`，启动时校验 execution backend、workspace kind、catalog profile、provider 是否匹配。
- 把前端执行适配抽成 `ExecutionBackend`，避免 UI 直接耦合 Companion。
- 梳理所有本地降级逻辑，标注“仅开发态”。
- Web-only 的 `cloud-runtime`、`cloud` workspace、Web Catalog 配置不进入 Desktop 默认路径。

**验收：**

- 文档、配置、代码注释三处口径一致。
- 正式环境配置下，`Web` 不再暴露本地目录心智。
- 前端可以在不改 UI 逻辑的前提下切换后端执行源。

### P1：Cloud Runtime 最小闭环

**目标：** 让 Web 跑通第一条真正的在线执行链路。

**任务：**

- 建立 `runtime/` 服务骨架。
- 实现最小 `POST /runs` + SSE 返回。
- 落地 `workspaceKind = cloud` 的任务级工作区创建。
- 将工作区映射到 OSS / S3 前缀。
- 支持基础文件读写、产物扫描、交付物回传。
- Runtime 镜像内预装平台登记的 CLI 适配集。
- 接通 `web` 到 `cloud-runtime` 的真实链路。
- 锁定首版 `SandboxProvider` 契约：每 Run 一个容器 / Pod、独立 cloud workspace、最小密钥注入、白名单出网、资源限制、TTL 清理。

**验收：**

- Web 可在无本机 Companion 条件下完成一次对话执行。
- Agent 可在云端工作区生成文件并在 UI 中可见。
- `run.started`、`message.delta`、`deliverables`、`run.finished` 事件可完整回到前端。

### P2：在线工作区产品化

**目标：** 从“能跑”升级到“可用”。

**任务：**

- 完整文件树、上传、下载、预览链路
- 会话与 Run 恢复
- 工作区 TTL、清理、归档策略
- 租户 / 用户 / 会话级隔离
- 审计、日志、监控、错误回放
- 权限与配额控制

**验收：**

- 用户能稳定使用在线工作区进行多轮任务
- 刷新页面后可恢复任务和文件状态
- 运行失败时有明确错误与审计记录

### P3：多人协作与企业化

**目标：** 让 Web 从单用户在线沙箱升级为企业级在线平台。

**任务：**

- 多用户后台与组织能力
- 协作与分享链路
- 更细粒度权限
- 资源配额与成本治理
- 多区域 / 多环境部署

**验收：**

- Web 端可支持多人、跨设备、企业化治理

---

## 6. 推荐排期顺序

| 阶段 | 优先级 | 建议结果 |
|------|--------|----------|
| P0 | 必做 | 先把 Web 正式边界和开发捷径分开 |
| P1 | 必做 | 跑通最小在线执行闭环 |
| P2 | 高 | 补齐在线工作区产品能力 |
| P3 | 后续 | 再做企业化和协作 |

**建议顺序：**

1. 先做 `ExecutionBackend` 抽象和配置隔离
2. 再做 `runtime/` 最小服务
3. 再做 Cloud Workspace 与文件链路
4. 最后补运行恢复、权限、审计、协作

---

## 7. 不建议的方案

以下方案不建议继续投入：

- 让正式 Web 长期依赖用户本机 Companion
- 让正式 Web 长期依赖用户本机 CLI
- 让 Web 和 Desktop 共享同一工作区目录
- 先做多人协作，再补单用户在线工作区闭环
- 为 Web 单独重写一套完全不同的前端交互模型

---

## 8. 对当前工程的直接建议

### 8.1 近期建议

- 保持 Desktop 主线不动，继续按本地工作区产品打磨
- 给 `web` 增加“开发态 Companion / 正式态 Cloud Runtime”双后端抽象
- 新建 `runtime/` 目录，先只承接最小 Web Run

### 8.2 中期建议

- 抽离和本地无关的 Run 协议到共享层
- 将 `workspaceKind = cloud` 的 broker、存储映射、事件回放做成正式能力
- 继续把 Skill 作为复杂场景的主驱动，不把执行器当业务主语
- 将 Catalog 拆成 `desktop` / `web` 两套 profile，允许共享 Skill 仓库，不共享同一份可见面配置
- 收敛当前浏览器端 localStorage / mock 降级为开发专用
- Desktop 端继续冻结 `companion + local_bound` 主路径，不跟随 Web 新特性自动升级

### 8.3 一句话决策建议

**Desktop 继续强化本地工作区，Web 彻底收敛为在线沙箱产品；前端复用，执行面换轨。**

# 文档中心

> 当前平台发布版本为 **`0.1.2-alpha`（Desktop Alpha 补强版）**。产品边界以 [平台与工作区边界定义](./product/platform-workspace-boundary.md) 为准：**Desktop = 本地文件夹工作区**；**Web 在线沙箱工作区 = 下一大版本目标**。需求、技术、计划、归档文档统一收纳在本目录下；运行时资产文档（如 `skills/*/SKILL.md`、`prompts/*`）仍保留在对应资产目录。

## 目录约定

| 目录 | 内容 |
|------|------|
| [product/](./product/) | 当前产品需求、功能清单、平台边界、现行模块 PRD |
| [technical/](./technical/) | 技术方案、架构、协议、API、运行时设计 |
| [plans/](./plans/) | 路线图、实施计划、验收清单、阶段状态 |
| [design/](./design/) | UI/UX 规范、交互展示规格、桌面标题栏设计 |
| [audits/](./audits/) | 文档审计、差异排查、对齐建议 |
| [archive/](./archive/) | 已废止或历史版本文档，仅作追溯，不作为当前任务基准 |

## 产品需求

| 文档 | 说明 |
|------|------|
| [PRD-小窗.md](./product/PRD-小窗.md) | 当前主 PRD |
| [versioning.md](./product/versioning.md) | 平台发布版本、产品阶段、文档版本的统一规则 |
| [requirements-0.1.1-alpha.md](./product/requirements-0.1.1-alpha.md) | `0.1.1-alpha` 小优化需求清单 |
| [requirements-0.1.2-alpha.md](./product/requirements-0.1.2-alpha.md) | `0.1.2-alpha` 当前版本内容梳理 |
| [release-notes-0.1.2-alpha.md](./product/release-notes-0.1.2-alpha.md) | `0.1.2-alpha` 版本升级说明 |
| [platform-workspace-boundary.md](./product/platform-workspace-boundary.md) | Web / Desktop / Sandbox / Companion 边界定义 |
| [功能清单.md](./product/功能清单.md) | 当前模块与功能清单 |
| [需求整理.md](./product/需求整理.md) | 需求整理来源文档 |
| [writing-module-prd.v2.md](./product/modules/writing-module-prd.v2.md) | 写作模块现行 PRD |
| [ppt-module-prd.v2.md](./product/modules/ppt-module-prd.v2.md) | PPT 模块现行 PRD |

## 技术文档

| 文档 | 说明 |
|------|------|
| [技术方案.md](./technical/技术方案.md) | 总体技术方案 |
| [workspace-architecture.md](./technical/workspace-architecture.md) | **工作区架构**：XIAOCHUANG 目录树、新建 vs 分支、UI 分组、`projectId` |
| [companion-api.md](./technical/companion-api.md) | Companion HTTP 契约（v1.1，含 `import-folder`、`ensure-default-task-project`） |
| [folder-import-and-desktop-shell.md](./technical/folder-import-and-desktop-shell.md) | **本地文件夹导入 + 桌面壳**（对齐 PRD v3.6.7） |
| [desktop-shell.md](./technical/desktop-shell.md) | Electron 壳技术摘要（MVP 已交付基线） |
| [chat-core-architecture.md](./technical/chat-core-architecture.md) | 对话混合编排（F-RT-008） |
| [chat-message-parts.md](./technical/chat-message-parts.md) | 消息分块与 SSE |
| [chat-output-protocol.md](./technical/chat-output-protocol.md) | 对话输出协议 |
| [chat-skill-orchestration-analysis.md](./technical/chat-skill-orchestration-analysis.md) | Skill 编排分析 |
| [agent-cli-activity-mapping.md](./technical/agent-cli-activity-mapping.md) | **Agent CLI stdout → `tool.progress` → Activity UI**（F-QA-007 / F-RT-005） |
| [agent-loop-strategy-analysis.md](./technical/agent-loop-strategy-analysis.md) | **Agent Loop 策略分析**（CLI 委托 vs 自研、断开成因、OpenCode 对比） |
| [hermes-client.md](./technical/hermes-client.md) | 原型 Hermes Gateway 捷径（工程态参考，不代表最终产品边界） |

## 计划与状态

| 文档 | 说明 |
|------|------|
| [product-roadmap-v4.md](./plans/product-roadmap-v4.md) | 产品路线图（v4） |
| [platform-implementation-plan-v4.1.md](./plans/platform-implementation-plan-v4.1.md) | 六模块导航与主线实现方案 |
| [chat-execution-roadmap.md](./plans/chat-execution-roadmap.md) | Desktop Alpha 执行闭环清单 |
| [p0-three-module-acceptance.md](./plans/p0-three-module-acceptance.md) | 主线模块 P0 收口与六模块入口回归矩阵（文件名保留历史） |
| [three-module-quality-review.md](./plans/three-module-quality-review.md) | 六模块导航与主线模块稳定性 / 架构 / 交互评审清单（文件名保留历史） |
| [mvp-closure-checklist.md](./plans/mvp-closure-checklist.md) | `0.1.0-alpha` 收口验收清单 |
| [desktop-v1.1-roadmap.md](./plans/desktop-v1.1-roadmap.md) | Desktop Beta 桌面壳路线图（历史文件名保留） |
| [desktop-d1.4-bundle-status.md](./plans/desktop-d1.4-bundle-status.md) | 桌面 Companion 捆绑状态 |
| [writing-ppt-v1.1-status.md](./plans/writing-ppt-v1.1-status.md) | 写作/PPT 阶段状态 |
| [byok-handoff-v1.1-status.md](./plans/byok-handoff-v1.1-status.md) | BYOK / Handoff 状态 |
| [agent-runtime-implementation-roadmap.md](./plans/agent-runtime-implementation-roadmap.md) | Agent Runtime 实施路线 |
| [industrial-drawing-m1-execution-plan.md](./plans/industrial-drawing-m1-execution-plan.md) | 3D绘图模块 M1 四周执行计划（待 V1.1 收口后启动） |

## 设计与审计

| 文档 | 说明 |
|------|------|
| [UI设计规范-Claude风格.md](./design/UI设计规范-Claude风格.md) | UI 设计规范 |
| [chat-agent-output-ux.md](./design/chat-agent-output-ux.md) | 思考耗时 / 探索摘要 / 成品列表卡 |
| [chat-process-display-spec.md](./design/chat-process-display-spec.md) | 对话过程展示规格 |
| [desktop-titlebar-design.md](./design/desktop-titlebar-design.md) | 桌面标题栏设计 |
| [design-doc-audit-recommendations.md](./audits/design-doc-audit-recommendations.md) | 文档审计与对齐建议 |

## 归档

| 文档 | 说明 |
|------|------|
| [PRD-金联创智能研究平台.md](./archive/PRD-金联创智能研究平台.md) | 旧产品名 PRD 跳转说明 |
| [writing-module-prd.md](./archive/writing-module-prd.md) | 写作 v0.1，已被 v2 替代 |
| [ppt-module-prd.md](./archive/ppt-module-prd.md) | PPT v0.1，已被 v2 替代 |
| [translate-module-prd.md](./archive/translate-module-prd.md) | 翻译模块历史草案，不属于当前六模块导航路线 |
| [meeting-module-prd.md](./archive/meeting-module-prd.md) | 会议模块历史文档，不属于当前六模块导航路线 |

> 归档文档代表历史，不要求跟随当前代码状态更新。

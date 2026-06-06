# Web / 运行时设计文档索引

| 文档 | 说明 |
|------|------|
| [workspace-architecture.md](./workspace-architecture.md) | **工作区架构**：XIAOCHUANG 目录树、新建 vs 分支、UI 分组、`projectId` |
| [companion-api.md](./companion-api.md) | Companion HTTP 契约（v1.1，含 `import-folder`、`ensure-default-task-project`） |
| [folder-import-and-desktop-shell.md](./folder-import-and-desktop-shell.md) | **本地文件夹导入 + 桌面壳**（对齐 PRD v3.6.7） |
| [chat-execution-roadmap.md](./chat-execution-roadmap.md) | **MVP 实施清单**（对话 + 桌面壳 S4 优先） |
| [desktop-shell.md](./desktop-shell.md) | Electron 壳技术摘要（MVP 已交付基线） |
| [desktop-v1.1-roadmap.md](./desktop-v1.1-roadmap.md) | **桌面壳 V1.1 路线图（2026-06-06 立）**：Companion 守护 / 托盘 / HMAC / 捆绑 / 自动更新 / 系统通知 |
| [chat-core-architecture.md](./chat-core-architecture.md) | 对话混合编排（F-RT-008） |
| [chat-message-parts.md](./chat-message-parts.md) | 消息分块与 SSE |
| [chat-agent-output-ux.md](./chat-agent-output-ux.md) | **思考耗时 / 探索摘要 / 成品列表卡**（竞品对齐需求） |
| [chat-process-display-spec.md](./chat-process-display-spec.md) | **对话模块过程展示优化规格**（结果优先 / 过程折叠 / 技术详情分层） |
| [agent-cli-activity-mapping.md](./agent-cli-activity-mapping.md) | **Agent CLI stdout → `tool.progress` → Activity UI**（F-QA-007 / F-RT-005） |
| [agent-loop-strategy-analysis.md](./agent-loop-strategy-analysis.md) | **Agent Loop 策略分析**（CLI 委托 vs 自研、断开成因、OpenCode 对比） |
| [hermes-client.md](./hermes-client.md) | 原型 Hermes Gateway 捷径 |

## 模块子 PRD（V1.1）

| 文档 | 说明 |
|------|------|
| [meeting-module-prd.md](./meeting-module-prd.md) ⏸️ V1.1+ 推迟 | 会议纪要：ASR、说话人、纪要 Skill、线框（2026-06-06 推迟到 V1.1+） |
| [writing-module-prd.v2.md](./writing-module-prd.v2.md) | **写作（v1.0，2026-05-31，现行）**：对话 + 写作 Skill + MD 交付 + DOCX 导出 |
| ~~[writing-module-prd.md](./writing-module-prd.md)~~ | 写作 v0.1（已被 v2 替代，保留作历史） |
| [ppt-module-prd.v2.md](./ppt-module-prd.v2.md) | **PPT（v1.0，2026-05-31，现行）**：对话 + PPT Skill + 交付物 + 导出 |
| ~~[ppt-module-prd.md](./ppt-module-prd.md)~~ | PPT v0.1（已被 v2 替代，保留作历史） |

产品总览：[PRD v3.6.7](../../PRD-小窗.md) · [技术方案 v1.5](../../技术方案.md) · [功能清单](../../功能清单.md) · [设计文档审计](../../docs/design-doc-audit-recommendations.md)

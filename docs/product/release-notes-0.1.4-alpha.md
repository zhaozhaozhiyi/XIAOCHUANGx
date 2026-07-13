# 小窗 `0.1.4-alpha` 版本升级说明

| 属性 | 内容 |
|------|------|
| 平台版本 | `0.1.4-alpha` |
| 发布阶段 | Desktop Alpha 推演画布交互闭环补丁版 |
| 日期 | 2026-07-13 |
| 上一版本 | `0.1.3-alpha` |
| 后续目标 | `0.2.0-beta` / Desktop Beta |

---

## 1. 升级摘要

`0.1.4-alpha` 继续沿用 Desktop + 本地 Companion + 本地文件夹工作区的产品边界，不新增一级业务模块。它聚焦推演画布交互闭环：按钮定义、确认反馈、Topic 边界编辑、新版世界模型生成、历史 Round 回看与 UI smoke 稳定。

这一版的核心目标是让推演画布从“可交互 Demo”进入“可复测、可解释、可稳定演示”的状态。

---

## 2. 主要升级内容

### 2.1 画布动作注册表

- 新增画布按钮行为注册表，统一定义 `local`、`prompt`、`confirm`、`snapshot`、`pending` 五类行为。
- 当前快照覆盖 68 个画布动作，避免按钮无意退化为空动作或错误风险等级。
- 支持 Topic 世界模型入口等状态相关行为解析。

### 2.2 点击回执与影响预览

- 新增 Action Receipt，展示系统对用户点击的理解、目标节点、预期动作和是否可能生成新 Round。
- 变量、假设、事件、推理、证据、风险、决策、行动、结论等节点会展示下游影响预览。
- 最近操作日志保留当前画布会话内最近 12 条有效操作，区分新 Round 和报告动作。

### 2.3 高风险动作确认

- 路径继续、情景继续、变量重算、风险处置、行动执行、历史版本从此继续等硬选择点统一进入确认卡。
- 确认卡明确目标节点、影响范围、是否生成新 Round、旧 Round 是否保留。
- Agent 正在运行、历史 Round 查看、失败恢复等状态纳入 UI smoke 覆盖。

### 2.4 Topic 边界与世界模型版本流

- Topic 节点新增问题边界编辑卡，支持字段级编辑。
- 小补充可作为边界备注处理，不强制重建世界模型。
- 核心边界变化会先确认，再生成 World Model vNext / Round N+1，旧轮次保留可回看。

### 2.5 Round 快照与报告链路

- Web 新增 `/api/simulation-rounds` 和 `/api/simulation-snapshot` 代理入口。
- Companion 侧 Round 快照读写、标签、世界模型归一化、Canvas Digest 索引继续纳入 smoke 覆盖。
- 报告交付物动作保留图引用 token，可以从报告预览回跳画布节点。

### 2.6 QA 与发布闸门

- `smoke:simulation` 覆盖推演 P0 主链路、Round 快照、Canvas Digest、报告 fallback 和干预 trace。
- `smoke:simulation:actions` 覆盖 68 项画布动作快照。
- `smoke:simulation:ui` 覆盖推演首页、画布节点、确认卡、历史轮次、报告预览和操作日志。

---

## 3. 升级影响

| 影响面 | 说明 |
|--------|------|
| 推演画布 | 按钮行为更清晰，高风险动作先确认，点击后有可读反馈 |
| 世界模型 | 核心问题边界变化会生成新版世界模型，旧 Round 保留 |
| 历史版本 | Round 快照可读取、可回看、可从历史版本继续 |
| 报告链路 | 报告动作带有可追溯文件和图引用信息 |
| QA | 推演画布主链路具备浏览器级自动化回归 |

---

## 4. 建议验收命令

```bash
pnpm smoke:simulation:actions
pnpm smoke:simulation
XIAOCHUANG_WEB_URL=http://localhost:3100 pnpm smoke:simulation:ui
pnpm --filter web build
pnpm --filter @jlcresearch/companion typecheck
pnpm --filter @jlc/desktop typecheck
pnpm --filter web lint
```

---

## 5. 已知限制

- 推演画布仍不是完整图编辑器，不包含节点/边/变量的完整数据库 CRUD。
- 完整 Operation Executor、撤销系统、多人协作、Web Sandbox、PDF/PPTX 报告导出不属于本版本。
- 桌面正式签名、公证和更新源发布依赖 Apple Developer / Windows 证书与更新源运维凭据。

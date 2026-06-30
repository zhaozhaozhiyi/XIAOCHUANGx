# 写作 / PPT · Beta 收口状态（2026-06-26）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.3 |
| 修订日期 | 2026-06-26 |
| 上级文档 | [p0-writing-ppt-execution-plan.md](./p0-writing-ppt-execution-plan.md)、[writing-module-prd.v2.md](../product/modules/writing-module-prd.v2.md)、[ppt-module-prd.v2.md](../product/modules/ppt-module-prd.v2.md) |
| 本文定位 | 写作 / PPT Beta 收口阶段的实现与验收状态；以当前仓库代码和 2026-06-26 真实 smoke / E2E 为准 |

> 当前口径：写作 / PPT 已统一进入对话壳，默认走基座 Skill 做 AI to UI 需求收敛；真实闭环以 Companion + Runtime + `parts[]` + 工作区落盘为准，不再以 mock 或静态代码存在判定通过。

---

## 1. 当前实现基线

### 写作

- 入口统一为 `/writing/new` / `/writing/[id]`，页面复用 `ChatHome` / `ChatThread`
- 模块默认流程 Skill 为 `skill-writing-base`
- 底栏模板选择默认 `general`，对应主写作 Skill 为 `skill-writing-general`
- 首轮不足时输出 `writing_requirements`
- 首轮充分时直接进入 `writing_requirement_summary`
- 连续流中：
  - 简单任务可 `requirements → summary → deliverables`
  - 复杂任务可 `requirements → summary → writing_outline → deliverables`

### PPT

- 入口统一为 `/ppt/new` / `/ppt/[id]`，页面复用 `ChatHome` / `ChatThread`
- 模块默认流程 Skill 为 `skill-ppt-base`
- 底栏模板选择默认 `pitch-deck`，默认风格模板 Skill 为 `skill-ppt-pitch-deck`
- 首轮不足时输出 `ppt_requirements`
- 首轮充分时直接进入 `ppt_requirement_summary`
- 连续流中默认保留页纲阶段：`requirements → summary → ppt_outline → deliverables`

### Companion / Runtime

- 已支持从 assistant Markdown 中提取：
  - fenced JSON 结构化需求卡
  - 自然语言编号 / 粗体编号追问
  - `writing_requirement_summary` / `ppt_requirement_summary`
  - `writing_outline` / `ppt_outline`
- 已支持需求卡提交后的 `part.patch`、摘要追加、连续流上下文提示
- 已对“用户补充后继续执行”注入模块级 context notes，减少再次卡在摘要 / 页纲确认

---

## 2. 真实验收状态

### 已真实通过（2026-06-24）

| 类别 | 用例 | 结果 |
|------|------|------|
| fixture 校验 | `pnpm qa:writing-ppt-ai-ui` | ✅ 通过 |
| 首轮写作 | F1 / F2 / F3 | ✅ 通过 |
| 首轮 PPT | F4 / F5 / F6 | ✅ 通过 |
| 连续流写作 | T2 / T3 | ✅ 通过 |
| 连续流 PPT | T5 | ✅ 通过 |
| 类型检查 | `pnpm --filter @jlcresearch/companion exec tsc --noEmit --pretty false` | ✅ 通过 |

### 2026-06-26 增量验收

| 类别 | 用例 / 命令 | 结果 |
|------|-------------|------|
| fixture 校验 | `pnpm qa:writing-ppt-ai-ui` | ✅ 通过 |
| 前端类型检查 | `pnpm -C web exec tsc --noEmit --pretty false` | ✅ 通过 |
| Web 构建 | `pnpm -C web build` | ✅ 通过；保留 Turbopack NFT tracing warning |
| T9 大纲 / 页纲编辑 | `pnpm -C web test:e2e chat.spec.ts --project=chromium --grep "persists committed outline"` | ✅ 通过；验证新增、编辑、提交后 `outline.source="user"` / `committed=true` 写入本地会话快照 |
| T10 刷新恢复 | 同上 | ✅ 通过；刷新后恢复用户确认版大纲，未回退到 AI 初稿 |
| repeated parts 防回归 | `scripts/smoke-writing-ppt-ai-ui.mjs` | ✅ 已加检查：`writing_requirements` / `writing_requirement_summary` / `writing_outline` / `ppt_requirements` / `ppt_requirement_summary` / `ppt_outline` 在 flow smoke 中重复出现会失败 |
| Codex 写作 smoke | `pnpm smoke:writing-ppt-ai-ui -- --agent codex --flow T2 --soft` | ✅ 通过；`codex-json` 已将 `Reconnecting...` 预热 / 重连噪声降级为 `tool_progress`，避免可恢复的 `/codex/responses` 405/404 提前结束 Run |

### 本轮已验证的闭环

- 首轮是否追问判断
- 用户补充后继续执行
- 需求摘要卡沉淀
- 写作按需进入大纲或直接成稿
- PPT 进入页纲并继续生成交付物
- 真实文件落盘到 Companion sandbox 工作区

### 本轮确认存在的真实产物

- 写作：
  - `2026年上半年成品油市场分析.md`
  - `2026年上半年中国成品油市场回顾与下半年展望.md`
- PPT：
  - `company-intro-pitch-deck.html`
  - `company-intro-pitch-deck.pptx`

---

## 3. 仍需注意的点

- repeated parts 已从“观察项”收紧为 smoke 失败条件；后续若 T3 / T5 再出现重复 `writing_requirement_summary` / `writing_outline` / `ppt_requirement_summary` / `ppt_outline`，应优先查 `run.events` 合并与历史回放。
- 本轮 2026-06-26 已补跑真实 `--agent codex` T2 flow 并通过；`/codex/responses` 405/404 仍可能作为 CLI 预热 / 重连噪声出现，但不再被 Companion 误判为硬失败。
- 当前“表单补充后继续执行”的稳定主路径仍以二次 follow-up 方式闭环为主，不是所有场景都能回到同一条底层 CLI run 中做原地 clarification resume。

---

## 4. 与旧口径的差异

- 不再使用“写作默认加载 `skill-writing-general`”的旧说法。当前模块默认流程 Skill 是 `skill-writing-base`，`skill-writing-general` 是默认主写作模板 Skill。
- 不再使用“PPT 默认加载 `skill-ppt-pitch-deck`”的旧说法。当前模块默认流程 Skill 是 `skill-ppt-base`，`pitch-deck` 是默认风格模板。
- 不再把写作 / PPT 状态停留在“代码已完成，待验收”的 2026-06-22 静态核对口径。F1-F6、T2/T3/T5 已完成真实 smoke 验收，应作为当前主结论。

---

## 5. 建议后续项

- 将 Codex T2 真实 smoke 纳入后续最小回归；若再次出现硬失败，优先区分 CLI 可恢复重连噪声与真正的 `codex_error`
- 将 T9/T10 的浏览器 E2E 纳入最小 Beta 回归集合
- 若 repeated parts 失败再次出现，优先查 `run.events` 合并与历史回放，而不是继续往 Skill 文案上补规则

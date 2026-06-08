# 写作 / PPT · V1.1 收口状态（2026-06-08）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.1 |
| 修订日期 | 2026-06-08 |
| 上级文档 | [PRD-小窗.md §F-WR-* / §F-PPT-*](../../PRD-小窗.md)、[writing-module-prd.v2.md](./writing-module-prd.v2.md)、[ppt-module-prd.v2.md](./ppt-module-prd.v2.md) |
| 关联 | [memory: ppt-prd-v2-supersedes-v1](file:///C:/Users/74179/.claude/projects/D--XIOACHUANGPRO/memory/ppt-prd-v2-supersedes-v1.md)、[byok-handoff-v1.1-status.md](./byok-handoff-v1.1-status.md) |

> **形态决策（v2 vs v1）**：v2 PRD 已废止「我的 PPT / 我的文稿」二级菜单与
> 各类模板独立路由；写作 / PPT 都压到单一二级菜单 `/writing/new` / `/ppt/new`，
> 模板由对话内 Skill 切换。本次 V1.1 收口仅做 polish，不改架构。

---

## 1. 写作模块 P0 验收（writing-module-prd.v2.md §6）

| # | 项 | 状态 | 证据 |
|---|-----|------|------|
| W1 | 点击「写作」进入对话界面，非表单页 | ✅ | `web/src/app/(main)/writing/page.tsx` 加载 ChatHome；`NAV_MODULES` 单二级菜单 |
| W2 | 新建会话默认加载 `skill-writing-general` | ✅ | `web/src/lib/module-registry.ts:107` `WRITING_TEMPLATE_SKILL.general = WRITING_DEFAULT_SKILL` |
| W3 | 写作对话过程与聊天一致（流式 / parts / 工具） | ✅ | 复用 `useChatSend` / `streamChatCompletion` / parts pipeline，与对话同套 |
| W4 | Agent 产出 `.md` 文件到工作区 | ✅ | `skill-writing-general/SKILL.md §产出规范` 强制 `file_write` 落 Markdown |
| W5 | 交付物卡片可触发 DOCX 导出 | ✅ | `web/src/app/api/writing/export-docx/route.ts` + Pandoc；DeliverablesCard 透传按钮 |
| W6 | 写作会话出现在历史侧栏 | ✅ | `surfaceModuleId: "writing"` 写入 `ChatSessionRecord`；侧栏按 surface 分组（`getGroupedChatHistoryForSurface`） |

**P1 体验优化（writing-module-prd.v2.md §6.2）**：W7 / W8 / W9 由 Pandoc 中文模板承载，**已开**但未做主动验收记录。

---

## 2. PPT 模块 P0 验收（ppt-module-prd.v2.md §7）

| # | 项 | 状态 | 证据 |
|---|-----|------|------|
| P1 | 点击「PPT」进入对话界面，非表单页 | ✅ | `web/src/app/(main)/ppt/page.tsx` 加载 ChatHome |
| P2 | 新建会话默认加载 `skill-ppt-pitch-deck` | ✅ | `module-registry.ts:166` `PPT_SKILL_CATALOG[0].templateId = "pitch-deck"`（默认） |
| P3 | PPT 对话过程与聊天一致 | ✅ | 同 W3 |
| P4 | Agent 产出 `.pptx` / `.html` 文件到工作区 | ✅ | `skill-ppt-html-studio` / `skill-ppt-pptx-generator` / `skill-ppt-pptx`；工作区文件树可见 |
| P5 | 交付物卡片可触发 PPTX 下载 | ✅ | `web/src/app/api/ppt/download/route.ts`；DeliverablesCard 触发 |
| P6 | PPT 会话出现在历史侧栏 | ✅ | 同 W6，`surfaceModuleId: "ppt"` |

**P1 体验优化（ppt-module-prd.v2.md §7.2）**：
- P7 HTML 幻灯片预览：✅ `web/src/components/chat/previews/HtmlSlidesPreview*` 已落地
- P8 多轮迭代修改：✅ 写作/PPT 与对话同 useChatSend，多轮天然支持
- P9 深色/浅色主题：⏸ 由 PPT Skill 自身参数控制；未做收口记录

---

## 3. V1.1 收口期 polish 动作（2026-06-08）

| 动作 | 文件 | 说明 |
|------|------|------|
| ✅ Companion 加 `translate` timeoutProfile | `companion/src/config.ts` / `types.ts` / `routes/runs.ts` / `runs/manager.ts` | translate 上一笔提交（0a22e3b）的契约尾债，写作/PPT polish 顺手补，避免 mvp:verify 端到端长任务回 default 5min 超时 |
| ✅ 删 `MOCK_WRITING_ASSETS` / `MOCK_PPT_ASSETS` / `MOCK_TRANSLATE_HISTORY` | `web/src/lib/module-mock-data.ts` | v2 PRD 废止「我的 X 列表」，三组 mock + `AssetRecord` / `TranslateRecord` 类型零引用 |
| ✅ 删 `AssetListPanel.tsx` + `ModuleContent.tsx` import | `web/src/components/modules/panels/` | 整组件死代码 |
| ✅ 修 `ppt/download/route.ts` Buffer 类型债 | `web/src/app/api/ppt/download/route.ts:104` | `new Uint8Array(bytes)` 包一层；清掉 commit 0a22e3b 提交说明里点过名的 web tsc 历史错 |
| ✅ 写作三个 Skill 补 `task` / `templateId` frontmatter | `skills/skill-writing-{general,official-doc,meeting-minutes}/SKILL.md` | 与 5 个 `skill-wr-*` frontmatter 对齐；为后续 `skills:verify` 反查 templateId 留口 |
| ✅ PRD §12.5.9 `/translate/*` ⬜→✅ | `PRD-小窗.md:3208` | 与 0a22e3b 真实交付状态对齐 |

---

## 4. 故意不做（明确决策）

| 项 | 决策 | 理由 |
|----|------|------|
| 5 个 `skill-wr-*` (policy/topic/industry/macro/sector-data) `version: "0.1"` → `"1.0"` | ⬜ 不动 | 内容是研究领域中心物，升 1.0 需业务侧（研究员）审校；技术 polish 不能代劳。`skills/README.md` 状态表已标"占位"作兜底，等 V1.1+ 内容打磨阶段处理 |
| `skill-writing-official-doc` / `skill-writing-meeting-minutes` 的 `chat-catalog.scope` 加 `"chat"` | ⬜ 不动 | 写作专属体裁不该污染对话 catalog；策略一致：通用基座（`skill-writing-general`）+ 高频解读（5 个 `skill-wr-*`）才进 chat。当前 8 条写作进 chat、3 条非 chat 是有意决策 |
| writing/ppt 各自的 v2 PRD §6/§7 验收表格补 ✅ 列 | ⬜ 不动 | 状态在本文档汇总，PRD 保持设计文档形态，避免每条改动都需要回头改 PRD |

---

## 5. 跨模块联动 / 已知风险

- 写作 / PPT / 翻译三模块共用 `module-chat-config.ts` Surface + `useChatSend` 流程，**任一模块的 Skill 变更都需要确认 chat-catalog scope**（不是机械全进 chat，是按"对话默认是否要看到"决策）
- 写作 5 个扩展 Skill (skill-wr-*) 的内容质量不在 V1.1 收口范围；若研究员实测发现摘要/写作产出质量问题，**优先排查 5 个 Skill 正文与 README 列出的"占位"现状是否吻合**，避免误以为是 runtime 问题
- `module-mock-data.ts` 还保留 `MOCK_KB_DOCUMENTS` / `MOCK_MEETING_HISTORY` / `MOCK_SOURCE_ITEMS` 三组（知识库 / 会议纪要 / 资讯流原型用）。这三组**有引用**，本次 polish 不动；待对应模块进 V1.1+ 实装时再删

---

## 6. typecheck 状态

| 包 | 状态 | 备注 |
|----|------|------|
| `companion` | ✅ tsc 干净 | 加 translate timeoutProfile 后无新错 |
| `apps/desktop` | ✅ tsc 干净 | 本批未触 |
| `packages/runtime-core` | ✅ tsc 干净 | 本批未触 |
| `web` | ✅ tsc **0 错** | `ppt/download Buffer` 历史债已清，commit 0a22e3b 提交说明里点过名 |

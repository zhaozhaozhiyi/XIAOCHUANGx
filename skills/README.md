# 小窗平台 Skill 库

交付时**优先改本目录下的 `SKILL.md` 与 `references/`**，以及并列的 [`prompts/platform/`](../prompts/platform/)（平台身份、模式说明、对话编排指引），无需改 Web/Companion 业务代码（绑定关系见 `web/src/lib/module-registry.ts`；完整约定见 PRD §6.10 **F-RT-003**、**F-RT-008**）。

## 目录约定

```
skills/
├── skill-platform-research-norms/   # 横切：每次 Agent 任务都会注入
├── skill-qa-fast/                   # 对话 · 快速模式
├── skill-qa-deep/                   # 对话 · 深度模式（Agent 内部分支）
└── …
```

每个 Skill 目录至少包含：

- `SKILL.md` — 主指令（必填）
- `references/` — 可选检查清单、示例（会按文件名排序追加到 prompt）

## 环境变量

| 变量 | 说明 |
|------|------|
| `JLC_SKILLS_DIR` | 覆盖 Skill 根目录（绝对路径）；未设置时默认为仓库根目录下的 `skills/` |

Companion / `runtime-core` 在每次 `composePrompt` 时读取磁盘（带进程内缓存，文件变更后重启 Companion 即可生效）。

## 对话模块绑定（MVP v3.0 — 当前唯一深度验收模块）

| 页内模式 | 流程 Skill |
|----------|------------|
| 快速 | `skill-qa-fast` |
| 深度 | `skill-qa-deep` |

横切规范（固定）：`skill-platform-research-norms`

> **PRD v3.2：** 页内仅两档；原「深度思考 / 深度研究」合并为「深度」，子策略写在 `skill-qa-deep` 内由 Agent 决策。API 别名 `mode=research` 映射为 `deep`。

### 对话 Skill Catalog（F-RT-008）

| 文件 | 说明 |
|------|------|
| [`chat-catalog.json`](./chat-catalog.json) | 对话可见 Skill **摘要**（slug + 一行描述）；全文不进 system，由 Agent 按需经 Agent Kit 读取 |
| [`prompts/platform/chat-orchestration.md`](../prompts/platform/chat-orchestration.md) | 混合编排方向：扩展 Skill 与工具 **可选**，Agent 自决 |

架构说明：[web/docs/chat-core-architecture.md](../web/docs/chat-core-architecture.md)。**不**每轮强制 Router 注入 augment Skill。

## PPT 模块（Open Design 批量同步）

| 入口 / templateId | 流程 Skill | 模板包 |
|-------------------|------------|--------|
| 默认 / 新建 | `skill-ppt-deck` | `tpl-ppt-default` |
| `pitch-deck` 等路演模板 | 见 `web/src/lib/module-registry.ts` → `PPT_TEMPLATE_SKILL` | `PPT_TEMPLATE_PACK` |

**从 Open Design 同步：**

```bash
pnpm skills:sync-ppt      # 按 skills/ppt-sync-manifest.json 覆盖同步
pnpm skills:verify-ppt    # 同步 + 校验关键 Skill 可读
```

清单与源路径：`skills/ppt-sync-manifest.json`（参考仓库 `参考项目/open-design`）。  
同步后自动生成 `skills/ppt-registry.generated.md`（仅供对照，注册表以 `module-registry.ts` 为准）。

工具类 Skill（由 `skill-ppt-deck` 按需引用，不单独绑模板）：`skill-ppt-html-studio`、`skill-ppt-pptx`、`skill-ppt-pptx-generator`、`skill-ppt-slides`、`skill-ppt-fidelity-audit`。

## Skill 落地状态表（PRD §6.10.1a）

与 `web/src/lib/module-registry.ts` 对照；**存在** = 仓库含 `skills/<slug>/SKILL.md`。

| 流程 Skill | 模块 | 仓库 | 阶段 | 备注 |
|------------|------|------|------|------|
| `skill-platform-research-norms` | 横切 | ✅ | MVP | 每次 Agent Run 注入 |
| `skill-qa-fast` | 对话 | ✅ | MVP | 快速模式 |
| `skill-qa-deep` | 对话 | ✅ | MVP | 深度模式 |
| `skill-mm-summary` | 会议 | ❌ | V1.1 | 默认通用纪要；见 A-01 |
| `skill-mm-daily-standup` | 会议 | ❌ | V1.1+ | 可选模板 |
| `skill-mm-client-review` | 会议 | ❌ | V1.1+ | 可选模板 |
| `skill-mm-internal-decision` | 会议 | ❌ | V1.1+ | 可选模板 |
| `skill-kb-qa` | 知识库 | ❌ | V1.1 | 库内问答；见 A-03 |
| `skill-wr-policy` | 写作 | ❌ | V1.1 | templateId `policy` |
| `skill-wr-topic` | 写作 | ❌ | V1.1 | `topic` |
| `skill-wr-industry` | 写作 | ❌ | V1.1 | `industry` |
| `skill-wr-macro` | 写作 | ❌ | V1.1 | `macro` |
| `skill-wr-sector-data` | 写作 | ❌ | V1.1 | `sector-data` |
| `skill-ppt-deck` | PPT | ✅ | V1.1 | 默认 deck |
| `skill-ppt-pitch-deck` 等 | PPT | ✅ | V1.1 | 见 `PPT_TEMPLATE_SKILL` |
| `skill-tr-polish` | 翻译 | ❌ | V1.1 可选 | API 主路径，非必须 |

**模板资产包 `tpl-*`：** 会议 `tpl-mm-*` 多数 ❌；PPT `tpl-ppt-*` 随 Open Design 同步部分 ✅。详见各模块子 PRD。

**维护：** 新增注册表 Skill 时同步更新本表与 [设计文档审计 §5](../docs/design-doc-audit-recommendations.md)；验收以 MVP/V1.1 分期为准。

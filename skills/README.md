# 小窗平台 Skill 库

交付时**优先改本目录下的 `SKILL.md` 与 `references/`**，以及并列的 [`prompts/platform/`](../prompts/platform/)（平台身份、模式说明、对话编排指引），无需改 Web/Companion 业务代码（绑定关系见 `web/src/lib/module-registry.ts`；完整约定见 PRD §6.10 **F-RT-003**、**F-RT-008**）。

## 目录约定

```
skills/
├── skill-platform-research-norms/   # 横切：每次 Agent 任务都会注入
├── skill-qa/                        # 对话 · 自动问答基座
├── skill-qa-fast/                   # 对话 · 旧快速模式兼容
├── skill-qa-deep/                   # 对话 · 旧深度模式兼容
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

| 策略 | 流程 Skill |
|------|------------|
| 自动（默认） | `skill-qa` |
| 快速（旧会话/API 兼容） | `skill-qa-fast` |
| 深度（旧会话/API 兼容） | `skill-qa-deep` |

横切规范（固定）：`skill-platform-research-norms`

> **当前决策：** 主界面不再让用户选择快慢；`skill-qa` 根据问题复杂度自行决定轻量回答、分步推理或完整研究。API 别名 `mode=research` 仍映射为 `deep`。

### 对话 Skill Catalog（F-RT-008）

| 文件 | 说明 |
|------|------|
| [`chat-catalog.json`](./chat-catalog.json) | 对话可见 Skill **摘要**（slug + 一行描述）；全文不进 system，由 Agent 按需经 Agent Kit 读取 |
| [`prompts/platform/chat-orchestration.md`](../prompts/platform/chat-orchestration.md) | 混合编排方向：扩展 Skill 与工具 **可选**，Agent 自决 |

架构说明：[docs/technical/chat-core-architecture.md](../docs/technical/chat-core-architecture.md)。**不**每轮强制 Router 注入 augment Skill。

工业制图相关 Skill 也进入 Catalog 摘要，可在对话中按需被 Agent 读取；3D 模块入口仍固定绑定 `skill-industrial-drawing-base`，页面结构与写作 / PPT 保持一致。

## PPT 模块（Open Design 批量同步）

| 入口 / templateId | 流程 Skill | 模板包 |
|-------------------|------------|--------|
| 默认 / 新建 | `skill-ppt-deck` | `tpl-ppt-default` |
| `pitch-deck` 等路演模板 | 见 `web/src/lib/module-registry.ts` → `PPT_TEMPLATE_SKILL` | `PPT_TEMPLATE_PACK` |

> 已新增 `skill-ppt-base` 作为 PPT 需求采集基座，用于 AI to UI 追问、需求摘要确认与模版路由；当前是否绑定为默认入口以 `module-registry.ts` / `module-chat-config.ts` 为准。

**从 Open Design 同步：**

```bash
pnpm skills:sync-ppt      # 按 skills/ppt-sync-manifest.json 覆盖同步
pnpm skills:verify-ppt    # 同步 + 校验关键 Skill 可读
```

清单与源路径：`skills/ppt-sync-manifest.json`（参考仓库 `参考项目/open-design`）。  
同步后自动生成 `skills/ppt-registry.generated.md`（仅供对照，注册表以 `module-registry.ts` 为准）。

工具类 Skill（由 `skill-ppt-deck` 按需引用，不单独绑模板）：`skill-ppt-html-studio`、`skill-ppt-pptx`、`skill-ppt-pptx-generator`、`skill-ppt-slides`、`skill-ppt-fidelity-audit`。

## 3D / 工业制图模块（CADAM 对齐）

| 入口 / 能力 | Skill | 说明 |
|-------------|-------|------|
| 默认 / 新建 | `skill-industrial-drawing-base` | 需求收敛、3D 摘要、结构方案、工作区落盘 |
| 参数化建模 | `skill-industrial-drawing-parametric` | OpenSCAD 可编辑主资产与参数 JSON |
| 预览与导出 | `skill-industrial-drawing-export` | OpenSCAD STL/DXF、工具链状态、fallback 标注 |

3D 模块主资产是 `drawing.scad`，参数索引是 `drawing.parameters.json`，`exports/` 下的 STL / DXF 是派生物。CADAM 对齐规范在各 Skill 的 `references/` 中维护：

- `skill-industrial-drawing-base/references/cadam-core-flow.md`
- `skill-industrial-drawing-base/references/cadam-alignment-checklist.md`
- `skill-industrial-drawing-base/references/questionnaire-protocol.md`
- `skill-industrial-drawing-parametric/references/openscad-authoring-standard.md`
- `skill-industrial-drawing-export/references/openscad-toolchain.md`
- `skill-industrial-drawing-export/references/export-quality-checklist.md`

校验命令：

```bash
pnpm skills:verify-3d
pnpm smoke:3d:toolchain
pnpm smoke:3d:parameters
pnpm smoke:3d:dxf
pnpm smoke:3d:claude
```

## Skill 落地状态表（PRD §6.10.1a）

与 `web/src/lib/module-registry.ts` 对照；**存在** = 仓库含 `skills/<slug>/SKILL.md`。

| 流程 Skill | 模块 | 仓库 | 阶段 | 备注 |
|------------|------|------|------|------|
| `skill-platform-research-norms` | 横切 | ✅ | MVP | 每次 Agent Run 注入 |
| `skill-qa` | 对话 | ✅ | MVP | 自动问答基座 |
| `skill-qa-fast` | 对话 | ✅ | MVP | 旧快速模式兼容 |
| `skill-qa-deep` | 对话 | ✅ | MVP | 旧深度模式兼容 |
| `skill-mm-summary` | 会议 | ✅ | V1.1 | 默认通用纪要（5 区块结构）；2026-06-06 占位；见 A-01 |
| `skill-mm-daily-standup` | 会议 | ✅ | V1.1+ | 站会/周会速记；2026-06-06 占位 |
| `skill-mm-client-review` | 会议 | ✅ | V1.1+ | 客户沟通纪要；2026-06-06 占位 |
| `skill-mm-internal-decision` | 会议 | ✅ | V1.1+ | 内部研讨/投决；2026-06-06 占位 |
| `skill-kb-qa` | 知识库 | ✅ | V1.1 | 库内 RAG 问答；2026-06-06 占位；见 A-03 |
| `skill-wr-policy` | 写作 | ✅ | V1.1 | templateId `policy` 政策解读；2026-06-06 占位 |
| `skill-wr-topic` | 写作 | ✅ | V1.1 | `topic` 专题研究；2026-06-06 占位 |
| `skill-wr-industry` | 写作 | ✅ | V1.1 | `industry` 行业研究；2026-06-06 占位 |
| `skill-wr-macro` | 写作 | ✅ | V1.1 | `macro` 宏观数据解读；2026-06-06 占位 |
| `skill-wr-sector-data` | 写作 | ✅ | V1.1 | `sector-data` 行业数据点评；2026-06-06 占位 |
| `skill-writing-base` | 写作 | ✅ | P1 | 需求采集基座；AI to UI 追问、摘要确认、写作 Skill 路由 |
| `skill-ppt-deck` | PPT | ✅ | V1.1 | 默认 deck |
| `skill-ppt-base` | PPT | ✅ | P1 | 需求采集基座；AI to UI 追问、摘要确认、模版路由 |
| `skill-ppt-pitch-deck` 等 | PPT | ✅ | V1.1 | 见 `PPT_TEMPLATE_SKILL` |
| `skill-tr-text` | 翻译 | ✅ | V1.1 | templateId `text` 文本翻译（默认）；2026-06-06 落地 |
| `skill-tr-doc` | 翻译 | ✅ | V1.1 | `doc` 文档翻译；2026-06-06 落地 |
| `skill-tr-polish` | 翻译 | ✅ | V1.1 | `polish` 译文润色；2026-06-06 落地 |
| `skill-industrial-drawing-base` | 工业制图 | ✅ | P1 | 3D 模块基座；收敛需求、生成参数化 CAD 文件并落盘到工作区 |
| `skill-industrial-drawing-parametric` | 工业制图 | ✅ | P1 | 参数化 OpenSCAD / CAD Artifact 生成规则，借鉴 CADAM |
| `skill-industrial-drawing-export` | 工业制图 | ✅ | P1 | 预览检查、DXF/SVG/PDF/STL 导出与工作区组织 |

**模板资产包 `tpl-*`：** 会议 `tpl-mm-*` 多数 ❌；PPT `tpl-ppt-*` 随 Open Design 同步部分 ✅。详见各模块子 PRD。

**维护：** 新增注册表 Skill 时同步更新本表与 [设计文档审计 §5](../docs/audits/design-doc-audit-recommendations.md)；验收以 MVP/V1.1 分期为准。

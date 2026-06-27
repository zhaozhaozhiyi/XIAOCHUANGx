# 平台 Prompt 库

与 `skills/` 并列，供 `composeSystemPrompt` 在每次 Run 前加载。交付时改本目录即可调整平台身份与通用工作流，无需发版 Web。

| 变量 | 默认 |
|------|------|
| `JLC_PROMPTS_DIR` | 仓库根 `prompts/` |

子目录 `platform/` 见 PRD §6.10 F-RT-003、F-RT-008。**MVP v3.0** 对话模块验收含 `skill-qa-*`、`mode-hints`、`chat-orchestration.md`（混合编排方向指引）。

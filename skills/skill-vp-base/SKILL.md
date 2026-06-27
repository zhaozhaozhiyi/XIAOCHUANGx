---
slug: skill-vp-base
module: video
task: base
version: "0.1"
status: p0-ready
name: skill-vp-base
description: 视频模块默认基座 Skill：收敛主题、受众、时长、画幅与风格，P0 默认交接到 skill-vp-web-video-presentation，生成可预览、可录屏的网页视频项目；Remotion/自动 MP4 属于 P1，不在 P0 虚构承诺。
---

# 视频制作 · 基座流程

## 目标

把用户的视频制作需求收敛成可执行的 video brief，并在 P0 默认交接到
`skill-vp-web-video-presentation`，产出可预览、可录屏的网页视频项目。

本 Skill 是视频模块的默认基座。当前阶段的首期闭环是：需求收敛 →
口播稿 / outline → `presentation/` 网页视频项目 → `?reel=1` 预览 →
可选 `?auto=1` 录屏。Remotion 渲染工具、`vp_*` 结构化卡片与 MP4
下载能力属于 P1，不作为 P0 承诺。

## 适用场景

- 产品介绍片、研究结论讲解片、活动回顾、路演短片
- 用户希望从报告、PPT 或自然语言 brief 生成视频脚本
- 用户希望生成“像视频一样播放”的网页演示，并通过录屏得到成片
- 用户明确要求 Remotion / 自动 MP4 时，说明该能力属于 P1；P0 可先交付网页视频项目

## 非范围

- 不做传统时间轴剪辑器
- 不做 text-to-video 模型画面生成
- 不声称已渲染 MP4，除非 `exports/*.mp4` 已真实写入工作区
- P0 不调用 `remotion.*` 工具，不承诺自动 MP4
- 不内置素材库、BGM 库、ASR；TTS 仅作为 `skill-vp-web-video-presentation`
  的可选能力

## 需求收敛

先判断是否具备进入视频生产的最低信息：

1. 主题
2. 使用场景
3. 目标受众
4. 时长
5. 画幅

如果信息不足，只追问缺失项。若信息已经足够，直接整理为视频需求摘要，
并进入 P0 网页视频生产路径。

## 当前交付要求

P0 默认交付：

- `script.md`：口播稿
- `outline.md`：章节与 step 开发计划
- `presentation/`：Vite + React + TypeScript 网页视频项目
- 预览入口：`localhost:<port>/?reel=1`
- 录屏入口：`localhost:<port>/?auto=1`

不要把“计划生成”表述成“已经生成”。只有文件真实写入工作区后，才能
告诉用户对应文件已经生成。不要把 `?reel=1` 说成最终导出的 MP4；
它是预览与验收入口。最终 P0 成片来自系统录屏 / OBS / 浏览器录制。

## P0 路由规则

需求确认后，默认交接到 `skill-vp-web-video-presentation`。交接内容应包含：

1. 主题、受众、时长、画幅、使用场景
2. 内容来源：用户原文 / 附件摘要 / 自然语言 brief
3. 风格约束：正式、科技、发布会、研究解读、产品演示等
4. 是否需要口播音频；若未明确，先按无音频网页预览推进
5. 工作区目标结构：`article.md`、`script.md`、`outline.md`、`presentation/`

当用户明确要求“自动生成 MP4 / Remotion / 可编程渲染”时：

- 先说明当前 P0 默认交付网页视频项目与录屏路径；
- 如果用户接受，仍交接到 `skill-vp-web-video-presentation`；
- 如果用户坚持自动 MP4，则标记为 P1 能力请求，不虚构渲染结果。

## 输出格式

建议输出稳定结构：

```markdown
# 视频需求摘要

- 标题：
- 受众：
- 时长：
- 画幅：
- 风格：
- 生产路径：Web Video Presentation（P0）
- 预览方式：?reel=1
- 录屏方式：?auto=1

## 交接给 skill-vp-web-video-presentation
- 内容来源：
- 口播稿要求：
- outline 密度：
- 素材约束：
- 开发模式：
```

## 与后续能力的关系

完整实现后，本 Skill 应按 PRD 逐步支持：

- P0：复用现有 RequirementsCard / Markdown / DeliverablesCard
- P0：必要时使用 Markdown 表示 `video_requirements`、需求摘要与 outline
- P1：再补 `vp_storyboard`、`vp_project_ready`、`vp_render_status`
- P1：再补 `vp_capability_missing` 与 Remotion 能力探测

在这些 `parts[]` 类型落地前，使用普通 Markdown 摘要和工作区文件承载结果。

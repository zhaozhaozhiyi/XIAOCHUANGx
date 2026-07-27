---
slug: skill-vp-screenplay-canvas
version: "0.1"
kind: workflow
scope: ["chat","video"]
summary: "屏幕叙事生产：从源材料生成 cue 驱动的 screenplay-canvas studio，支持 ?preview=1 预览、?voice=1 配音检查、?capture=1 录屏路径"
skillDependencies: []
capabilityRequirements: []
assetPolicy: {"references":true,"scripts":true,"templates":true,"assets":false}
module: video
task: screenplay-canvas
status: experimental
name: screenplay-canvas
description: 把文章、讲稿、教程或产品材料，做成 cue 驱动的 16:9 屏幕叙事项目。产物不是传统 PPT，而是一个可预览、可配音、可录屏的 narrative studio。适用场景：讲解视频、产品演示、动态课程、路演讲述、视觉说故事。触发词包括 screenplay、canvas、screen narrative、cue sheet、beat sheet、录屏型视频项目。
---

# Screenplay Canvas

把一份内容做成可导演、可录屏的网页叙事项目。这个 skill 不把结果叫
`presentation`，而是把它当成一个 `studio/`：里面有 sequence、cue、
beat、voice pass 和 capture pass。

## 什么时候用

- 用户要的是“像视频一样”的网页讲述，而不是静态 PPT
- 用户有文章、口播稿、教程、产品说明，要做成可录屏的成片路径
- 用户希望先看网页预览，再决定是否合成配音
- 用户希望视觉呈现更像“分镜舞台”而不是传统演示

## 核心产物

- `source.md`：源材料或用户原文
- `direction.md`：叙事方向、受众、节奏、视觉约束
- `beats.md`：sequence 切分与 cue 说明
- `studio/`：Vite + React + TypeScript 项目
- `studio/audio-cues.json`：从 cue 文本抽出的配音清单
- `studio/public/voice/...`：可选生成的音频

## 运行模式

- 默认：制作态，手动推进 cue
- `?preview=1`：自动预览态，适合快速验收节奏
- `?voice=1`：配音检查态，进入 cue 自动播音频
- `?capture=1`：录屏态，一镜到底自动推进

## 工作流

Phase 1  Source map
把用户输入整理为 `source.md` 和 `direction.md`

Phase 2  Beat sheet
产出 `beats.md`，定义 sequence、cue、画面焦点、素材缺口
需要时读 [references/BEAT-SHEET.md](references/BEAT-SHEET.md)

Phase 3  Studio scaffold
运行 `scripts/scaffold.sh` 创建 `studio/`
主题选择和运行模式见 [references/CANVAS-RUNTIME.md](references/CANVAS-RUNTIME.md)

Phase 4  Scene assembly
按 sequence 实现 `studio/src/sequences/*`
每个 sequence 以 `cues.ts` 为节拍真相源

Phase 5  Voice pass
需要配音时先生成 `audio-cues.json`，再跑 voice runner
见 [references/VOICE-PASS.md](references/VOICE-PASS.md)

## 硬规则

1. 不要把它实现成传统 slide deck。
2. `cues.ts` 是 cue 数量与音频切片的唯一真相源。
3. 每个 beat 应该只承载一个视觉聚焦点。
4. 录屏态必须能在 `?capture=1` 下自动推进。
5. 控制 UI 默认隐藏，录屏画面保持干净。

## 文件导航

- Beat 结构：读 [references/BEAT-SHEET.md](references/BEAT-SHEET.md)
- 运行模式与主题：读 [references/CANVAS-RUNTIME.md](references/CANVAS-RUNTIME.md)
- 配音与 provider 约定：读 [references/VOICE-PASS.md](references/VOICE-PASS.md)
- 主题选择：读 [references/THEMES.md](references/THEMES.md)

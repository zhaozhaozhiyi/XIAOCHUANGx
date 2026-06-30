# 视频模块 PRD

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.0（草案） |
| 日期 | 2026-06-26 |
| 状态 | 立项中（2026-06-27 调整：P0 改为 Web Video Presentation 网页视频闭环；Remotion MP4 渲染后置到 P1） |
| 关联 | PRD-小窗 §F-VIDEO（待补章节）；[chat-core-architecture.md](../../technical/chat-core-architecture.md)；[ppt-module-prd.v2.md](./ppt-module-prd.v2.md)；[writing-module-prd.v2.md](./writing-module-prd.v2.md)；[industrial-drawing-module-prd.v1.md](./industrial-drawing-module-prd.v1.md) |
| 模块代号 | `video` |
| 技能前缀 | `skill-vp-*`（vp = video presentation） |
| 渲染框架 | **P0：Web Video Presentation**（React 网页舞台 → 预览 / 录屏）；**P1：Remotion 4.x**（React → MP4，可编程视频） |
| 责任面 | web / api / companion / skills / 模板包 |

---

## 0. 文档说明

### 0.1 编写目的

把"生成视频"作为与**对话 / 写作 / PPT** 同级的一级业务模块纳入小窗，并约定它的：

- 模块边界与非范围；
- 默认 Skill 矩阵与编排协议；
- 工作区主资产 / 派生物规范；
- Companion 工具契约与 BFF 接口；
- UI 规格与 `parts[]` 数据契约；
- 验收标准与失败模式；
- 风险、度量与开放问题。

让产品 / 设计 / 研发 / 测试 / 业务方在进入实现前能对齐到**实现可写、验收可测、风险可控**的程度。

### 0.2 与主 PRD 的关系

- 本文件是模块级 PRD，**比 PRD-小窗 §F-VIDEO 更细**；
- PRD-小窗的"当前范围"表与版本规划应在本 PRD 收口后，回填一行视频模块；
- 任何与主 PRD 冲突的地方，以 PRD-小窗主线为准（如默认工作区形态、桌面壳能力边界）。

### 0.3 阅读约定

- "**主资产**"指可被人 / AI 反复编辑的源文件，"**派生物**"指由主资产生成的最终产物；
- 文中 `parts[]`、`skill-*`、`projectId`、`workspaceKind` 等术语沿用 PRD-小窗 §1.3；
- 所有命令示例假设 Companion 主机有可用 Node 18+，未显式说明的版本以 Remotion 当时稳定大版本为准。

### 0.4 2026-06-27 需求调整：P0 先做网页视频

原 PRD 以 Remotion MP4 渲染作为首期闭环。结合当前仓库能力与
`skill-vp-web-video-presentation` 已落地的脚手架能力，视频模块 P0 调整为：

> **P0 先交付网页视频项目生成 + Reel 预览 + Auto 录屏路径；Remotion 自动 MP4 渲染进入 P1。**

调整后的 P0 不再要求 Companion 具备 `remotion.*` 工具、不要求 BFF 提供
`/api/video/render`，也不承诺自动生成 MP4。P0 的真实交付物是工作区内
可独立运行的 `presentation/` 网页视频项目：

```text
视频/<会话>/
├── article.md          # 原文 / 用户素材文本（可选）
├── script.md           # 口播稿
├── outline.md          # 章节 + step 开发计划
└── presentation/       # Vite + React + TS 网页视频项目
```

运行态：

| URL | P0 用途 | 行为 |
|---|---|---|
| `localhost:<port>/` | 制作 / 验章 | 手动点击或键盘推进 |
| `localhost:<port>/?reel=1` | 用户预览 | 自动播放，可暂停、点击快进、点进度条跳转 |
| `localhost:<port>/?audio=1` | 配音检查 | 每 step 播音频，手动推进 |
| `localhost:<port>/?auto=1` | 录屏出片 | 音频结束自动推进，一镜到底录屏 |

Remotion 相关章节在本 PRD 中保留为 **P1 目标设计**。后续可以并存为：

```ts
engine: "web-video-presentation" | "remotion"
```

---

## 1. 概述

### 1.1 目标

与写作、PPT 模块完全一致的范式：**视频 = 对话 + 视频 Skill + 工作区主资产 + 可验收输出**。

P0 范式：

> **视频 = 对话 + `skill-vp-base` + `skill-vp-web-video-presentation` + `presentation/` 网页视频项目 + 预览 / 录屏路径。**

P1 范式：

> **视频 = 对话 + 视频 Skill + Remotion 项目 + 自动渲染 MP4。**

视频模块复用聊天模块的运行时（Companion + CLI、流式 `parts[]`、工具调用、交付物）；差异点仅在三层：

1. 加载的 Skill 不同：默认基座 `skill-vp-base`，P0 路由到 `skill-vp-web-video-presentation`；
2. P0 Agent 产出的**主资产**是一个可编辑的 **Web Video Presentation 项目**（`script.md`、`outline.md`、`presentation/`），用户通过网页预览和录屏得到视频；
3. P1 再引入 **Remotion 项目**（React 源码 + `props.json` + `assets/`）与 `.mp4` 自动渲染派生物；
4. Remotion 阶段再在 Companion 端新增"调用 Remotion 渲染管线"的工具能力（`remotion render` / `remotion still` / `remotion studio`）。

### 1.2 设计原则

- **与 PPT 模式对称** —— 写作 / PPT / 视频共享同一架构：点击 → 新建会话 → 加载默认基座 Skill → 收敛需求 → 选模板 → 出大纲 → 出主资产 → 渲染派生物。
- **不建独立 UI** —— 交互、组件、API 全部复用聊天模块，**不做时间轴编辑器**、不做轨道剪辑器、不做"我的视频"管理页。
- **主资产即工作区文件** —— P0 产出 `presentation/` 网页视频项目；P1 产出 `remotion/` 项目源码。派生物（录屏 MP4 或 Remotion MP4）均可从主资产重复生成。
- **基座 Skill 管流程，生产 Skill 管实现** —— `skill-vp-base` 负责需求采集、AI to UI 追问、需求摘要、分镜 / outline 确认、生产路径选择；P0 的 `skill-vp-web-video-presentation` 负责口播稿、章节 step、网页舞台、预览和录屏运行态；P1 的各 Remotion 模板 Skill 负责镜头节奏、视觉风格、动画语言与 Remotion 组件库。
- **对话式不分步** —— 不做"主题 → 分镜 → 配音 → 渲染"的步骤向导，全部走对话流，分镜脚本以 `parts[]` 卡片形态确认。
- **预览是 P0 主线，渲染是 P1 工具** —— P0 前端/浏览器打开 `?reel=1` 即可验收；P1 Remotion 渲染由 Companion 通过子进程调用，前端只看见"已开始 / 进度 / 已完成 / 失败 + 日志摘要"。
- **可独立运行** —— P0 工作区里落盘的 `presentation/` 必须可用 `npm install && npm run dev` 独立运行；P1 工作区里落盘的 Remotion 项目必须可用 `npm install && npx remotion render` 在本机直接跑通，**不依赖小窗运行时**。

### 1.3 非范围（明确不做）

| 项 | 原因 |
|----|------|
| 视频模板选择页 | 默认加载 `skill-vp-base`，再由其调用或切换到具体模板 Skill |
| 时间轴 / 轨道剪辑器 | 视频模块是"AI 生成 + 模板驱动"的可编程视频，不做 NLE |
| 视频素材库 / 媒资管理页 | 素材即工作区 `assets/` 下的文件，无需另起列表 |
| 步骤向导（主题→分镜→配音→渲染） | 遵循对话式交互，所有阶段以 `parts[]` 卡片呈现 |
| 前端写死整张需求表单 | 需求问题由 `skill-vp-base` 动态生成，前端只负责渲染 |
| 我的视频管理列表 | 工作区文件即视频 |
| 快速 / 深度模式切换 | 视频是深度产出任务，不需要两档模式 |
| 实时多人共编 | Web Sandbox 大版本再评估 |
| 端上播放器二次开发 | MP4 用系统默认播放器或浏览器原生 `<video>` 即可 |
| 在云端为用户跑 Remotion 渲染 | 0.x 桌面壳模式天然有本机能力；Web Sandbox 大版本再迁 Lambda |
| 视频转写 / 视频→文本（ASR） | 与本模块方向相反，归到对话或翻译模块未来评估 |
| AI 生成视频画面（Sora / Pika 类） | 本模块产出**模板驱动的合成视频**，不做 text-to-video 模型集成；可在 `assets/` 接入用户外部生成的素材 |

> 与"非范围"配套的设计承诺：**所有上述能力，未来若要做，都不会破坏当前主资产协议**。`remotion/` + `props.json` 是稳定底座，模板 Skill 可演进。

---

## 2. 目标用户与核心场景

### 2.1 目标用户

| 用户画像 | 描述 | 视频模块对其的价值 |
|----------|------|--------------------|
| **研究员 / 分析师** | 写完研究报告后需要做对外讲解 | 一键把报告关键结论生成讲解片，省去自己做动效 |
| **产品 / 市场** | 经常做产品介绍、宣传片、阶段汇报 | 模板化、可迭代，文案改了立刻重渲，不用回头找设计 |
| **管理者 / 业务方** | 内部传达、季度汇报、对外路演 | 替代"我口述给设计师再返工 N 轮"的链路 |
| **小窗内部团队** | 做产品宣传片、版本说明视频 | 与现有写作 / PPT 链路打通，复用研究产出 |

明确**不**针对的用户：

- 专业视频剪辑师（他们已有 Premiere / DaVinci）；
- 短视频 UGC 创作者（他们的工具链是剪映 / CapCut）；
- 需要逐帧动效控制的动画师（他们用 AE）。

### 2.2 核心场景

| # | 场景 | 触发输入示例 | 期望产出 |
|---|------|--------------|----------|
| S1 | 产品介绍片 | "做个 60s 金联创小窗产品介绍片，面向客户高层" | P0：网页视频项目 + 预览/录屏路径；P1：1080p MP4 |
| S2 | 研究结论可视化 | "把这份原油市场月报变成 90s 讲解片" | P0：数据故事网页视频；P1：自动渲染 MP4 |
| S3 | 活动回顾 / 周报 | "用 30s 视频回顾本周交付" | 时间线推进 + 关键事件卡 + 数据摘要 |
| S4 | 路演宣传片 | "30s 高密度宣传片，9:16 竖屏" | 紧凑节奏 + 视觉冲击 + CTA |
| S5 | 单人讲述型 | "我有一段录音，做成有字幕条 + 切片镜头的视频" | 字幕条 + B-roll 切片，对齐音频时间码 |
| S6 | 仅产出分镜脚本 | "先给我分镜，不渲染" | P0：仅 `script.md` / `outline.md`，不进入工程生成 |

S1 / S2 为首期重点验证场景；S3 ~ S6 由后续模板 Skill 增量覆盖（见 §4.4）。

### 2.3 反场景（用户来错地方时如何应对）

| 用户输入 | 当前模块响应 |
|----------|--------------|
| "帮我剪掉视频里 0:12~0:18 这段" | 视频模块不接，提示"小窗暂不提供视频剪辑能力" |
| "用 AI 生成一段企鹅跳舞的画面" | 视频模块不接，提示"模块产出的是模板驱动的合成视频，不做 text-to-video；可上传生成好的素材到工作区后由模板调用" |
| "我要给视频加多语言配音" | v1 不接，归入 P1（V18 TTS） |

反场景由 `skill-vp-base` 在判断阶段识别并 graceful 回退（不要强行进入分镜生成）。

---

## 3. 用户流程

### 3.1 主流程

```
点击「视频」→ 新建视频会话，加载默认基座 Skill (skill-vp-base)
            → 用户描述需求（"帮我做一个 60 秒的产品介绍视频…"）
            → 基座 Skill 判断信息是否充足
              ├── 不足：返回结构化问题 / clarification 给前端渲染
              │       用户填写并提交
              └── 充足：直接生成需求摘要 (vp_requirement_summary) 等待确认
            → 基座 Skill 进入分镜 / outline 阶段
              （首轮直接生成需等待确认；表单连续流则可直接交付）
            → P0：基座 Skill 选择并交接 `skill-vp-web-video-presentation`
            → Web Video Skill 在工作区落盘网页视频项目
                ├── article.md
                ├── script.md
                ├── outline.md
                └── presentation/
            → 用户打开 `presentation` 的 `?reel=1` 自动预览
            → 可选合成音频后，用 `?auto=1` 一镜到底录屏
            → 用户追加修改（改稿、改章节、换主题、换素材）
            → P1：如选择 Remotion 引擎，再落盘 remotion/ 并自动渲染 MP4
```

关键差异：

- P0 视频会话经过 **需求 → 摘要 → 分镜 / outline → 网页主资产 → 预览 / 录屏**；
- **分镜 / outline 是视频独有的信息结构**，P0 可先复用 `video_outline` / Markdown 卡承载，P1 再升级为可编辑 `vp_storyboard`；
- **渲染状态卡**（`vp_render_status`）只属于 P1 Remotion 自动渲染，不阻塞 P0。

### 3.2 会话状态机

```
                       ┌──────────────────┐
                       │      idle        │  ← 新建会话即此态
                       └─────────┬────────┘
                                 │ 用户提需求
                                 ▼
                       ┌──────────────────┐
                       │ collecting_brief │  ← 多轮 requirements / clarification
                       └─────────┬────────┘
                                 │ 信息充分
                                 ▼
                       ┌──────────────────┐
                       │ awaiting_summary │  ← vp_requirement_summary
                       └─────────┬────────┘
                                 │ 用户确认（或连续流自动通过）
                                 ▼
                       ┌──────────────────┐
                       │ storyboarding    │  ← P0：script/outline；P1：vp_storyboard
                       └─────────┬────────┘
                                 │ 分镜确认
                                 ▼
                       ┌──────────────────┐
                       │ scaffolding      │  ← P0 落盘 presentation/ 项目
                       └─────────┬────────┘
                                 │ 主资产就绪
                                 ▼
                       ┌──────────────────┐
                       │ preview_ready    │  ← ?reel=1 可验收
                       └─────────┬────────┘
                                 │ 可选音频 / 录屏
                                 ▼
                       ┌──────────────────┐
                       │ recording_ready  │  ← ?auto=1 录屏路径
                       └─────────┬────────┘
                                 │ P1 自动 MP4 渲染
                                 ▼
                       ┌──────────────────┐
                       │ rendering        │  ← vp_render_status (running)
                       └─────────┬────────┘
                            ┌────┴────┐
                            ▼         ▼
                       ┌────────┐ ┌──────────┐
                       │ ready  │ │ failed   │
                       └───┬────┘ └──────────┘
                           │ 用户继续修改
                           ▼
                       ┌──────────────────┐
                       │ revising         │  ← P0：改 script/outline/chapter；P1：改 props.json
                       └──────────────────┘
```

状态以 `chat_session.metadata.video_state` 记录。P0 用它标识 `preview_ready`
/ `recording_ready`；P1 再用它决定是否屏蔽"触发渲染"按钮（例如
`rendering` 中按钮变为"取消渲染"）。

### 3.3 典型迭代回路（多轮修改）

| 用户输入 | P0 行为 | P1 行为 |
|----------|----------|----------------|
| "把第 3 镜的文案改成 …" | 改 `script.md` / 对应章节 `narrations.ts` 和画面 | 改 `props.json` 中对应 shot 文案 |
| "换个主色，用品牌蓝" | 换主题 tokens 或调 `src/styles/tokens.css` | 改 `props.json.theme.primary` |
| "把第 5 镜删了" | 改 `outline.md`、删除对应 step / chapter 注册 | 改 `props.json.shots` 数组 + 必要时改 `scenes/` 引用 |
| "换成 9:16 竖屏" | P0 暂不作为默认，需新主题/舞台适配 | 改 `remotion.config.ts` 与 `Composition` 的 `width/height` |
| "把模板换成 data-story" | P0 仍在 web-video 项目内重做章节表达 | 切到 `skill-vp-data-story`，迁移可兼容字段（详见 §6.7） |
| "只改字体不重渲" | 改 tokens 后刷新预览 | 改 `props.json.theme.font`，由用户决定是否重渲 |

设计要求：P0 每类修改都应尽量局部改 `script.md` / `outline.md` /
`chapters/`；P1 每类修改都应尽量只动 `props.json` 或局部 `scenes/`。
这是视频模块成本可控的关键。

---

## 4. 信息架构与导航

### 4.1 一级导航

```
导航
├── 对话
├── 写作
├── PPT
└── 视频     ← 一级导航仅一项，点击直接进入视频对话
```

与 PPT 一致：一级导航仅一项，不展开子菜单。

### 4.2 路由

| 路径 | 说明 |
|------|------|
| `/video` | 重定向到 `/video/new` |
| `/video/new` | 渲染聊天组件，预置 `skill-vp-base` |
| `/video/[id]` | 视频会话详情（与 `/ppt/[id]` 同构） |

**不引入：** `/video/templates`、`/video/from-script`、`/video/mine`、`/video/render-queue` 等子路由。

### 4.3 模块注册

```ts
// web/src/lib/module-registry.ts （示意）
video: {
  component: ChatModuleContent,
  defaultSkill: 'skill-vp-base',
  workspaceKind: 'local_bound' | 'sandbox',
  capabilities: ['remotion-render'],
  fallbackOnMissingCapability: {
    mode: 'soft',         // 'soft' = 进入对话但禁用渲染；'hard' = 屏蔽入口
    notice: '当前 Companion 缺少 Remotion 渲染依赖，请先安装 Node 18+ / ffmpeg。'
  },
}
```

未声明该能力的 Companion 节点，前端"视频"导航**不隐藏**，但在 `/video/new` 顶部展示能力缺失提示卡（见 §7.1）。

---

## 5. Skill 设计

### 5.1 双层模式

视频 Skill 分两层，与 PPT 模式对齐：

- **默认基座 Skill**：负责流程控制（需求采集、摘要、分镜确认、模板路由）；
- **具体模板 Skill**：负责镜头风格、动画语言、Remotion 组件库选型。

### 5.2 默认基座 Skill：`skill-vp-base`

职责（与 `skill-ppt-base` / `skill-writing-base` 同构）：

- 接收用户初始需求；
- 判断是否具备进入视频生产的最低信息（**主题 / 场景 / 受众 / 时长**，外加视频特有的 **视觉风格、画幅、是否需要配音**）；
- 信息不足时返回结构化问题或 clarification；
- 接收答案 → 输出需求摘要（`vp_requirement_summary`）；
- 输出分镜脚本 / 网页视频 outline，等待用户确认或在连续流中直接进入交付；
- P0 选择并交接到 `skill-vp-web-video-presentation`；
- P1 才选择并交接到一个 Remotion 模板 Skill；
- **不直接生成具体工程代码**，只负责流程和生产路径选择。

#### 5.2.1 信息充分性判断标准

主题、场景、受众、时长 + 画幅这五项满足时即可进入摘要阶段；视觉风格、配音、BGM 缺失可使用默认假设并在摘要中显式标注。

| 字段 | 必填 | 默认假设 |
|------|------|----------|
| 主题 | 是 | — |
| 场景 / 用途 | 是 | — |
| 受众 | 是 | — |
| 时长 | 是 | 60s |
| 画幅 | 是 | 16:9 |
| 视觉风格 | 否 | 由模板 Skill 决定 |
| 配音 | 否 | 无配音 + 字幕条 |
| BGM | 否 | 无 BGM |
| 品牌色 / Logo | 否 | 小窗品牌色 + 不显示 Logo |
| 参考素材 | 否 | 由模板 Skill 自带占位 |

#### 5.2.2 首轮回归样例（与 PPT F4 / F5 / F6 对齐）

| 编号 | 输入特征 | 期望行为 |
|------|----------|----------|
| VF4 | `做一个 60s 的小窗产品介绍视频，面向客户高层，重点突出研究与交付能力。` | 信息充分；不追问；直接生成需求摘要 |
| VF5 | `帮我做个介绍视频。` | 信息不足；只追问场景 / 受众 / 时长 / 画幅 等缺失项 |
| VF6 | `基于刚才的研究报告做一个 90s 解读片，面向投资人，9:16 竖屏。` | 信息充分；进入摘要或分镜阶段 |

#### 5.2.3 连续流固定回归样例

| 编号 | 输入与补充 | 期望行为 |
|------|------------|----------|
| VT5 | 先说 `帮我做个介绍视频。`，后补充 `场景：售前；受众：客户高层；时长：60s；画幅：16:9；风格：专业商务` | 输出需求摘要，再输出分镜 / outline，并交接到 `skill-vp-web-video-presentation` 完成网页视频项目落盘；P1 才触发 Remotion 渲染 |

### 5.3 P0 生产 Skill：`skill-vp-web-video-presentation`

P0 默认生产路径。原因：

- 已具备可执行脚手架：Vite + React + TypeScript + 16:9 舞台；
- 适合知识讲解、产品介绍、研究解读、动态 PPT 式视频；
- 同时具备用户预览态 `?reel=1` 与最终录屏态 `?auto=1`；
- 不依赖 Companion 渲染能力、ffmpeg、Chromium 远程控制，也不阻塞 MP4 自动导出后续演进。

职责：

- 基于用户原文 / 口播稿生成 `script.md` 与 `outline.md`；
- 通过主题系统选择视觉气质；
- 脚手架落盘 `presentation/`；
- 按章节生成 React 视觉实现与 `narrations.ts`；
- 提供 `?reel=1` 自动预览、`?audio=1` 配音检查、`?auto=1` 录屏出片路径；
- 可选合成每 step 音频（MiniMax / OpenAI / 自定义 TTS provider）。

### 5.4 P1 默认 Remotion 模板 Skill：`skill-vp-product-intro`

作为默认风格模板。原因：

- 产品介绍片是 B2B / 内部宣传最常用形态；
- 镜头节奏稳定（封面 → 痛点 → 方案 → 优势 → 数据 → CTA → 落版），可模板化；
- 适合作为"开箱即可跑"的样例工程。

P1 职责：

- 基于 `vp_storyboard` 落盘完整 `remotion/` 项目；
- 维护一套标准 React 组件库（`Cover` / `KPI` / `BulletList` / `QuoteCard` / `SubtitleBar` / `Outro`）；
- 暴露 `props.json` schema（见 §7.2）；
- 提供 1080p / 30fps 默认渲染参数；
- 在用户切换到其它模板时声明哪些字段可迁移、哪些需重填（见 §6.5）。

### 5.5 Skill 矩阵（规划）

| skill slug | 场景 | 优先级 | 备注 |
|-----------|------|--------|------|
| `skill-vp-base` | 基座 / 流程编排（默认） | P0 | 首期交付 |
| `skill-vp-web-video-presentation` | 网页视频项目 / Reel 预览 / Auto 录屏 | P0 | 首期默认生产路径 |
| `skill-vp-product-intro` | Remotion 产品介绍片 / 默认模板 | P1 | MP4 自动渲染阶段 |
| `skill-vp-data-story` | 数据故事 / 研究结论可视化（柱图、折线、KPI 滚动） | P1 | 与研究 / 写作链路打通 |
| `skill-vp-event-recap` | 活动回顾 / 阶段汇报 | P1 | |
| `skill-vp-pitch-trailer` | 路演宣传片 / 30s 高密度 | P2 | |
| `skill-vp-kol-talking-head` | 单人讲述型短视频（字幕条 + 切片镜头） | P2 | 与音频 / ASR 解耦 |
| `skill-vp-research-explainer` | 研究报告解读片（与"对话 / 写作"链路打通） | P2 | 触发入口可由写作模块"一键讲解" |
| `skill-vp-storyboard-only` | 仅产出分镜脚本，不进入 Remotion 工程 | P2 | 低成本 demo |

> P0 首期交付集为 `skill-vp-base` + `skill-vp-web-video-presentation`。
> Remotion 模板与 MP4 自动渲染进入 P1。

### 5.6 AI to UI 需求采集协议

与 PPT 模块完全对齐。`skill-vp-base` 不写死表单，返回结构化问题由前端动态渲染：

- 问题类型沿用：`text` / `textarea` / `single_select` / `multi_select` / `number` / `date` / `time` / `datetime` / `file_pick` / `file_upload`；
- 视频模块高频复用的字段建议（基座 Skill 自主决定何时下发）：
  - `time_long`（时长，下拉：15s / 30s / 60s / 90s / 120s / 自定义）；
  - `aspect_ratio`（画幅：16:9 / 9:16 / 1:1 / 4:5）；
  - `voiceover`（配音：无 / 字幕条 / 真人 / TTS，TTS 在 P1 引入）；
  - `bgm`（背景音乐：无 / 默认 / 上传，上传走 `file_upload`）；
  - `brand_kit`（品牌色 + Logo，`file_upload` + 文本输入）；
  - `tone`（基调：稳重 / 活泼 / 简洁 / 故事化）。
- P0 可先复用现有 RequirementsCard，并使用 `video_requirements` 或 Markdown
  追问承载；P1 再升级为 `vp_requirements` 类型 `part`。

### 5.7 生产路径 / 模板路由

需求确认后，`skill-vp-base` 按下表选择一个主模板 Skill：

| 用户信号 | 路由到 |
|----------|--------|
| P0 默认：文章 / 口播 / 知识讲解 / 产品介绍 / 动态 PPT / 录屏式视频 | `skill-vp-web-video-presentation` |
| P1：明确要求自动 MP4 / Remotion / 可编程渲染，且能力探测通过 | `skill-vp-product-intro` |
| 报告解读 / 数据为主 / 投资人沟通 | P0 仍走 `web-video-presentation`；P1 可路由到 `skill-vp-data-story` |
| 路演 / 30s 高密度宣传 | P0 仍走 `web-video-presentation`；P1 可路由到 `skill-vp-pitch-trailer` |
| 活动回顾 / 周报 / 阶段汇报 | P0 仍走 `web-video-presentation`；P1 可路由到 `skill-vp-event-recap` |
| 不确定 | `skill-vp-web-video-presentation` |

只选一个主模板。用户也可在对话中通过 Skill 选择器手动切换。

---

## 6. 主资产与派生物规范

### 6.1 P0 工作区目录布局（Web Video Presentation）

```
<projectId>/<sessionId>/
├── article.md              # 可选：用户原文 / 粘贴材料 / 摘要素材
├── script.md               # ★ 口播稿：决定叙事节拍
├── outline.md              # ★ 章节 + step 开发计划：决定网页实现范围
└── presentation/           # ★ 主资产：网页视频项目
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── Stage.tsx
    │   │   ├── ReelPlayer.tsx
    │   │   └── ...
    │   ├── chapters/
    │   │   └── <NN>-<id>/
    │   │       ├── <Chapter>.tsx
    │   │       ├── <Chapter>.css
    │   │       └── narrations.ts
    │   └── registry/chapters.ts
    ├── public/audio/       # 可选：TTS 合成音频，每 step 一个 mp3
    └── audio-segments.json # 可选：音频合成清单
```

P0 派生物不强制落盘。用户通过以下路径验收 / 出片：

- `?reel=1`：自动播放预览；
- `?auto=1`：音频同步自动推进，用户用系统录屏或 OBS 录制；
- 后续如接入浏览器录制工具，可把录屏 MP4 落入 `exports/`，但不作为 P0
  必须项。

### 6.2 P1 工作区目录布局（Remotion）

```
<projectId>/<sessionId>/
├── video-script.md         # 分镜脚本可读副本（次资产，给人看 / 走版本控制）
├── remotion/               # ★ 主资产：Remotion 项目
│   ├── package.json
│   ├── tsconfig.json
│   ├── remotion.config.ts
│   ├── props.json          # ★ 单一可信源：所有内容 / 样式 / 时长
│   ├── src/
│   │   ├── index.ts        # registerRoot(Root)
│   │   ├── Root.tsx        # Composition 注册
│   │   ├── Composition.tsx # 主合成，按 props.shots 渲染各 Scene
│   │   ├── scenes/         # 分镜组件，命名与 storyboard.shots.id 对齐
│   │   │   ├── Scene01_Cover.tsx
│   │   │   ├── Scene02_Pain.tsx
│   │   │   └── ...
│   │   ├── components/     # 复用组件（KPI、ChartLine、SubtitleBar、Outro）
│   │   └── theme.ts        # 从 props.theme 派生设计 token
│   └── public/             # 静态素材（图、字体、Logo、BGM）
└── exports/                # 派生物
    ├── 2026-06-26T1530-v1.mp4
    ├── 2026-06-26T1530-v1.cover.png   # 抽帧封面
    └── 2026-06-26T1530-v1.log          # 渲染日志摘要
```

### 6.3 P0 主资产协议

1. **`script.md` 是叙事可信源**：口播顺序、口播语言、叙事节拍以它为准；
2. **`outline.md` 是开发计划可信源**：章节、step、信息池、素材清单以它为准；
3. **`narrations.ts` 是 step 数与音频合成可信源**：每章数组长度必须等于该章 step 数；
4. **章节组件必须是 `step` 的纯函数**：同一章同时服务手动制作态、`?reel=1` 预览态、`?auto=1` 录屏态；
5. **可独立运行**：用户 `cd presentation && npm install && npm run dev` 必须能打开项目；
6. **预览优先**：第一章做完后必须先给 `?reel=1` 让用户确认视觉气质和节奏。

### 6.4 P1 主资产协议（Remotion）

1. **`props.json` 是单一可信源**：文案、时长、品牌色、是否显示字幕条、画幅，全部在这里；
2. **AI 多轮修改时只改 `props.json` 与 `scenes/`**，不重写整个项目；
3. **用户也可手改 `props.json`**，下次渲染立即生效；
4. **`Composition.tsx` 通过 `getInputProps()` 读取 `props.json`**；
5. **可独立运行**：用户 `cd remotion && npm i && npx remotion render` 必须能在干净机器上跑通；
6. **scenes/ 命名对齐 storyboard**：`Scene{二位序号}_{语义}.tsx`，方便分镜变动时的局部修改。

### 6.5 派生物协议

1. **命名格式**：`<sessionId-短码>-<ISO 时间戳>-v<n>.mp4`，每次渲染 v 自增，**不覆盖历史**；
2. **同时落 3 个文件**：MP4 + cover.png + render.log；
3. **保留策略**：默认保留全部历史；当 `exports/` 超过 2 GB 时由 Companion 后台提示用户清理（不自动删除）；
4. **不进入主资产校验**：派生物可被用户随意删除，不影响 `remotion/` 与下次渲染。

### 6.6 P1 默认渲染参数

| 参数 | 默认值 | 可改位置 |
|------|--------|----------|
| 分辨率 | 1920×1080 | `remotion.config.ts` / `props.json.canvas` |
| 帧率 | 30 fps | 同上 |
| 编码 | H.264 (libx264) | `remotion.config.ts` |
| 容器 | mp4 | 同上 |
| 音频 | AAC 128kbps | 同上 |
| 并发 worker | min(4, CPU/2) | Companion 渲染时指定 |
| 颜色空间 | bt709 | 默认 |
| 比特率 | CRF 18 | 可改 |

P1 阶段允许提供"4K / 60fps / ProRes"高级档（V14 之后）。

### 6.7 P1 模板切换时的字段迁移

切换模板会调用目标模板 Skill 的 `migrateProps(oldProps)`，返回新 `props.json`。最小可迁移字段集：

| 字段 | 强制可迁 |
|------|----------|
| `meta.title` | ✅ |
| `meta.duration` | ✅ |
| `meta.aspectRatio` | ✅ |
| `theme.primary` / `theme.secondary` / `theme.font` | ✅ |
| `brand.logoSrc` | ✅ |
| `shots[].text` | ⚠️ 尽量保留，但 shots 结构由新模板重排 |
| `shots[].voiceover` | ✅ |
| `assets/*` | ✅（直接复制 public/） |

不可保留字段（强制重生成）：`scenes/*.tsx`、`shots[].animation`、模板独有 props。

---

## 7. 数据契约

### 7.1 `parts[]` 卡片类型

P0 为降低实现成本，优先复用现有 `RequirementsCard`、`RequirementSummaryCard`、
`Outline` / Markdown、`DeliverablesCard`。视频专属 `vp_*` 卡片作为 P1
增强，不阻塞 P0 网页视频闭环。

P0 建议：

| 阶段 | P0 承载方式 | 说明 |
|------|-------------|------|
| 结构化追问 | 复用 requirements 卡或普通澄清 | 字段同 §5.6 |
| 需求摘要 | Markdown 摘要 / requirement summary | 不要求新增 `vp_requirement_summary` |
| 分镜 / outline | Markdown + `outline.md` 文件 | 不要求可视化逐镜编辑 |
| 工程就绪 | DeliverablesCard / artifact | 指向 `presentation/` |
| 预览 / 录屏说明 | Markdown | 给出 `?reel=1` / `?auto=1` |

P1 再补视频专属卡片：

| 阶段 | `part.kind` | 包裹标记（流式文本中） |
|------|-------------|------------------------|
| 结构化追问 | `vp_requirements` | —（直接 JSON） |
| 需求摘要 | `vp_requirement_summary` | `<!--JLC:VP_REQUIREMENT_SUMMARY_START-->` / `END` |
| 分镜脚本 | `vp_storyboard` | `<!--JLC:VP_STORYBOARD_START-->` / `END` |
| 渲染状态 | `vp_render_status` | `<!--JLC:VP_RENDER_STATUS_START-->` / `END` |
| 工程落盘通告 | `vp_project_ready` | `<!--JLC:VP_PROJECT_READY_START-->` / `END` |
| 能力缺失提示 | `vp_capability_missing` | —（前端固定卡） |

### 7.2 P0 网页视频工程元数据（建议）

P0 可选维护一个轻量 `video-meta.json`，但不是必须项。最小可由
`script.md`、`outline.md`、`presentation/src/registry/chapters.ts` 推导。

```jsonc
{
  "engine": "web-video-presentation",
  "title": "金联创小窗 · 产品介绍",
  "durationEstimateSec": 60,
  "aspectRatio": "16:9",
  "theme": "midnight-press",
  "previewUrl": "http://localhost:5174/?reel=1",
  "recordingUrl": "http://localhost:5174/?auto=1"
}
```

### 7.3 P1 `props.json` Schema（v1）

```jsonc
{
  "$schema": "https://jlc.example.com/schemas/vp-props.v1.json",
  "meta": {
    "title": "金联创小窗 · 产品介绍",
    "subtitle": "面向客户高层的售前介绍",
    "duration": 60,                  // 秒
    "aspectRatio": "16:9",           // 16:9 | 9:16 | 1:1 | 4:5
    "tone": "professional"           // professional | playful | minimal | story
  },
  "canvas": {
    "width": 1920,
    "height": 1080,
    "fps": 30
  },
  "theme": {
    "primary": "#0E3A8A",
    "secondary": "#F2B705",
    "background": "#0B1426",
    "foreground": "#FFFFFF",
    "font": "Inter",
    "logoSrc": "public/brand/logo.svg"
  },
  "brand": {
    "name": "金联创",
    "showLogo": true,
    "logoPosition": "top-left"
  },
  "audio": {
    "bgmSrc": null,
    "bgmVolume": 0.5,
    "voiceoverTrackSrc": null
  },
  "subtitles": {
    "enabled": true,
    "style": "bar"                   // bar | bottom | karaoke
  },
  "shots": [
    {
      "id": 1,
      "scene": "Cover",
      "durationFrames": 90,          // 3s @ 30fps
      "text": "金联创智能研究平台",
      "subtitle": "面向未来办公场景",
      "voiceover": "",
      "animation": "slide-in",
      "assets": []
    },
    {
      "id": 2,
      "scene": "Pain",
      "durationFrames": 180,
      "text": "研究 / 写作 / 汇报，散落在多个工具之间",
      "voiceover": "研究员每天都在不同工具间反复切换…",
      "animation": "fade",
      "assets": []
    }
    // ...
  ]
}
```

校验：

- `shots` 总 `durationFrames / canvas.fps` 必须等于 `meta.duration`（误差 ≤ 1 帧）；
- 所有 `assets[]` 中引用的相对路径必须存在于 `public/`；
- `theme.primary` 与 `theme.background` 对比度比 ≥ 4.5:1（WCAG AA）；不达标时由模板 Skill 自动微调或提示用户。

### 7.4 P1 `vp_storyboard` 卡片 Schema

```jsonc
{
  "kind": "vp_storyboard",
  "version": 1,
  "editable": true,
  "shots": [
    {
      "id": 1,
      "title": "封面",
      "duration_s": 3,
      "visual": "深色背景 + 品牌主色高光，左上 Logo，主标题居中",
      "text": "金联创智能研究平台",
      "voiceover": "",
      "notes": "镜头由远拉近"
    },
    {
      "id": 2,
      "title": "痛点",
      "duration_s": 6,
      "visual": "三栏图标 + 文字，依次浮入",
      "text": "研究、写作、汇报散落在多个工具",
      "voiceover": "研究员每天在不同工具间反复切换…",
      "notes": ""
    }
  ],
  "totalDurationSec": 60,
  "warnings": []                     // 例如时长超出、对比度不足
}
```

前端渲染该卡时支持：**逐镜编辑文案 / 调整时长 / 删除某镜 / 追加一镜**，提交后回写 `props.json`（不重新跑 Skill）。

### 7.5 P1 `vp_render_status` 卡片 Schema

```jsonc
{
  "kind": "vp_render_status",
  "renderId": "rd_2026-06-26T15-30-12_a4f",
  "status": "running",               // queued | running | done | failed | cancelled
  "outPath": "exports/2026-06-26T1530-v1.mp4",
  "progress": 0.48,
  "framesRendered": 720,
  "framesTotal": 1500,
  "etaSeconds": 72,
  "concurrency": 4,
  "startedAt": "2026-06-26T15:30:12+08:00",
  "finishedAt": null,
  "errorCode": null,                 // RENDER_TIMEOUT | FFMPEG_MISSING | DEPS_MISSING | NETWORK | UNKNOWN
  "logTail": [
    "Bundled in 4.2s",
    "Rendering 1500 frames at 30 fps...",
    "Frames 720/1500"
  ]
}
```

### 7.6 P1 `vp_capability_missing` 卡片

```jsonc
{
  "kind": "vp_capability_missing",
  "missing": ["ffmpeg"],
  "node": { "ok": true, "version": "v20.11.1" },
  "chromium": { "ok": true, "version": "126.0.6478.61" },
  "ffmpeg": { "ok": false, "version": null },
  "installHints": [
    {
      "os": "macos",
      "command": "brew install ffmpeg"
    },
    {
      "os": "windows",
      "command": "winget install Gyan.FFmpeg"
    }
  ]
}
```

---

## 8. Companion 工具契约（P1 Remotion）

P0 Web Video Presentation 不要求新增 Companion `remotion.*` 工具。P0 只需要
Agent 能在工作区落盘文件、运行普通 Node/Vite 项目，并在需要时启动 dev server。
以下 Remotion 工具契约保留为 P1。

Companion 新增 `remotion` 命名空间。所有工具走 Companion 既有的 `POST /companion/tools/<tool>` 调用约定。

| 工具 | 用途 |
|------|------|
| `remotion.detect` | 探测主机依赖（Node / ffmpeg / Chromium / 可用磁盘） |
| `remotion.scaffold` | 在工作区创建 Remotion 项目骨架 |
| `remotion.write_props` | 写 / 覆盖 `props.json` |
| `remotion.write_scene` | 写 / 更新一个 `scenes/Scene*.tsx` |
| `remotion.render` | 调 `npx remotion render`，输出 MP4 到 `exports/` |
| `remotion.cancel_render` | 取消正在进行的渲染（按 `renderId`） |
| `remotion.still` | 调 `remotion still` 抽帧出封面 |
| `remotion.preview_url` | （Beta）启动 `remotion studio` 本机预览端口 |

### 8.1 `remotion.detect`

```http
POST /companion/tools/remotion.detect
→ 200 {
  "ok": true,
  "node":     { "ok": true, "version": "v20.11.1" },
  "ffmpeg":   { "ok": true, "version": "6.1.1" },
  "chromium": { "ok": true, "version": "126.0.6478.61" },
  "disk":     { "freeMB": 32480 },
  "remotion": { "installedLocally": false, "willInstallOnFirstUse": true }
}
```

启动时执行一次，结果缓存到会话开始；用户点"重新检测"时刷新。

### 8.2 `remotion.scaffold`

```http
POST /companion/tools/remotion.scaffold
{
  "sessionId": "sess_xxx",
  "template": "skill-vp-product-intro/scaffold@v1",
  "targetDir": "remotion"
}
→ 200 {
  "files": [
    "remotion/package.json",
    "remotion/src/Root.tsx",
    "remotion/src/Composition.tsx",
    "remotion/src/scenes/Scene01_Cover.tsx",
    "..."
  ],
  "elapsedMs": 280
}
```

骨架模板包随模板 Skill 一起分发，存放在 `skills/skill-vp-product-intro/scaffold/`。

### 8.3 `remotion.render`

```http
POST /companion/tools/remotion.render
{
  "sessionId": "sess_xxx",
  "entry": "remotion/src/index.ts",
  "compositionId": "Main",
  "outPath": "exports/2026-06-26T1530-v1.mp4",
  "propsPath": "remotion/props.json",
  "concurrency": 4,
  "timeoutSec": 900
}
→ 202 { "renderId": "rd_2026-06-26T15-30-12_a4f" }
```

进度通过既有的 `parts[]` 流推送 `vp_render_status`（见 §7.4）。

错误码：

| `errorCode` | 触发条件 | 用户感知 |
|------------|----------|----------|
| `DEPS_MISSING` | `remotion.detect` 不通过 | 卡片切回 `vp_capability_missing` |
| `FFMPEG_MISSING` | 渲染时 ffmpeg 不存在 | 同上 |
| `PROPS_INVALID` | `props.json` 校验失败 | 卡片提示错误字段，附 schema 路径 |
| `COMPOSITION_NOT_FOUND` | `compositionId` 不存在 | 提示分镜未落盘 |
| `RENDER_TIMEOUT` | 超过 `timeoutSec` | 自动取消，提示用户增加超时或降低分辨率 |
| `OUT_OF_DISK` | 磁盘 < 1 GB | 拒绝渲染并提示 |
| `CANCELLED` | 收到 `cancel_render` | status → cancelled |
| `UNKNOWN` | 其他 | 附 `logTail` |

### 8.4 `remotion.cancel_render`

```http
POST /companion/tools/remotion.cancel_render
{ "renderId": "rd_..." }
→ 200 { "ok": true, "cancelled": true }
```

实现：向 Remotion CLI 子进程发送 `SIGINT`；2 秒未退出再 `SIGKILL`。

---

## 9. BFF 接口契约（P1 Remotion）

P0 不要求新增 `/api/video/render` 等接口。P0 的预览通过本地 dev server
打开 `presentation/`，下载/交付以工作区文件为准。以下 BFF 接口保留为 P1。

### 9.1 `POST /api/video/render`

| 字段 | 必填 | 说明 |
|------|------|------|
| `sessionId` | ✅ | 视频会话 ID |
| `compositionId` | ❌ | 默认 `Main` |
| `concurrency` | ❌ | 默认由 Companion 决定 |

返回：

```json
{ "renderId": "rd_...", "status": "queued" }
```

BFF 只做透传 + 鉴权；具体执行在 Companion。

### 9.2 `POST /api/video/cancel-render`

字段：`{ renderId }`，返回：`{ ok, cancelled }`。

### 9.3 `POST /api/video/download`

字段：`{ filePath }`（必须在 `exports/` 下且属于当前 `projectId`）；返回文件流。与 `/api/ppt/download` 同构。

### 9.4 `GET /api/video/capabilities`

返回当前绑定 Companion 的 Remotion 依赖探测结果（§7.5）。

### 9.5 `GET /api/video/sessions/[id]/renders`

列出历史渲染记录（基于 `exports/` 目录扫描 + 文件元数据），用于在交付物卡片下拉显示。

---

## 10. UI 规格

### 10.1 入口

- 点击「视频」一级导航 → 新建会话，加载 `skill-vp-base`；
- P0 不做 Remotion 能力探测；`/video/new` 直接进入对话。
- P1 若 Companion 能力探测显示 `remotion: false`，则在 `/video/new` 顶部展示 `vp_capability_missing` 卡，列出缺失依赖与一键复制安装命令，但**不阻断**进入对话（用户仍可生成网页视频项目或分镜，只是自动 MP4 渲染不可用）。

### 10.2 视频对话页

与聊天页面使用**同一组件**。差异点：

| 差异项 | 聊天 | PPT | 视频 |
|--------|------|-----|------|
| 默认流程 Skill | `skill-qa` | `skill-ppt-base` | `skill-vp-base` |
| 问答策略 | 自动判断 | 无 | 无 |
| 主要交付物 | 多样 | `.pptx` / `.html` | P0：`presentation/` 网页视频项目；P1：`remotion/` + `.mp4` |
| 首轮流程 | 普通问答 | 需求 → 摘要 → 页纲 → 生成 | P0：需求 → 摘要 → outline → 网页项目落盘 → 预览 / 录屏 |
| 独有卡片 | — | `ppt_outline` | P0 复用通用卡；P1 增加 `vp_storyboard`、`vp_render_status` 等 |
| 导出 | 无 | 「下载 PPTX」 | P0：「打开预览」/「打开目录」/「录屏指引」；P1：「预览 MP4」/「下载 MP4」 |
| 输入区附加按钮 | 无 | 无 | P0 无；P1 为「触发渲染」 |

### 10.3 交付物卡片

P0 视频模块的 `DeliverablesCard` 显示网页视频项目：

```
┌──────────────────────────────────────────────┐
│ 🎬 presentation/  (网页视频项目，主资产)      │
│    预览：?reel=1 · 录屏：?auto=1              │
│    [打开目录] [复制路径] [打开预览]            │
├──────────────────────────────────────────────┤
│ 📄 script.md     口播稿                       │
│ 📄 outline.md    章节与 step 计划              │
└──────────────────────────────────────────────┘
```

P1 Remotion 模块的 `DeliverablesCard` 显示**两类条目**：

```
┌──────────────────────────────────────────────┐
│ 🎬 remotion/  (Remotion 项目，主资产)         │
│    最近更新：2026-06-26 15:25                 │
│    [打开目录] [复制路径] [触发渲染]            │
├──────────────────────────────────────────────┤
│ 📼 exports/2026-06-26T1530-v1.mp4             │
│    1080p · 60s · 12.4 MB                     │
│    [预览] [下载] [复制路径]                    │
│    ▾ 历史渲染 (3)                             │
└──────────────────────────────────────────────┘
```

- **预览：** Web 端用 `<video controls preload="metadata">` 直接播放（不下载完整文件）；
- **下载：** 走 BFF `POST /api/video/download` 返回文件流；
- **触发渲染：** 在 `props.json` 已落盘但用户改了文案后，重新触发 `remotion.render`；
- **历史渲染：** 列出该会话所有 `exports/*.mp4`，每条都能预览 / 下载；
- **在 Remotion Studio 中打开：** 仅桌面壳模式，调 Companion 启动 `npx remotion studio --port=...` 并由壳层打开浏览器窗口（Desktop Beta 选做）。

### 10.4 P1 渲染状态卡（`vp_render_status`）

渲染是分钟级耗时任务，必须有状态卡：

```
┌──────────────────────────────────────────────┐
│ 🎞 正在渲染：2026-06-26T1530-v1.mp4           │
│ ┌────────────────────────────────────┐        │
│ │██████████░░░░░░░░░░░  48 / 100      │  48%  │
│ └────────────────────────────────────┘        │
│ 帧 720/1500 · 预计剩余 1m 12s · 4 worker      │
│ [取消渲染] [查看日志]                          │
└──────────────────────────────────────────────┘
```

- 进度条与帧数动画使用 spring，避免抖动；
- `failed` 状态下卡片背景变为提示色，附 `errorCode` 与 `logTail` 折叠区；
- `done` 状态下自动滚动到对应 `exports/*.mp4` 交付物条目。

### 10.5 P1 分镜编辑卡（`vp_storyboard`）

```
┌──────────────────────────────────────────────┐
│ 分镜脚本（共 7 镜 · 60s）          [全部确认] │
├──────────────────────────────────────────────┤
│ ① 封面  3s                              [✏]  │
│    文案：金联创智能研究平台                   │
│    画面：深色背景 + 品牌主色高光               │
│    [删除] [复制] [移动]                      │
├──────────────────────────────────────────────┤
│ ② 痛点  6s                              [✏]  │
│    文案：研究 / 写作 / 汇报散落在多个工具…    │
│    ...                                       │
└──────────────────────────────────────────────┘
              [+ 追加一镜]
```

行内编辑后即时回写 `props.json` 并标记会话为 `revising`；用户可选择"保存后立即重渲"或"仅保存"。

### 10.6 历史侧栏

与 PPT / 写作一致：会话出现在历史侧栏中，标题取 `meta.title` 或首轮用户输入摘要。卡片右上角小角标显示当前状态（rendering / failed / ready）。

### 10.7 国际化

- 模板 Skill 内置中英文文案；
- `props.json.meta.locale` 控制字幕条 / 落版语言；
- v1 仅承诺中文准；英文可读但不做强保证。

### 10.8 可访问性

- 渲染状态卡支持屏幕阅读器的 `aria-live="polite"`；
- 预览播放器支持键盘 Space / 方向键；
- 颜色对比 ≥ AA。

---

## 11. 数据流

### 11.1 P0 创建 / 迭代（Web Video Presentation）

```
用户："做个 60s 产品介绍片"
  → skill-vp-base 判定信息不足 → 返回 requirements / 澄清卡
  → 用户填表 → 后端组装 brief
  → skill-vp-base 输出需求摘要（首轮）/ 跳过（连续流）
  → skill-vp-base 路由到 skill-vp-web-video-presentation
  → skill-vp-web-video-presentation：
     1. 生成 / 更新 article.md
     2. 生成 script.md
     3. 生成 outline.md
     4. 脚手架落盘 presentation/
     5. 逐章实现 chapters/<NN>-<id>/
     6. 注册 chapters.ts 与 narrations.ts
  → Companion 把工作区文件变更 emit 给前端 → 交付物卡更新
  → 输出预览与录屏路径：
     - npm run dev
     - /?reel=1
     - /?auto=1
```

### 11.2 P0 预览 / 录屏

```
用户点击「打开预览」或复制 URL
  → Web / 桌面壳打开 presentation dev server 的 /?reel=1
  → 用户自动播放验收，可暂停 / 快进 / 跳转
  → 用户反馈修改
  → Agent 修改 script.md / outline.md / chapter code / narrations.ts
  → 再次打开 /?reel=1 验收
  → 可选合成音频
  → 打开 /?auto=1，按 Space，系统录屏或 OBS 录制
```

### 11.3 P1 渲染

```
用户点「触发渲染」 / Agent 自动发起
  → Web: POST /api/video/render { sessionId, compositionId? }
  → BFF: 透传到 Companion: POST /companion/tools/remotion.render
  → Companion: spawn npx remotion render ...
              ├── 通过 stdout 解析进度（Remotion CLI 有标准进度行）
              └── 流式发送 vp_render_status part 给 Web
  → 渲染完成 → emit 工作区变更 → exports/*.mp4 出现在交付物
  → 失败：vp_render_status.status = failed + logTail + errorCode
```

### 11.4 P1 下载

```
用户点「下载 MP4」
  → Web: POST /api/video/download { filePath }
  → BFF: 校验 filePath 必须在 <projectId>/<sessionId>/exports/ 下
  → BFF: 返回文件流
  → Web: 触发浏览器下载
```

### 11.5 P1 取消

```
用户在渲染中点「取消渲染」
  → Web: POST /api/video/cancel-render { renderId }
  → Companion: SIGINT → 2s 未退 → SIGKILL
  → 推送 vp_render_status.status = cancelled
  → 清理不完整的 MP4（保留 .log 便于排查）
```

---

## 12. 非功能需求

### 12.1 性能

| 指标 | 目标 | 备注 |
|------|------|------|
| P0 从用户确认 outline 到 `presentation/` 脚手架完成 | ≤ 30s（不含模型写章节耗时） | 主要是 Vite scaffold + npm install |
| P0 `?reel=1` 首屏打开 | ≤ 3s | 本地 dev server 已启动 |
| P0 章节切换响应 | ≤ 100ms | React 本地渲染 |
| P0 主资产单会话磁盘占用 | ≤ 80 MB（不含 node_modules / 外部素材） | scaffold 应保持精简 |
| P1 60s / 1080p / 30fps 视频在 8 核机渲染 | ≤ 3 分钟 | 端到端，含 ffmpeg |
| P1 60s / 1080p / 30fps 视频在 4 核机渲染 | ≤ 6 分钟 | 同上 |
| P1 `vp_render_status` 进度刷新延迟 | ≤ 1s | 解析 Remotion CLI stdout |
| P1 `props.json` 修改后重渲与首次渲染的耗时差 | ≤ 10%（不能更慢） | 复用缓存 / bundle |

### 12.2 可靠性

- **P0 可重放**：相同 `script.md` / `outline.md` / `presentation/` 在本地重复打开应展示同一视觉结果；
- **P0 游标安全**：章节数量或 step 数变化后，不应因本地持久化 cursor 落到不存在 step；
- **P1 幂等**：相同 `props.json` 与 `compositionId` 重复渲染产物可复现（帧级 hash 在 95% 帧上一致；时间戳 / 随机数除外）；
- **P1 断点**：Companion 进程崩溃后，进行中的渲染状态会被标记 `failed: errorCode=COMPANION_DOWN`，前端不会无限 spinning；
- **P1 并发**：单 Companion 内默认串行渲染；同时收到第二个渲染任务时返回 `queued` 并提示用户。

### 12.3 资源占用

- **P0 磁盘**：`presentation/` 不含 `node_modules` 时应保持轻量；`node_modules` 可删除后重装；
- **P1 磁盘**：`exports/` 超过 2 GB 时提示清理；项目级超过 10 GB 强制提示；
- **P1 内存**：渲染期间 Companion 子进程内存上限通过 `--max-old-space-size` 控制（默认 4096 MB）；
- **P1 CPU**：默认 worker 数 = `min(4, CPU/2)`，避免与桌面壳 / IDE 争抢。

### 12.4 安全

- **P0 依赖**：`presentation/package.json` 使用脚手架默认依赖；Agent 不应随意引入无关重依赖；
- **P0 代码注入**：章节代码不得使用 `eval`、`Function`、`child_process`、`fs` 等危险 API；
- **P1 沙箱**：渲染子进程的工作目录严格限定在 `<projectId>/<sessionId>/remotion/`，不能访问父级文件；
- **P1 依赖**：scaffold 出的 `package.json` 仅允许引入白名单依赖（默认 `remotion` 系列 + 字体 / 图标库），AI 不得自由 `pnpm add`；
- **P1 代码注入**：模板 Skill 写出的 `scenes/*.tsx` 必须经过静态扫描，禁止 `eval`、`Function`、`child_process`、`fs` 模块；
- **P1 文件下载**：BFF `/api/video/download` 强校验路径必须在该 `sessionId` 的 `exports/` 下，禁止任意路径读盘；
- **凭证**：P0 可选 TTS 如涉及外部 provider，凭证走 BYOK；P1 引入更多 TTS / 云渲染时同样与 PPT / 写作模块统一。

### 12.5 隐私

- 用户上传到 `presentation/public/` 或 P1 `assets/` 的素材仅本机存储（local_bound 工作区）；
- P1 渲染日志 `logTail` 不上报到云端，仅前端展示；
- Sandbox 工作区下，P0 可生成项目但不保证本地预览；P1 渲染暂不开放（参考 §1.3 非范围）。

### 12.6 可观测性

- P0 记录网页项目 scaffold / preview 打开 / auto 录屏路径打开等事件；
- P1 Companion 渲染子进程日志按渲染 ID 落盘：`exports/<id>.log`；
- P1 每次渲染发起 / 完成 / 失败上报一条 telemetry（指标见 §16），不含用户内容；
- 首轮跑通后接入既有 `pnpm smoke:*` 体系：P0 `pnpm smoke:video:web-presentation`，P1 `pnpm smoke:video:render`。

### 12.7 升级与兼容

- P0 `presentation/` 结构随 `skill-vp-web-video-presentation` 模板升级；已存在项目不强制迁移；
- P1 `props.json` 第一行 `"$schema"` 携带版本；
- P1 后续模板包升级时，提供 `migrateProps(oldProps)`；
- Remotion 大版本升级时，scaffold 模板包同步升级，**已存在的 remotion/ 项目不强制升级**（用户手动迁移）。

---

## 13. 失败模式与降级

| 失败模式 | 触发 | 用户感知 | 系统降级 |
|----------|------|----------|----------|
| Companion 无 ffmpeg | `remotion.detect` | `vp_capability_missing` 卡 + 安装提示 | 允许进入对话，禁用"触发渲染" |
| Companion 无 Node | `remotion.detect` | 同上 | 同上 |
| `props.json` schema 不合法 | `remotion.render` 启动前 | 错误卡 + schema 路径 | 不渲染，回到 `revising` 态 |
| 渲染超时 | 子进程 > timeoutSec | `vp_render_status.status=failed` + 建议降低分辨率 | 自动 cancel |
| 磁盘不足 | < 1 GB | 拒绝渲染 + 提示清理 | 不渲染 |
| 渲染产出 0 帧 | Remotion 输出失败 | `errorCode=UNKNOWN` + 完整日志 | 不显示交付物 |
| 模板 Skill 不存在（已切换） | 切换到 P1 模板但未发布 | 自动降级到 `skill-vp-product-intro` + 提示 | 字段尽量迁移 |
| Storyboard 时长与 shots 总和不一致 | 用户手改导致 | `warnings` 写入卡片 + 渲染前自动修正 | 修正末镜时长 |
| BGM 文件缺失 | 用户删除 `public/bgm.mp3` | 渲染产物无音轨 + 警告 | 不阻断 |
| 中文字体缺失 | 字体未捆绑 | 自动 fallback 到系统字体 | 不阻断 |
| Companion 与 Web 断连 | 网络 / 进程 | 状态卡停在 running + 提示重连 | 重连后恢复轮询 |

---

## 14. 验收标准

> 本节作为 v1.0 PRD 立项时的目标验收项，未来随实现进度补"状态"列（参考 PPT 模块）。

### P0（0.x 视频 Alpha 必须：Web Video Presentation 闭环）

| # | 项 | 验证方式 |
|---|-----|----------|
| V1 | 点击「视频」进入对话界面，非表单页 | 目测 `/video/new` 渲染 `ChatHome surfaceModuleId="video"` |
| V2 | 新建会话默认加载 `skill-vp-base` | `run.started` 元数据 |
| V3 | 信息不足时基座追问缺失字段 | VF5 样例：出现问题卡或清晰追问 |
| V4 | 用户提交回答 → 生成需求摘要 | VF4 / VT5 样例通过 |
| V5 | 摘要确认后输出 script / outline 计划 | 工作区或消息中可见 `script.md`、`outline.md` |
| V6 | 交接到 `skill-vp-web-video-presentation` 并落盘 `presentation/` | 工作区可见标准结构 |
| V7 | `presentation/` 可独立启动与 typecheck | `cd presentation && npm install && npx tsc --noEmit` |
| V8 | `?reel=1` 可自动播放预览 | 可暂停、点击快进、点进度条跳转 |
| V9 | `?auto=1` 可作为最终录屏路径 | 有音频时自动推进；无音频时说明手动录屏 |
| V10 | 视频会话出现在历史侧栏 | 侧栏可见视频历史 |
| V11 | 修改章节 / 口播后再次预览，内容变化反映到网页舞台 | 真实跑一次迭代 |
| V12 | 真实 smoke：`pnpm qa:video-ai-ui` 与 `pnpm smoke:video:web-presentation` 通过 | 覆盖 VF4 / VF5 / VF6 / VT5 |

### P1（Remotion / MP4 自动渲染）

| # | 项 | 说明 |
|---|-----|------|
| V13 | Companion 探测 Remotion 依赖能力，能力缺失时有降级提示 | 缺 ffmpeg 时前端显示 `vp_capability_missing` |
| V14 | 模板 Skill 在工作区落盘 `remotion/` 项目（含 `props.json`） | 工作区可见标准结构 |
| V15 | 触发渲染后实时出现 `vp_render_status` 卡，渲染完成后 `exports/*.mp4` 出现 | 真实跑一次 60s 视频 |
| V16 | 交付物卡可预览 / 下载 MP4 | 浏览器播放 + 触发下载 |
| V17 | `props.json` 二次修改后再次渲染 → 内容变化反映到 MP4 | 真实跑一次迭代 |
| V18 | 取消渲染：在 running 态点取消，子进程在 5s 内退出 | 模拟一次 |
| V19 | 渲染失败有可读的 `errorCode` 与 `logTail` | 故意删 ffmpeg 复现 |
| V20 | 桌面壳可一键打开 `remotion studio` 本机预览 | Desktop Beta |
| V21 | 配音 TTS：把 `voiceover` 文案合成为音轨并合并到 MP4 | 引入 TTS 提供方后再评估 |

### P2（远期 / 大版本）

| # | 项 | 说明 |
|---|-----|------|
| V22 | 在线沙箱渲染 | Web Sandbox 大版本，迁到云端 Remotion Lambda |
| V23 | 多人协同编辑分镜 | Web Sandbox 大版本 |
| V24 | 品牌资产中心：Logo / 字体 / 主色复用 | 与企业模板一同评估 |
| V25 | "从研究报告一键讲解" 入口 | 写作模块联动 |

---

## 15. 测试与 QA

### 15.1 单元测试

- P0：`script.md` / `outline.md` / `narrations.ts` 一致性校验；
- P0：`presentation/` 脚手架文件完整性校验；
- P0：`?reel=1` 预览播放器 step 展平与跳转逻辑校验；
- P1：`props.json` schema 校验（合法 / 非法 / 边界）；
- P1：`migrateProps(oldProps)` 字段迁移；
- P1：分镜时长与总时长一致性校验器；
- 通用：颜色对比度计算函数。

### 15.2 集成测试（`pnpm smoke:video:*`）

| smoke 名 | 覆盖 |
|----------|------|
| `smoke:video:web-presentation` | P0 落盘 `presentation/` 后 `npm install && npx tsc --noEmit` 通过 |
| `smoke:video:reel` | P0 打开 `?reel=1`，验证自动播放、暂停、点击快进、进度条跳转 |
| `smoke:video:auto` | P0 打开 `?auto=1`，验证音频缺失时降级说明 / 有音频时自动推进 |
| `smoke:video:detect` | P1 Companion 能力探测在缺 / 全 / 部分依赖下的输出 |
| `smoke:video:scaffold` | P1 落盘后 `cd remotion && npm i && npx remotion render` 在本机能跑通 |
| `smoke:video:render` | P1 跑通一次 5s 默认视频，校验产物 size > 0 且时长正确 |
| `smoke:video:cancel` | P1 渲染中收到 cancel 后 5s 内退出 |
| `smoke:video:revise` | P1 改 `props.json` 后重渲，画面文案变化（通过抽帧对比验证） |

### 15.3 AI to UI 链路

`pnpm qa:video-ai-ui` 跑下列样例（VF4 / VF5 / VF6 / VT5）并校验 `parts[]` 顺序与 `kind`：

| 编号 | 输入 | 期望 parts 顺序 |
|------|------|-----------------|
| VF4 | "做一个 60s 的小窗产品介绍视频，面向客户高层" | 需求摘要 → script/outline → `presentation/` ready |
| VF5 | "帮我做个介绍视频" | requirements / clarification 卡 |
| VF6 | "基于刚才的报告做一个 90s 解读片，9:16 投资人版" | 需求摘要 → script/outline |
| VT5 | VF5 后用户补齐表单 | 需求摘要 → script/outline → `presentation/` ready（给出 `?reel=1`） |

### 15.4 手测脚本

| 用例 | 步骤 | 期望 |
|------|------|------|
| P0 端到端 | 新建 → 输入需求 → 填表 → 确认 → 生成网页项目 → `?reel=1` 预览 | 全程无报错 |
| P0 多次迭代 | 连续 5 次改文案 / 章节 → 预览 | 网页舞台内容变化正确 |
| P1 渲染端到端 | 新建 → 输入需求 → 填表 → 确认 → 渲染 → 预览 → 下载 | 全程无报错 |
| P1 中断恢复 | 渲染中 kill Companion → 重启 → 再次进入会话 | 看到 `failed` 状态，可重新触发渲染 |
| P1 大画幅 | 时长 120s / 9:16 / 1080×1920 | 渲染产物时长 / 分辨率正确 |

### 15.5 性能基准

每次发布跑一次基准（CI 机型 8 核 16G）：

| 场景 | 目标 |
|------|------|
| 60s / 1080p / 30fps | ≤ 3 min |
| 30s / 1080p / 30fps | ≤ 1.5 min |
| 60s / 9:16 / 30fps | ≤ 3 min |

回归阈值：相比上一版本退化 > 20% 则阻断发布。

---

## 16. 度量与北极星

### 16.1 北极星

P0 北极星：

**首月每周成功生成并预览的网页视频项目数 / 月活研究员数 ≥ 1.5。**

P1 北极星：

**每周成功渲染并下载的视频数 / 月活研究员数 ≥ 1.5。**

含义：视频不是"试一次就走"的玩具，而是研究员一周至少做一次真活。

### 16.2 关键指标

| 指标 | 口径 | 目标 |
|------|------|------|
| P0 首次成功率 | 进入视频会话且生成 `presentation/` / 进入视频会话 | ≥ 70% |
| P0 端到端时长 | 从输入需求到 `?reel=1` 可预览 | 中位数 ≤ 10 min（含模型与章节生成） |
| P0 迭代次数 | 同一会话内预览修改次数中位数 | 2 ~ 4 |
| P1 渲染失败率 | 渲染发起 → failed / 全部发起 | ≤ 10% |
| P1 下载率 | 下载次数 / MP4 数 | ≥ 60% |
| P1 Companion 能力缺失占比 | `vp_capability_missing` 出现 / 全部会话 | ≤ 5%（需 Setup 引导优化） |

### 16.3 上报内容

`telemetry.video.*` 事件仅上报指标，不含用户内容：

- P0：`session.created`、`brief.submitted`、`outline.confirmed`、
  `web_presentation.scaffolded`、`reel.preview.opened`、`recording.path.opened`。
- P1：`render.started`、`render.completed`（含耗时、帧数、分辨率、失败码）、
  `download.clicked`、`template.switched`。

---

## 17. 风险登记册

| # | 风险 | 影响 | 概率 | 缓解 |
|---|------|------|------|------|
| R1 | 用户期望"AI 出画面"（Sora 类），实际是模板合成 | 期望落差 | 中 | 入口 / 文案明确"模板驱动"；非范围中点名 |
| R2 | 本机渲染依赖（ffmpeg / Chromium）安装门槛 | 首跑失败率高 | 高 | 能力探测 + 一键命令 + 桌面壳预装可选 |
| R3 | 渲染慢（4 核机 60s 视频 > 6 min） | 用户流失 | 中 | 默认压低分辨率 / 帧率；提供 4K / 60fps 显式高级档 |
| R4 | AI 写出的 `scenes/*.tsx` 引入禁用 API（fs / child_process） | 安全 | 中 | 静态扫描白名单 + 模板 Skill 内置 lint |
| R5 | `props.json` schema 演进破坏旧项目 | 老项目跑不通 | 中 | 版本化 + `migrateProps`；老版本 schema 保留至少 2 个大版本 |
| R6 | Remotion 大版本升级（4.x → 5.x）破坏模板 | 维护成本 | 低 | scaffold 锁版本；模板包独立升级 |
| R7 | 字体 / 字符集缺失导致中文渲染异常 | 视觉灾难 | 中 | 内置 Noto Sans CJK；渲染前预校验 |
| R8 | 用户素材版权问题（BGM / 图） | 法律 | 中 | 不内置版权敏感素材；v1 默认无 BGM |
| R9 | 渲染产物体积过大占用磁盘 | 资源 | 中 | 默认 CRF 18 + 提示清理 |
| R10 | 与对话 / 写作 / PPT 模块输出格式互通断裂 | 链路价值减弱 | 中 | 早期就规划 `skill-vp-research-explainer`（P2），并约定接收"研究结论 JSON"的统一入参 |

---

## 18. 实施任务

| # | 任务 | 责任面 | 估时 |
|---|------|--------|------|
| 1 | 导航 + 路由：确认 `/video`、`/video/new`、`/video/[id]` 可用 | web | 已基本完成 |
| 2 | 模块注册表：确认 `module-registry.ts` / `module-chat-config.ts` 绑定 `skill-vp-base` | web | 已基本完成 |
| 3 | 调整 `skill-vp-base`：P0 默认路由到 `skill-vp-web-video-presentation`，明确不承诺自动 MP4 | skills | 已完成初版 |
| 4 | `chat-catalog.json` 注册 `skill-vp-web-video-presentation` | skills | 已完成 |
| 5 | 完善 `skill-vp-web-video-presentation` 模板与文档：`?reel=1` + `?auto=1` 并存 | skills | 已完成初版 |
| 6 | P0 工作区落盘协议：会话目录下写 `article.md` / `script.md` / `outline.md` / `presentation/` | skills / companion | 已完成初版（diff 可识别 `presentation/`） |
| 7 | 交付物展示：DeliverablesCard 能展示 `presentation/`、`script.md`、`outline.md` 与预览说明 | web | 已完成初版 |
| 8 | Dev server / 预览打开策略：明确由 Agent 启动本地 Vite 并给 URL，或后续接桌面壳打开 | companion / web | 已完成初版（展示命令与 URL；自动启动后续增强） |
| 9 | P0 smoke：脚手架生成 `presentation/`、`npx tsc --noEmit`、`?reel=1` 可打开 | 跨包 | 已完成初版 |
| 10 | PRD-小窗 §F-VIDEO 章节插入，更新"当前范围"表把视频 P0 列入 0.x 子线 | docs | 0.5d |
| 11 | 设计文档审计 §5 同步登记落地状态表 | docs | 0.25d |
| 12 | P1：新增 `skill-vp-product-intro` 与 Remotion 骨架模板 | skills + 模板包 | 5d |
| 13 | P1：Companion 新增 `remotion.*` 工具与能力探测、错误码 | companion | 4d |
| 14 | P1：BFF render / cancel / download / capabilities / renders 接口 | api / web BFF | 2d |
| 15 | P1：前端 `vp_*` 专属卡片与 MP4 交付物体验 | web | 3d |
| 16 | P1：Remotion smoke 与性能基准 CI | qa | 2d |

P0 新增工作量约 **5 人日**（导航与基础绑定已基本完成，不含模型调优和首个真实样片制作）。P1 Remotion 自动渲染约 **16 人日+**。

### 18.1 里程碑

| 里程碑 | 内容 | 验收 |
|--------|------|------|
| M1：P0 链路打通 | 任务 1–9 完成，能从对话走到 `presentation/` 与 `?reel=1` 预览 | V1–V9 |
| M2：P0 可发布 | 任务 10–11 完成，文档与审计同步，进入 0.x 视频 Alpha | 全部 P0 |
| M3：P1 自动渲染 | 任务 12–16 完成，Remotion MP4 闭环可用 | V13–V21 |
| M4：体验完善 | 多模板、TTS、自动录屏导出、品牌资产 | 视具体决策 |

---

## 19. 与写作 / PPT 模块差异对照

| 维度 | 写作 | PPT | 视频 |
|------|------|-----|------|
| 模块代号 | `writing` | `ppt` | `video` |
| 默认流程 Skill | `skill-writing-base` | `skill-ppt-base` | `skill-vp-base` |
| 默认风格模版 | `skill-writing-general` | `skill-ppt-pitch-deck` | P0：`skill-vp-web-video-presentation`；P1：`skill-vp-product-intro` |
| 主资产 | `.md` | `.pptx` / `.html` | P0：`presentation/`；P1：`remotion/` |
| 派生物 | `.docx`（Pandoc） | —（直接下载原文件） | P0：用户录屏；P1：`.mp4` 自动渲染 |
| 独有阶段卡 | —（沿用摘要 + 大纲） | `ppt_outline` | P0 复用通用卡；P1 增加 `vp_storyboard` + `vp_render_status` 等 |
| 主资产单一可信源 | Markdown 文本 | PPTX 文件 / HTML | P0：`script.md` + `outline.md` + `narrations.ts`；P1：`props.json` |
| 渲染依赖 | 无 | 无 | P0：Node/Vite；P1：Node + Chromium + ffmpeg |
| 端外资源 | 无 | 无 | 视频素材 / 字体 / 可选 TTS |
| 主要耗时 | 模型耗时 | 模型 + 转 PPTX | P0：模型 + 前端生成；P1：另加渲染 1~10 分钟 |
| 取消语义 | 中止模型流式 | 中止模型流式 | P0：中止模型/脚手架；P1：中止渲染子进程 |
| 状态机复杂度 | 简单 | 中等 | P0 中等；P1 复杂（含 rendering / revising） |
| 失败可恢复性 | 高 | 高 | P0 高；P1 中（依赖本机能力） |

---

## 20. 竞品对照

| 产品 / 方案 | 形态 | 优势 | 劣势 / 不采用原因 |
|-------------|------|------|--------------------|
| **Web Video Presentation**（P0） | React 网页舞台 → 预览 / 录屏 | 已有 Skill 与脚手架、可立即落盘、预览快、依赖低 | 不能自动生成 MP4，需用户录屏或后续补浏览器录制 |
| **Remotion**（P1） | React → 视频，本地可跑 / Lambda | AI 可生成、可手改、可版本化、独立运行、产物为标准 MP4 | 本机依赖较重（需探测 + 引导） |
| Adobe After Effects 脚本 | 时间轴 + 表达式 | 行业标准、视觉表现强 | 工程文件是二进制、AI 生成困难、AE 是商业软件 |
| FFmpeg 命令 + 模板 | 滤镜图 / 命令拼接 | 极轻、依赖低 | 表达能力弱，做不了交互动画 |
| Motion Canvas | TS 编程动画 | 与 Remotion 类似 | 社区与生态弱于 Remotion |
| Pictory / Synthesia / HeyGen | 在线 AI 视频 SaaS | 开箱即用 | 闭源、上传内容到云、不可二次编辑工程文件、与本平台数据流割裂 |
| Sora / Pika / Runway | text-to-video 模型 | 画面生成强 | 与本模块定位（模板合成）不同；可作为素材来源 |
| 剪映 / CapCut | 端上剪辑器 | 上手低 | 是 NLE，非 AI 工作台 |

**结论：** P0 选 Web Video Presentation 作为最快可执行闭环；P1 继续保留
Remotion 作为自动 MP4 渲染底座。两者共享 React/工作区/多轮迭代心智，可以并存。

---

## 21. 设计决策记录

| 决策 | 结论 | 理由 |
|------|------|------|
| 视频模块复用聊天组件 | 是 | 与写作 / PPT 完全对称，零额外 UI |
| 不做时间轴剪辑器 | 是 | 我们是 AI 视频生成，不是 NLE |
| P0 选 Web Video Presentation | 是 | 已有可用 Skill；能快速完成网页项目、预览、录屏闭环 |
| P1 选 Remotion 作自动渲染框架 | 是 | React 化、可编程、产物为标准 MP4、社区活跃、可本地与 Lambda 双部署 |
| 工作区中存放完整网页视频项目 | P0 是 | 用户可手改、可独立运行、可版本化；与 industrial-drawing 的"主资产即源码"模型一致 |
| 工作区中存放完整 Remotion 项目 | P1 是 | 用户可手改、可独立运行、可版本化 |
| `script.md` / `outline.md` / `narrations.ts` 作为 P0 可信源 | 是 | 与 web-video-presentation Skill 对齐，控制叙事、章节和 step |
| `props.json` 作为 P1 单一可信源 | 是 | AI 迭代修改成本最低、用户手改一致路径 |
| 渲染由 Companion 执行 | P1 | 桌面壳模式天然有本机能力；Web Sandbox 大版本迁 Lambda |
| 视频 Skill 矩阵首期只交 1+1 | 是 | `skill-vp-base` + `skill-vp-web-video-presentation`，其余按真实诉求逐个补 |
| 不引入"快速 / 深度"模式 | 是 | 与 PPT 对齐：视频是深度产出 |
| 不在 v1 引入 TTS 配音 | 是 | TTS 服务选型未定，先用"无配音 / 字幕条"保证主链路可跑通；P1 再补 |
| 视频与 PPT 模块差异点仅在工具层 | 是 | 保持运行时、`parts[]`、交付物模型统一 |
| 历史渲染不自动覆盖 | 是 | 用户安全感优先于磁盘成本 |
| AI 写代码必须在白名单内 | 是 | 安全；防止任意 `child_process` 注入 |
| 默认无 BGM | 是 | 版权风险与"先把主链路跑通"的取舍 |
| 模板切换走 `migrateProps` | 是 | 不希望用户改一次模板就丢需求 |
| 0.x 不上云渲染 | 是 | 大版本节奏问题；本地优先 |
| 不内置 ASR / 视频转写 | 是 | 与本模块方向相反 |
| 不做内置媒资库 | 是 | 工作区即媒资库 |

---

## 22. 待确认事项（Open Questions）

下列项不阻塞 PRD 立项，但在进入开发前需 PO 明确：

| # | 议题 | 当前默认假设 | 需 PO 拍板 |
|---|------|--------------|------------|
| Q1 | 默认时长 / 画幅 | 60s / 16:9 | 是否调成 "30s / 9:16" 以适配短视频心智？ |
| Q2 | 默认渲染分辨率 | P0 舞台固定 1920×1080；P1 默认 1920×1080 / 30 fps | 是否需要 4K / 60 fps 选项？ |
| Q3 | TTS 配音 | P0 可选使用 web-video-presentation 内置 provider；P1 再做统一 TTS 产品化 | 是否在 P1 直接集成（如火山 / Azure / ElevenLabs）？ |
| Q4 | BGM 来源 | 用户手动上传到 `assets/` | 是否内置一个版权可控的音乐库？ |
| Q5 | 渲染 Worker 并发 | P1 Companion 内部串行 + 单任务 4 worker | 是否允许多任务并发（受限于本机 CPU）？ |
| Q6 | 渲染失败重试 | P1 不自动重试，由用户重新触发 | 是否做"自动 1 次重试 + 失败回滚到上一稳定版本"？ |
| Q7 | 视频项目跨会话复用 | 每个会话独立目录 | 是否允许"基于已有视频项目新建会话"（类似 Cursor 的 fork）？ |
| Q8 | 与"写作 / 研究"打通 | 通过对话上下文携带研究结论 | 是否提供"从研究报告一键讲解视频"入口？（对应 `skill-vp-research-explainer`） |
| Q9 | 渲染产物命名 | P1 `<sessionId>-<timestamp>-v<n>.mp4` | 是否需要让用户自定义？ |
| Q10 | 0.x 接入哪个一线版本 | 建议挂在 PRD-小窗 v4.1 的 0.x 子线，不进入 0.1.0-alpha 验收 | 是否升为 0.2 Desktop Beta 必交付项？ |
| Q11 | 模板包是否单独 git 仓库 | 与 `skills/` 同仓 | 模板包资产较大（字体 / 示例素材 / 骨架），是否抽出独立包按需安装？ |
| Q12 | 是否允许用户直接编辑 `scenes/*.tsx` | 允许（不阻断），但下次 AI 修改可能覆盖 | 是否引入"用户锁定 scene"机制？ |
| Q13 | 字体内置策略 | 内置 Noto Sans CJK + Inter | 是否扩展品牌字体清单？版权如何控制？ |
| Q14 | 沙箱工作区是否支持渲染 | P0 可生成项目；P1 不支持渲染（无本机 Companion） | 是否提供"先生成项目，导出到本机渲染"的离线路径？ |

---

## 23. 术语表

| 术语 | 定义 |
|------|------|
| `skill-vp-base` | 视频模块默认基座 Skill，负责需求采集与模板路由 |
| `skill-vp-web-video-presentation` | P0 默认生产 Skill，产出网页视频项目、Reel 预览和 Auto 录屏路径 |
| `skill-vp-product-intro` | P1 默认 Remotion 模板 Skill，产出产品介绍片 MP4 |
| 主资产 | 可被人 / AI 反复编辑的源文件，P0 指 `presentation/`，P1 指 `remotion/` |
| 派生物 | 由主资产生成的最终产物，P0 指用户录屏，P1 指 `exports/*.mp4` |
| `script.md` | P0 口播稿，决定叙事节拍 |
| `outline.md` | P0 章节与 step 开发计划 |
| `narrations.ts` | P0 每章 step 数与口播文本的唯一真相源 |
| `props.json` | P1 Remotion 项目的单一参数文件，承载文案 / 时长 / 样式 |
| Composition | Remotion 中的根合成单元，对应一次渲染的整体内容 |
| Scene | 单镜，对应分镜脚本的一项 |
| Storyboard | 分镜脚本，用户确认的视频结构骨架 |
| `vp_*` part | 视频模块独有的 `parts[]` 卡片类型 |
| 能力探测 | `remotion.detect` 工具，检查 Node / ffmpeg / Chromium |
| 渲染产物保留策略 | 历史 MP4 不自动覆盖，超阈值时提示清理 |

---

## 24. 附录 A：P0 示例工程结构（Web Video Presentation）

```
presentation/
├── package.json
├── index.html
├── vite.config.ts
├── src/
│   ├── App.tsx                    # URL 分流：默认 / ?reel=1 / ?audio=1 / ?auto=1
│   ├── components/
│   │   ├── Stage.tsx              # 手动 / audio / auto 制作舞台
│   │   ├── ReelPlayer.tsx         # 自动预览播放器
│   │   ├── ProgressBar.tsx
│   │   └── AutoToggle.tsx
│   ├── hooks/
│   │   ├── useStepper.ts
│   │   ├── useAutoMode.ts
│   │   └── useAudioPlayer.ts
│   ├── styles/
│   │   ├── tokens.css             # 当前主题
│   │   ├── base.css
│   │   └── animations.css
│   ├── registry/
│   │   ├── chapters.ts
│   │   └── types.ts
│   └── chapters/
│       └── 01-coldopen/
│           ├── Coldopen.tsx
│           ├── Coldopen.css
│           └── narrations.ts
├── public/audio/                  # 可选：每 step 一个 mp3
└── scripts/
    ├── extract-narrations.ts
    └── synthesize-audio.sh
```

## 25. 附录 B：P1 示例工程结构（默认 Remotion 产品介绍片）

```
remotion/
├── package.json                 # 锁定 remotion@4.x + @remotion/bundler
├── remotion.config.ts           # OverrideWebpackConfig + setVideoImageFormat
├── tsconfig.json
├── props.json                   # ← 用户与 AI 共同编辑
├── public/
│   ├── brand/logo.svg
│   ├── fonts/NotoSansCJK.woff2
│   └── images/cover-bg.jpg
└── src/
    ├── index.ts                 # registerRoot(Root)
    ├── Root.tsx                 # <Composition id="Main" ... />
    ├── Composition.tsx          # 读 props.shots，按顺序渲染 Scene
    ├── theme.ts                 # 把 props.theme 转成 token
    ├── scenes/
    │   ├── Scene01_Cover.tsx
    │   ├── Scene02_Pain.tsx
    │   ├── Scene03_Solution.tsx
    │   ├── Scene04_KPI.tsx
    │   ├── Scene05_Quote.tsx
    │   ├── Scene06_CTA.tsx
    │   └── Scene07_Outro.tsx
    └── components/
        ├── SubtitleBar.tsx
        ├── KPIBlock.tsx
        ├── BulletList.tsx
        └── BrandFrame.tsx
```

## 26. 附录 C：P1 示例渲染命令

```bash
# Companion 内部执行（用户不感知）
cd <projectId>/<sessionId>/remotion
npx --no-install remotion render \
  src/index.ts Main \
  ../exports/2026-06-26T1530-v1.mp4 \
  --props=../remotion/props.json \
  --concurrency=4 \
  --image-format=jpeg \
  --jpeg-quality=90 \
  --log=info > ../exports/2026-06-26T1530-v1.log 2>&1
```

## 27. 附录 D：本 PRD 后续应产出的子文档

| 子文档 | 路径建议 | 负责 |
|--------|----------|------|
| `skill-vp-base/SKILL.md` 与 references | `skills/skill-vp-base/` | Skills |
| `skill-vp-web-video-presentation/SKILL.md` 与 templates | `skills/skill-vp-web-video-presentation/` | Skills |
| P0 视频网页联调手册 | `docs/qa/video-web-presentation-smoke.md` | QA |
| `skill-vp-product-intro/SKILL.md` 与 scaffold | `skills/skill-vp-product-intro/` | Skills + 模板包（P1） |
| Remotion 工具技术方案 | `docs/technical/companion-remotion-toolset.md` | Companion（P1） |
| 视频模块联调手册 | `docs/qa/video-module-smoke.md` | QA |
| PRD-小窗 §F-VIDEO 章节补丁 | `docs/product/PRD-小窗.md` | PO |

---

> 本 PRD 草案与 `ppt-module-prd.v2.md` / `writing-module-prd.v2.md` 平级；
> 当前执行口径为先启动 `skill-vp-base` → `skill-vp-web-video-presentation`
> 的 P0 网页视频闭环；`skill-vp-product-intro` 与 Companion `remotion.*`
> 工具进入 P1。

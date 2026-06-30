# 小窗版本管理规则

| 项 | 当前值 |
|----|--------|
| 平台发布版本 | `0.1.2-alpha` |
| 当前产品阶段 | Desktop Alpha → Desktop Beta 收口过渡 |
| 当前产品形态 | Desktop + 本地 Companion + 本地文件夹工作区 |
| 当前文档基线 | PRD 文档 `v4.1` |
| 下一小版本目标 | `0.1.2-alpha` |
| 下一 Beta 目标 | `0.2.0-beta` |
| 下一大版本目标 | Web Sandbox `1.0.0` 或独立 Web 版本线 |

---

## 1. 三类版本必须分开

### 1.1 平台发布版本

平台发布版本是唯一对外版本号，必须与根 `package.json`、桌面安装包、Web/API/Companion 包版本保持一致。

采用 SemVer：

| 版本 | 阶段 | 含义 |
|------|------|------|
| `0.1.0-alpha` | Desktop Alpha | 当前版本；对话 + 桌面壳 + Companion 主链路已完成有条件收口，3D / 视频 / 推演入口可见但不纳入 Alpha 主验收 |
| `0.1.1-alpha` | Desktop Alpha 小优化版 | `0.1.0-alpha` 后的轻量体验修复与小需求补充版本；不改变主架构，不新增大业务模块 |
| `0.1.2-alpha` | Desktop Alpha 补强版 | `0.1.1-alpha` 后的六模块入口收束、3D M1、视频 P0、懒工作区、Runtime parts 与 Desktop release gate 候选版本 |
| `0.2.0-beta` | Desktop Beta | 写作 / PPT 收口、对话增强，3D M1 / 视频 0.x / 推演 Beta 按子线节奏推进，桌面本地工作区体验可试用 |
| `1.0.0` | Desktop Stable | 桌面端正式稳定版 |
| `1.x` | Desktop 增量 | 桌面端功能迭代与体验增强 |
| `2.0.0` 或独立 `1.0.0-web` | Web Sandbox | Web 在线沙箱工作区、云端 Runtime、多用户后台进入正式产品线 |

> 若 Web 与 Desktop 后续拆成两个产品包，可使用 `desktop@1.x` 与 `web@1.x` 分线；在当前 monorepo 内仍以根版本为准。

### 1.2 产品阶段

产品阶段只描述路线，不再作为版本号使用。

| 旧叫法 | 新叫法 | 说明 |
|--------|--------|------|
| `MVP（v3.0）` | `0.1 Desktop Alpha` | 当前代码基线，对话 + 桌面壳 + Companion |
| `V1.1` | `0.2 Desktop Beta` | 写作 / PPT 真实链路收口，桌面体验完善 |
| `V2.0 / 下一大版本` | `Web Sandbox 1.0` | Web 在线沙箱、云端运行时、多用户后台 |

### 1.3 文档版本

文档版本只代表文档修订，不代表产品发布。

例如：

- PRD 文档 `v4.1` 表示当前 PRD 第四版增量基线。
- 技术方案文档 `v1.5` 表示技术方案修订版本。
- 模块 PRD `v1.0` 表示模块文档版本。

禁止再把文档版本当作平台版本使用。

---

## 2. 当前版本判断

当前平台版本定义为：

> **小窗 `0.1.2-alpha`，Desktop Alpha 补强版。**  
> `0.1.0-alpha` 是已通过的 Alpha 基线，`0.1.1-alpha` 是小优化版；当前工作区内容按 `0.1.2-alpha` 整理，根 `package.json`、桌面安装包、Web/API/Companion 包版本已同步。

当前版本已经具备：

- Desktop 本地文件夹工作区产品定义。
- Web 在线沙箱作为后续产品线目标。
- 对话主链路、Companion、桌面壳、CLI 检测与执行主干。
- Turn 吸顶、停止生成、状态点、文件深链与关键 Web 回归。
- 写作 / PPT 对话壳、需求卡 / 摘要 / 大纲、真实落盘与关键 smoke / E2E。
- 3D M1 入口、Skill、OpenSCAD CLI / WASM 与导出链路。

当前版本尚未完成：

- 签名、公证、更新源、首次启动等正式发布确认。
- 写作 DOCX / PPTX 本地交付物体验（生成、打开、定位、另存 / 导出副本）、历史侧栏和更多真实多轮回归。
- 3D Runtime 制品库、许可证材料、WASM UI 开关与异常 fixture。
- 视频 Remotion / 网页视频项目闭环与 MP4 自动化；推演画布、Round 快照和报告导出。
- Web Sandbox、多用户后台与协作。

---

## 3. 文档书写规则

后续文档统一使用以下写法：

- 平台版本：`0.1.0-alpha`、`0.2.0-beta`、`1.0.0`
- 小优化版本：`0.1.1-alpha`，需求统一记录在 [`requirements-0.1.1-alpha.md`](./requirements-0.1.1-alpha.md)
- Alpha 补强版本：`0.1.2-alpha`，内容梳理统一记录在 [`requirements-0.1.2-alpha.md`](./requirements-0.1.2-alpha.md)
- 产品阶段：Desktop Alpha、Desktop Beta、Web Sandbox
- 文档版本：PRD `v4.1`、技术方案 `v1.5`
- 优先级：P0 / P1 / P2 仅表示任务优先级，不表示产品版本

不再使用以下写法作为产品版本：

- `MVP v3.0`
- `V1.1`
- `V2.0`

这些旧写法只允许出现在历史说明、归档文档或文件名兼容场景中；活动文档如需引用，应同时给出对应的新阶段名。
- `路线图 v4`

这些旧词若出现在归档文档中，仅代表历史，不要求回写。

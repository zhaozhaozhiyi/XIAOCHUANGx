# 小窗 `0.1.2-alpha` 版本内容梳理

| 属性 | 内容 |
|------|------|
| 平台版本 | `0.1.2-alpha` |
| 阶段定位 | Desktop Alpha 补强版 |
| 文档版本 | v0.1 |
| 日期 | 2026-06-30 |
| 上一版本 | `0.1.1-alpha` |
| 后续目标 | `0.2.0-beta` / Desktop Beta |
| 适用范围 | Desktop + 本地 Companion + 本地文件夹工作区 |

> 当前仓库已将根 `package.json`、桌面安装包、Web/API/Companion 包版本统一到 `0.1.2-alpha`。本文用于把当前版本的产品内容、验收依据和发布前动作整理到同一口径。

---

## 1. 版本定位

`0.1.2-alpha` 是 `0.1.1-alpha` 之后、`0.2.0-beta` 之前的 Alpha 补强版。

本版本不新增第七个业务模块，不进入 Web Sandbox / 多用户后台，也不把写作、PPT、视频、推演全部提前定义为 Beta 完整闭环。重点是把当前已经进入代码树的六模块导航、3D M1、视频 P0、工作区联动、运行时协议和桌面发布链路收束为可验收的版本内容。

---

## 2. 范围原则

### 2.1 纳入范围

- 当前六模块导航：对话 / 写作 / PPT / 3D绘图 / 视频 / 推演。
- 3D绘图 M1 的真实工作区、OpenSCAD CLI / WASM、预览与导出发布闸门。
- 视频模块 P0 的网页视频项目路径、分镜 / 脚本 / `presentation/` 产物与 smoke。
- 工作区文件树、文件读写、二进制 / 3D 预览能力和本机项目边界保护。
- Companion Run、Runtime events、`parts[]`、懒工作区物化与交付物写入的稳定化。
- Desktop 打包发布链路、Companion bundle、OpenSCAD runtime 校验与发布脚本。
- 设置页、BYOK、智能体 / 模型选择、聊天输入与时间线的体验补强。

### 2.2 不纳入范围

- Web Sandbox、云端 Runtime、多用户后台、多人协作。
- 新增第七个一级业务模块。
- 视频自动 MP4 / Remotion 渲染完整闭环。
- 推演 React Flow 沙盘画布、Round 快照和报告导出完整闭环。
- 写作 / PPT 的全部 Desktop Beta 验收项。
- macOS 公证、Windows EV 签名、更新源生产配置。

---

## 3. 版本内容清单

| 编号 | 模块 | 内容 | 优先级 | 当前状态 |
|------|------|------|--------|----------|
| `A012-NAV-001` | 导航 / 模块 | 当前导航收敛为对话、写作、PPT、3D绘图、视频、推演；翻译、会议、知识库从当前主导航移除 | P0 | 已进入代码树 |
| `A012-3D-001` | 3D绘图 | `/3d` 路由、共享会话、`skill-industrial-drawing-*`、SCAD / STL / DXF / SVG / PDF 预览导出链路 | P0 | 已进入代码树，需跑发布闸门 |
| `A012-3D-002` | 3D绘图 | OpenSCAD CLI Runtime 与 WASM public 资源校验，新增 `m1:3d:release-gate` 与相关 smoke | P0 | 已进入代码树，Runtime 制品需发布前确认 |
| `A012-VIDEO-001` | 视频 | `/video` 路由、模块注册、`skill-vp-base` 与网页视频 presentation 项目路径 | P1 | 已进入代码树，P0 smoke 待统一验收 |
| `A012-VIDEO-002` | 视频 | 视频 P0 交付口径：`script.md`、`outline.md`、`presentation/package.json`、章节 narrations 等真实文件落盘 | P1 | 已进入代码树，仍不承诺自动 MP4 |
| `A012-SIM-001` | 推演 | `/simulation` 路由、模块注册、Beta 入口面板、`skill-simulation-base` 基座 | P1 | 已进入代码树，占位 + 基座接入 |
| `A012-WORKSPACE-001` | 工作区 | 工作区新增文件 / 文件夹、文件保存、预览 mime 扩展、STL / DXF / SCAD 识别 | P0 | 已进入代码树 |
| `A012-WORKSPACE-002` | 工作区 | 3D / 视频懒默认工作区：临时 cwd 运行，检测到真实产物后再物化为正式项目 | P0 | 已进入代码树 |
| `A012-RUNTIME-001` | Companion / Runtime | `project.ensured`、`part.append`、`part.patch` 等运行时事件持久化；交付物绑定 workspaceProjectId | P0 | 已进入代码树 |
| `A012-RUNTIME-002` | Companion / Runtime | Run 超时、取消、空输出、CLI 重连噪声与视频 timeout profile 稳定化 | P0 | 已进入代码树 |
| `A012-CHAT-001` | 对话体验 | 自动模式 `auto`、任务状态条、时间线密度、消息气泡、交付物卡片与 sticky 行为优化 | P1 | 已进入代码树 |
| `A012-SETTINGS-001` | 设置 / BYOK | BYOK provider / credential schema、模型提供商卡片、Agent 设置与模型选择器增强 | P1 | 已进入代码树，需补关键手测 |
| `A012-DESKTOP-001` | 桌面壳 | Companion bundle、web standalone 准备、OpenSCAD runtime 准备、release pack 脚本 | P0 | 已进入代码树，需打包态验证 |
| `A012-DESKTOP-002` | 桌面壳 | preload 增强、标题栏、托盘 / About / 自动更新相关发布链路延续 | P1 | 已进入代码树，签名和更新源推后 |
| `A012-DOCS-001` | 文档 | PRD、模块 PRD、3D M1 状态、视频 PRD、推演 PRD、技术文档与 smoke 说明同步 | P1 | 已进入代码树，需继续统一版本号 |

---

## 4. 重点能力说明

### 4.1 六模块导航与范围收敛

本版本延续 PRD v4.1 的判断：当前一级导航只保留对话、写作、PPT、3D绘图、视频、推演。翻译、会议纪要、知识库不进入当前 Desktop Alpha / Beta 主线。

其中 3D绘图已经进入 M1 真实链路；视频和推演保留入口与基座接入，但必须明确标注未完成完整业务闭环。

### 4.2 3D绘图 M1

本版本把 3D 从“入口可见”推进为可验收子线：

- 支持 `.scad`、`.dxf`、`.stl`、`.svg` 等产物识别与预览。
- 支持 OpenSCAD CLI / WASM 双路径，WASM 用于快速预览，CLI 作为权威导出。
- 支持参数文件、导出文件与工作区文件编辑保存。
- 新增 3D smoke 与 release gate，发布前必须确认 Runtime、许可证和 source availability。

### 4.3 视频 P0

视频模块当前承诺的是“网页视频项目”而不是自动 MP4：

- 用户通过 `/video` 进入对话式视频生成。
- 默认走 `skill-vp-base` 与 `skill-vp-web-video-presentation`。
- 产物必须落盘为可检查的真实文件，包括 `script.md`、`outline.md`、`presentation/` 项目。
- `presentation/` 应可通过本地 dev server 预览，`?reel=1` 用于点击驱动演示，`?auto=1` 用于录屏自动播放。
- Remotion 渲染、MP4 自动导出、TTS / BGM 库仍放到后续版本。

### 4.4 工作区与懒物化

本版本强化“所有正式任务最终都必须有真实工作区”的口径：

- 未选项目时，3D / 视频等模块可先使用临时 cwd。
- 只有检测到真实产物后，才把临时 cwd 复制到默认工作文件夹并登记为正式项目。
- 这避免打开 `/3d/new`、`/video/new` 这类新建页时就制造空目录。
- 文件新增、保存、打开、预览继续受项目根目录约束，禁止绝对路径和目录逃逸。

### 4.5 Runtime 与交付物协议

本版本继续把运行结果从“聊天文本”推进为“可恢复的结构化 parts + 工作区产物”：

- `part.append` / `part.patch` 进入 runtime store。
- `project.ensured` 用于通知前端懒工作区已物化。
- deliverables 需要绑定实际 `workspaceProjectId`，避免前端误开 `none` 或临时项目。
- 写作 / PPT / 3D / 视频都应按同一套 `parts[]` 与工作区产物协议展示。

### 4.6 桌面发布链路

本版本新增或强化了发布相关脚本：

- `desktop:pack:release`
- `desktop:pack:ci:release`
- `m1:3d:release-gate`
- `engines:verify:openscad:*`
- `engines:verify:openscad-wasm:*`
- `smoke:3d:*`
- `smoke:video:*`

正式发布前，应优先跑 release 级别命令，而不是只跑开发态 smoke。

---

## 5. 验收建议

### 5.1 最小必跑

```bash
pnpm skills:verify
pnpm qa:writing-ppt-ai-ui
pnpm --filter @jlcresearch/companion build
pnpm -C web exec tsc --noEmit --pretty false
pnpm -C web build
```

### 5.2 3D M1 发布闸门

```bash
pnpm skills:verify-3d
pnpm smoke:3d:quick
pnpm engines:verify:openscad:required
pnpm engines:verify:openscad-wasm:required
pnpm m1:3d:release-gate
```

如需真实 CLI 生成链路，再补：

```bash
pnpm smoke:3d:claude
```

### 5.3 视频 P0 验收

```bash
pnpm smoke:video
```

验收时重点看真实产物，而不是只看对话回复：

- `script.md`
- `outline.md`
- `presentation/package.json`
- `presentation/src/chapters/**/narrations.ts`
- `presentation/` 可本地启动并打开 `?reel=1` / `?auto=1`

### 5.4 桌面打包验收

```bash
pnpm desktop:pack:release
```

打包态需要确认：

- App 启动后内置 Companion 自动拉起。
- `GET http://127.0.0.1:9477/v1/health` 返回正常。
- `Contents/Resources` 中包含 web standalone、companion、skills、prompts、OpenSCAD runtime / WASM 所需资源。
- 无需用户手动启动 `pnpm companion:dev`。

---

## 6. 发布前必须整理

| 项 | 处理要求 |
|----|----------|
| 包版本号 | 根 `package.json`、`web`、`apps/desktop`、`companion`、必要包已统一到 `0.1.2-alpha` |
| PRD 当前版本 | `docs/product/PRD-小窗.md` 已在顶部平台发布版本标记为 `0.1.2-alpha`；文中 `0.1.0-alpha` 段落保留为历史 Alpha 基线描述 |
| 版本管理文档 | `docs/product/versioning.md` 已加入 `0.1.2-alpha` 的位置与定义 |
| OpenSCAD Runtime | 确认二进制、manifest、许可证、source availability 对应同一版本 |
| 打包产物 | macOS / Windows 安装包版本号与 About 面板显示一致 |
| 变更归档 | 将本文件作为 release note / 验收清单基线，避免内容散落在计划文档中 |

---

## 7. 与相邻版本关系

- `0.1.0-alpha`：对话 + 桌面壳 + Companion 主链路有条件通过。
- `0.1.1-alpha`：侧栏、项目、默认工作文件夹、对话历史菜单、文件树新增等轻量体验优化。
- `0.1.2-alpha`：六模块入口收束、3D M1、视频 P0、懒工作区、Runtime parts、Desktop release gate 的 Alpha 补强版。
- `0.2.0-beta`：继续收口写作 / PPT、对话增强、桌面本地工作区体验、3D / 视频 / 推演真实闭环。

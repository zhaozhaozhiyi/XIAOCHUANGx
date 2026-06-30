# 小窗 `0.1.2-alpha` 版本升级说明

| 属性 | 内容 |
|------|------|
| 平台版本 | `0.1.2-alpha` |
| 发布阶段 | Desktop Alpha 补强版 |
| 日期 | 2026-06-30 |
| 上一版本 | `0.1.1-alpha` |
| 后续目标 | `0.2.0-beta` / Desktop Beta |

---

## 1. 升级摘要

`0.1.2-alpha` 是一次 Alpha 补强升级：在 `0.1.1-alpha` 的项目 / 会话 / 工作区小优化基础上，把当前六模块入口、3D绘图 M1、视频 P0、懒工作区物化、Runtime parts 持久化和 Desktop release gate 收束为统一版本。

本版本仍坚持 Desktop + 本地 Companion + 本地文件夹工作区，不进入 Web Sandbox、多用户后台或云端 Runtime。

---

## 2. 主要升级内容

### 2.1 六模块导航收束

- 当前一级导航统一为：对话、写作、PPT、3D绘图、视频、推演。
- 翻译、会议纪要、知识库从当前主导航移除，保留为历史或后续候选能力。
- 3D绘图进入 M1 真实链路；视频和推演作为 0.x / Beta 子线继续推进。

### 2.2 3D绘图 M1

- 新增 `/3d`、`/3d/new`、`/3d/[id]` 路由与共享会话历史。
- 接入 `skill-industrial-drawing-base`、参数化制图和导出 Skill。
- 支持 `.scad`、`.dxf`、`.stl`、`.svg` 等工作区产物识别、预览和保存。
- 增加 OpenSCAD CLI / WASM 校验脚本与 `m1:3d:release-gate`。
- OpenSCAD CLI Runtime 大文件继续由本地或发布 CI 准备，不直接提交到仓库。

### 2.3 视频 P0

- 新增 `/video` 路由、模块注册与视频基座 Skill。
- 明确 P0 交付为网页视频项目，不承诺自动 MP4。
- 真实产物口径包括 `script.md`、`outline.md`、`presentation/package.json` 和章节 narrations。
- 增加 `smoke:video`、`smoke:video:reel`、`smoke:video:auto` 等回归入口。

### 2.4 推演 Beta 入口

- 新增 `/simulation` 路由、模块注册和 Beta 入口面板。
- 接入 `skill-simulation-base`，为后续沙盘画布、Round 快照和报告导出预留协议。
- 当前仍不承诺完整 React Flow 画布闭环。

### 2.5 工作区与文件能力

- 工作区文件树支持真实新增文件 / 文件夹。
- Companion 增加项目内文件写入与 entry 创建 API。
- 文件读写继续限制在项目根目录内，禁止绝对路径和目录逃逸。
- 3D / 视频支持懒默认工作区：先用临时 cwd 执行，检测到真实产物后再物化为正式项目。

### 2.6 Runtime 与对话体验

- Runtime store 支持 `project.ensured`、`part.append`、`part.patch`。
- 交付物卡片绑定实际 `workspaceProjectId`，减少临时项目或 `none` 项目误打开。
- 增加 `auto` 对话模式。
- 优化任务状态条、时间线密度、交付物卡片、消息气泡和 sticky 行为。

### 2.7 桌面发布链路

- 版本号统一为 `0.1.2-alpha`。
- 新增 / 强化 `desktop:pack:release`、`desktop:pack:ci:release`。
- Desktop 打包链路接入 Web standalone、Companion bundle、skills、prompts 与 OpenSCAD runtime 校验。
- 签名、公证、Windows EV 证书和正式更新源仍放到后续发布准备。

---

## 3. 升级影响

| 影响面 | 说明 |
|--------|------|
| 用户导航 | 当前可见模块变为六个，旧翻译 / 会议 / 知识库入口不再作为当前主线出现 |
| 本地工作区 | 新任务更强调真实 `projectId` 与真实文件落盘 |
| 3D绘图 | 从入口占位升级为 M1 子线，可执行预览 / 导出 / release gate |
| 视频 | 从 PRD / 入口升级到网页视频项目 P0，但不自动生成 MP4 |
| 推演 | 保持 Beta 入口和基座 Skill，完整画布仍未进入本版本 |
| 发布工程 | 打包前需要准备或校验 OpenSCAD Runtime / WASM 资源 |

---

## 4. 验收命令

建议最小回归：

```bash
pnpm skills:verify
pnpm qa:writing-ppt-ai-ui
pnpm --filter @jlcresearch/companion build
pnpm -C web exec tsc --noEmit --pretty false
pnpm -C web build
```

3D M1 发布闸门：

```bash
pnpm skills:verify-3d
pnpm smoke:3d:quick
pnpm engines:verify:openscad:required
pnpm engines:verify:openscad-wasm:required
pnpm m1:3d:release-gate
```

视频 P0：

```bash
pnpm smoke:video
```

桌面发布包：

```bash
pnpm desktop:pack:release
```

---

## 5. 已知限制

- `gh` / GitHub CLI 不属于产品运行依赖；本地发布 PR / Release 仍需开发机安装后使用。
- Web Sandbox、云端 Runtime、多用户后台不属于本版本。
- 视频自动 MP4、Remotion 渲染、TTS / BGM 库不属于本版本。
- 推演 React Flow 画布、Round 快照和报告导出不属于本版本完整闭环。
- OpenSCAD CLI Runtime 大文件不提交仓库，正式打包前必须由本地或 CI 制品准备。
- macOS 公证、Windows EV 签名和正式更新源仍需发布前单独确认。

# 3D绘图模块 M1 状态记录

| 属性 | 内容 |
|------|------|
| 日期 | 2026-06-26 |
| 范围 | 3D绘图 / 工业制图 M1 产品闭环 |
| 上级文档 | [industrial-drawing-module-prd.v1.md](../product/modules/industrial-drawing-module-prd.v1.md)、[industrial-drawing-m1-execution-plan.md](./industrial-drawing-m1-execution-plan.md) |

---

## 1. 当前已完成的真实链路

| 链路 | 当前状态 | 证据 |
|------|----------|------|
| 产品入口 | `/3d`、`/3d/new`、`/3d/[id]` 已进入共享 ChatHome / ChatThread 结构 | `web/src/app/(main)/3d/*`、`web/src/lib/module-chat-config.ts` |
| 模块注册 | `moduleId = 3d` 已进入 registry、navigation、会话配置 | `web/src/lib/module-registry.ts`、`web/src/lib/navigation.ts` |
| 共享会话 | 3D / 写作 / PPT / 对话共用会话历史模型，3D 可按 `surfaceModuleId` 过滤 | `web/src/lib/chat-history.ts`、`web/src/components/chat/ChatHistorySidebar.tsx` |
| Skill 基座 | `skill-industrial-drawing-base / parametric / export` 已进入 skill catalog 并可校验 | `skills/skill-industrial-drawing-*`、`scripts/verify-3d-skills.mjs` |
| 可编辑文件 | `.scad` / `.dxf` / 文本产物可在 Workspace Viewer 中编辑保存 | `web/src/components/workspace/FileViewer.tsx` |
| CLI 主路径 | 产品托管 OpenSCAD CLI Runtime 可从 `apps/desktop/resources/engines/openscad/{platform}` 解析 | `web/src/lib/cad-toolchain.ts` |
| CLI 导出 | DXF / STL 走 OpenSCAD CLI，SVG / PDF 保留参数轮廓 fallback | `web/src/app/api/workspace/cad/export/route.ts` |
| WASM 增强 | 浏览器 Worker 已能加载 `web/public/openscad-wasm/openscad.js` 并真实编译 STL | `web/src/workers/openscad-wasm-preview.worker.ts`、`scripts/smoke-openscad-wasm-preview.ts` |
| 发布闸门 | CLI Runtime 与 WASM public 资源均有 verify / required 校验脚本 | `scripts/verify-openscad-runtime.mjs`、`scripts/prepare-openscad-wasm.mjs` |
| `/3d/new` 懒创建 | 打开新建页只渲染 ChatHome，不直接创建目录 | `web/src/app/(main)/3d/new/page.tsx` |
| 3D 懒工作区物化 | 未选目录的 3D Run 先使用临时 cwd；只有检测到真实文件产物后才复制并登记为正式默认工作区；Run 结束后清理临时 cwd | `web/src/lib/companion/run.ts`、`companion/src/routes/runs.ts`、`companion/src/runs/manager.ts`、`scripts/smoke-module-session-paths.ts` |

---

## 2. 已验证命令

| 命令 | 目的 |
|------|------|
| `pnpm -C web exec tsc --noEmit --pretty false` | 前端 TypeScript 类型检查 |
| `pnpm engines:verify:openscad-wasm` | 校验 `web/public/openscad-wasm` 资源、manifest、source availability |
| `pnpm smoke:3d:wasm-preview` | 验证默认关闭时降级、启用时真实 WASM STL 编译 |
| `pnpm engines:verify:openscad:required` | 校验本地产品托管 OpenSCAD CLI Runtime、版本、许可证、source availability |
| `pnpm smoke:3d:quick` | 3D 模块快速回归 |
| `pnpm smoke:3d:claude` | 真实 ClaudeCode 3D 生成流程 smoke |
| `pnpm smoke:3d` | 3D quick + 真实 ClaudeCode 生成全链路 |
| `pnpm --filter @jlcresearch/companion build` | Companion TypeScript 构建 |

---

## 3. 当前本地 Runtime 资源

| 资源 | 位置 |
|------|------|
| CLI Runtime | `apps/desktop/resources/engines/openscad/darwin/OpenSCAD.app` |
| CLI manifest | `apps/desktop/resources/engines/openscad/darwin/RUNTIME_MANIFEST.json` |
| CLI license notices | `apps/desktop/resources/engines/openscad/darwin/LICENSES/` |
| WASM loader | `web/public/openscad-wasm/openscad.js` |
| WASM binary | `web/public/openscad-wasm/openscad.wasm` |
| WASM manifest | `web/public/openscad-wasm/WASM_MANIFEST.json` |

CLI Runtime 大文件按 `.gitignore` 不提交，发布流水线应通过 `pnpm engines:fetch:openscad` 或内部制品库准备。WASM 资源体积较小，可作为 Web public 资源进入产品包。

---

## 4. 剩余风险与发布前确认

| 风险 | 处理要求 |
|------|----------|
| OpenSCAD snapshot 二进制与源码材料必须对应 | 发布前必须确认所选 CLI Runtime 的源码 archive / commit 与二进制版本匹配，不能用旧稳定版源码替代新 snapshot 的 source availability |
| OpenSCAD / CADAM GPL 边界 | 小窗自研参数编辑、工作区、skill 与适配层；OpenSCAD 保持独立 Runtime / WASM 组件。若复制 CADAM GPL 代码进入正式产品路径，必须重新走许可评审 |
| WASM 预览不是权威导出 | WASM 仅用于快速预览；最终 STL / DXF 交付以产品托管 CLI Runtime 为准 |
| 复杂 SCAD 兼容性 | M1 优先支持纯净、无外部 `import()` 的参数化 SCAD；外部库、字体、多文件模型进入后续版本 |
| 进程异常中断后的临时目录 | 正常 Run 生命周期已清理 3D 临时 cwd；若 Node 进程被系统强杀，仍可能在 OS 临时目录留下非登记文件夹。该情况不进入用户正式工作区，可由后续守护清理任务处理。 |

---

## 5. 下一步

- 将 `pnpm engines:prepare:openscad-wasm` 纳入 Web / Desktop 发布流水线。
- 将 OpenSCAD CLI Runtime 从本地 `.runtime` 准备流程迁移到内部制品库，固定版本、SHA256、源码对应材料。
- 在真实 UI 中开启 `NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW=1` 验证 `/3d` 预览体验和 CLI fallback 切换。
- 继续补齐 3D fixture 覆盖真实卡片恢复、工作区选择已有目录、导出失败重试等用户路径。
- 发布前跑 `pnpm smoke:3d`、`pnpm engines:verify:openscad:required`、`pnpm engines:verify:openscad-wasm:required` 作为 3D 模块硬闸门。

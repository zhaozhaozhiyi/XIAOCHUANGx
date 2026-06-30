# 桌面壳（Electron）— 技术设计摘要

> 完整方案（含文件夹导入、IPC、安全）见 [folder-import-and-desktop-shell.md](./folder-import-and-desktop-shell.md)。  
> PRD：**`0.1.0-alpha` / Desktop Alpha** §5.3.7（桌面壳为推荐交付形态，不是 Desktop Beta 才做的可选项）；技术方案：[技术方案.md](./技术方案.md) §3.4。

## 已决选型

**Electron + 独立 Companion**，与 Open Design Desktop 同构。

| 不推荐 | 原因 |
|--------|------|
| Tauri（当前 Desktop 主路径） | 无 OD 参考，Rust 主进程重写成本高 |
| Web `showDirectoryPicker` | 无法可靠绝对路径 |
| 渲染进程内 spawn CLI | 违背 Companion 执行面 |

## 最小 IPC 面

| 通道 | 方向 | 说明 |
|------|------|------|
| `pickAndImportFolder` | 渲染 → 主 → Companion | 返回 `{ projectId, name, pathSummary }` |
| `getCompanionHealth` | 渲染 → 主 | 代理 `GET /v1/health`（✅ Desktop Alpha） |
| `openPathInFinder` | 渲染 → 主 | 仅 `fromTrustedPicker` 项目（Desktop Beta） |

## 开发联调

```bash
# 终端 A：Companion
pnpm --filter @jlcresearch/companion dev

# 终端 B：Web
pnpm --filter web dev

# 终端 C：Electron（Desktop Alpha）
pnpm desktop:dev
# 开发态 loadURL http://localhost:3000
```

## 打包

```bash
pnpm desktop:pack        # web build + prepare resources + dmg/nsis
pnpm desktop:pack:dir  # 仅解包目录（冒烟）
```

- **electron-builder**：`apps/desktop/electron-builder.yml`；mac `.dmg`、Windows NSIS。
- **内嵌 Web**：`web` 启用 `output: "standalone"` → `scripts/prepare-desktop-web.mjs` → `resources/web-standalone`；打包态主进程启动内嵌 Next 服务（与浏览器同一构建产物）。
- **Companion**：Desktop Alpha 可独立安装/启动；Desktop Beta 走捆绑安装器或首次启动检测。
- 代码签名：企业 MDM 分发前由 IT 完成。

## 目录

```
apps/desktop/
  electron-builder.yml
  resources/web-standalone/   # 打包前由 prepare 脚本生成（gitignore）
  src/main/
    index.ts
    import-folder.ts
    web-url.ts
    embedded-web.ts
    companion-health.ts
  src/preload/preload.ts
```

# @jlc/desktop

Electron 桌面壳（**PRD v3.0 MVP** §5.3.7）。对 `web/` 的包装，无业务分叉；主进程提供系统选目录 + Companion `import-folder`。Companion 为**独立进程**（非 V1.1 才拆）。

## 品牌图标

与 Web 侧栏 `BrandMark` 一致（陶土色圆角底 + 浅色圆环）。源文件：`build/icon.svg`；生成 PNG/ICNS：

```bash
pnpm icons   # 或仓库根目录 pnpm desktop:icons
```

`desktop:dev` / 打包前会自动执行。macOS 开发态默认走品牌化 `小窗.app`，Dock 与窗口图标由主进程 `resolveAppIcon` 加载；勿删除 `build/icon.png` / `icon.icns`。

## 开发联调

```bash
# 终端 A：Companion
pnpm companion:dev

# 终端 B：Web
pnpm dev:web

# 终端 C：桌面壳
pnpm desktop:dev
```

环境变量：

| 变量 | 默认 | 说明 |
|------|------|------|
| `JLC_WEB_URL` | 开发：`http://localhost:3000` | 渲染进程加载地址；设置后覆盖默认 |
| `COMPANION_BASE_URL` | `http://127.0.0.1:9477` | 主进程 import-folder / health |
| `JLC_DESKTOP_DEVTOOLS` | — | 设为 `1` 打开 DevTools |

## 内测安装包（PRD S4.3）

```bash
# 构建 web standalone → 复制到 resources → electron-builder（mac dmg / win nsis）
pnpm desktop:pack

# 仅解包目录（不生成 dmg，便于本地冒烟）
pnpm desktop:pack:dir
```

产物目录：`apps/desktop/release/`。

打包态应用会**内嵌**与浏览器相同的 Next `standalone` 服务；Companion 仍需用户本机安装并启动（V1.1 再做捆绑安装器）。

## 与 Web 的桥接

| API | 说明 |
|-----|------|
| `window.electronAPI.pickAndImportFolder()` | 系统选目录 → Companion 导入（preload 须为 **CommonJS** `preload.cjs`） |
| `window.electronAPI.getCompanionHealth()` | 主进程代理 `GET /v1/health` |

渲染进程**不**接收 `baseDir` 明文。HMAC / 托盘 / 自动更新见 PRD V1.1。

详见 [web/docs/desktop-shell.md](../web/docs/desktop-shell.md)。

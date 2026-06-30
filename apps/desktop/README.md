# @jlc/desktop

Electron 桌面壳（**`0.1.0-alpha` / Desktop Alpha** §5.3.7）。对 `web/` 的包装，无业务分叉；主进程提供系统选目录 + Companion `import-folder`。Companion 是 Desktop 本地文件夹工作区的本机运行时。

## 品牌图标

与 Web 侧栏 `BrandMark` 一致（陶土色圆角底 + 浅色圆环）。源文件：`build/icon.svg`；生成 PNG/ICNS：

```bash
pnpm icons   # 或仓库根目录 pnpm desktop:icons
```

`desktop:dev` / 打包前会自动执行。macOS 开发态默认走品牌化 `小窗.app`，Dock 与窗口图标由主进程 `resolveAppIcon` 加载；勿删除 `build/icon.png` / `icon.icns`。

## 开发联调

推荐直接在仓库根目录运行：

```bash
pnpm dev
```

它会自动启动 Companion、Web，并在两者就绪后拉起桌面壳；同时也会带上业务 API。

需要拆开排查时，再按下面的分终端方式启动：

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

## 内测安装包（Desktop Alpha S4.3）

```bash
# 构建 web standalone → 复制到 resources → electron-builder（mac dmg / win nsis）
# 开发/内测包允许 OpenSCAD Runtime 缺失，产品内会显示 openscad_runtime_missing。
pnpm desktop:pack

# 仅解包目录（不生成 dmg，便于本地冒烟）
pnpm desktop:pack:dir
```

产物目录：`apps/desktop/release/`。

## 正式发布包

正式发布包必须内置 OpenSCAD Runtime 与许可证材料，不允许把安装、PATH
配置或许可证收集交给最终用户。

```bash
JLC_OPENSCAD_ARCHIVE=/path/to/OpenSCAD-runtime.dmg \
JLC_OPENSCAD_DIST_SHA256=<sha256> \
JLC_OPENSCAD_LICENSES_DIR=/path/to/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64 \
pnpm engines:fetch:openscad

JLC_OPENSCAD_SOURCE=/path/to/OpenSCAD.app \
JLC_OPENSCAD_LICENSES_DIR=/path/to/openscad-license-notices \
JLC_OPENSCAD_SOURCE_CODE_URL=https://github.com/openscad/openscad \
JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64 \
pnpm desktop:pack:release
```

`desktop:pack:release` 会强制设置 `JLC_OPENSCAD_REQUIRED=1`。如果 Runtime
或 `LICENSES/` 缺失，打包会失败，不会产出一个需要用户自行安装 OpenSCAD 的
正式包。

推荐发布流水线使用 `JLC_OPENSCAD_ARCHIVE` / `JLC_OPENSCAD_DIST_URL` +
`JLC_OPENSCAD_DIST_SHA256`，由 `scripts/fetch-openscad-runtime.mjs` 完成下载、
校验、解包和准备。`JLC_OPENSCAD_SOURCE` / `JLC_OPENSCAD_BIN` 更适合本地已有
Runtime 的研发验证。

macOS 发布如果要同时覆盖 Intel 与 Apple Silicon，建议设置
`JLC_OPENSCAD_REQUIRED_ARCHES=x86_64,arm64`，发布校验会检查 Runtime 架构；
若上游稳定包只有 Intel，需要改用 Universal 构建或拆分架构包。

打包态应用会**内嵌**与浏览器相同的 Next `standalone` 服务；Companion 在 Desktop Beta 路线中按 sidecar/bundle 方式跟随桌面壳演进。

## 与 Web 的桥接

| API | 说明 |
|-----|------|
| `window.electronAPI.pickAndImportFolder()` | 系统选目录 → Companion 导入（preload 须为 **CommonJS** `preload.cjs`） |
| `window.electronAPI.getCompanionHealth()` | 主进程代理 `GET /v1/health` |

渲染进程**不**接收 `baseDir` 明文。HMAC / 托盘 / 自动更新见 Desktop Beta 路线图。

详见 [docs/technical/desktop-shell.md](../../docs/technical/desktop-shell.md)。

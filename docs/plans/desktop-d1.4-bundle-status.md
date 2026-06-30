# D1.4 Companion 捆绑 · 实施状态（2026-06-26）

| 属性 | 内容 |
|------|------|
| 文档版本 | v0.2 |
| 修订日期 | 2026-06-26 |
| 上级文档 | [desktop-v1.1-roadmap.md §6](./desktop-v1.1-roadmap.md) |
| 关联代码 | `companion/package.json`、`scripts/prepare-companion-bundle.mjs`、`scripts/prepare-desktop-web.mjs`、`apps/desktop/electron-builder.yml`、`apps/desktop/src/main/companion-supervisor.ts`、`apps/desktop/build/entitlements.mac.plist` |

---

## 1. 决策（偏离 roadmap §6.3）

> **roadmap §6.3 原计划**：用 [pkg](https://github.com/vercel/pkg) 或 [nexe](https://github.com/nexe/nexe) 把 Companion 打成 Node 单二进制（≈ 50MB / 平台），通过 `extraResources` 装进 DMG/NSIS。
>
> **实施版（2026-06-08）**：用 **esbuild bundle + Electron `ELECTRON_RUN_AS_NODE` 共享 runtime**。

### 1.1 为什么偏离

| 维度 | pkg/nexe（原计划） | esbuild + ELECTRON_RUN_AS_NODE（实施版） |
|------|--------------------|-----------------------------------------|
| 体积 | 50MB / 平台 | 1.8MB（每平台共享 Electron 已带的 Node runtime） |
| 工具链 | 需拉 Node prebuild、需 yao-pkg 维护版本 | 仅 `esbuild`（项目里已有），无新依赖 |
| 跨平台构建 | 每平台一个产物（mac/win/linux × x64/arm64） | 单一 .cjs，所有平台通用 |
| ESM 兼容性 | yao-pkg 支持但有边角；vercel/pkg 已死 | esbuild ESM→CJS 转换稳定 |
| D1.5 电池更新 | electron-updater 整体替换 .app 时连带换 binary | 同 |
| 缺点 | — | Companion bundle 必须靠 Electron 主进程拉起，**无法脱壳独立运行**（开发态仍走 `pnpm companion:dev`） |

唯一被牺牲的是"Companion 单独成可执行文件给非桌面用户用"。但 Desktop Beta 形态明确是"本机单用户 + 桌面壳 + Companion"（历史 memory 仍沿用 V1.1 命名），不存在"裸 Companion 客户"，这个牺牲不亏。

### 1.2 关键技巧 · ELECTRON_RUN_AS_NODE

Electron binary 内嵌 V8 + Node。设 `process.env.ELECTRON_RUN_AS_NODE=1` + spawn 时给一个 `.js` 路径作 argv[1]，Electron 跳过 GUI / Chromium / argv 解析，纯当 Node runtime 跑那个脚本。Companion bundle 因此**无需自带 Node**。

参考：[Electron docs · ELECTRON_RUN_AS_NODE](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)。

---

## 2. 数据通路

```
开发态（!app.isPackaged）
   └─ supervisor.findCompanionBundle() → null
       └─ status = "needs-manual-start"
       └─ 用户 pnpm companion:dev（外部进程）

打包态（app.isPackaged）
   └─ supervisor.findCompanionBundle()
       ├─ bundlePath = process.resourcesPath/companion/companion.cjs
       ├─ skillsDir  = process.resourcesPath/skills
       └─ promptsDir = process.resourcesPath/prompts
   └─ supervisor.trySpawnSidecar()
       └─ spawn(process.execPath, [bundlePath], {
            env: {
              ...process.env,
              ELECTRON_RUN_AS_NODE: "1",     // 跑成纯 Node
              JLC_SKILLS_DIR: ?? skillsDir,  // runtime-core/paths.ts 兜底
              JLC_PROMPTS_DIR: ?? promptsDir,
            },
          })
       └─ Companion fastify on 127.0.0.1:9477
```

---

## 3. 文件清单

| 文件 | 状态 | 用途 |
|------|------|------|
| `companion/package.json` | ✅ 改 | 加 esbuild devDep；scripts: `bundle` / `build:bin` |
| `companion/.gitignore` | ✅ 改 | 加 `dist-bin/` |
| `scripts/prepare-companion-bundle.mjs` | ✅ 新增 | bundle + skills + prompts 镜像到 `apps/desktop/resources/` |
| `apps/desktop/.gitignore` | ✅ 改 | `resources/web-standalone/` → `resources/`（整目录，覆盖 D1.4 三个新子目录） |
| `apps/desktop/electron-builder.yml` | ✅ 改 | `extraResources` 加 companion/skills/prompts 三项；mac entitlements 引用占位 |
| `apps/desktop/package.json` | ✅ 改 | scripts 加 `prepare:companion`；`pack` / `pack:dir` 链路接入 |
| `scripts/prepare-desktop-web.mjs` | ✅ 改 | 复制 Next standalone 时保留 pnpm 相对 symlink，并将 `web/node_modules/next` 实体化，避免 macOS app bundle 内出现指向仓库的绝对 symlink |
| `apps/desktop/src/main/companion-supervisor.ts` | ✅ 改 | `findCompanionBinary()` → `findCompanionBundle()` 返回 `SidecarLayout`；`trySpawnSidecar()` 改 `process.execPath` + ENV 注入 |
| `apps/desktop/build/entitlements.mac.plist` | ✅ 新增 | `network.server/client`、`allow-jit`、`inherit` 等；当前 `hardenedRuntime: false` 不生效，待签名时打开 |

---

## 4. 验收

| 项 | 状态 | 证据 |
|----|------|------|
| 4 套 tsc 干净（companion / desktop / runtime-core / web） | ✅ | 本批改动 0 新增错误 |
| `pnpm --filter @jlcresearch/companion bundle` 跑通 | ✅ | 产物 1.8MB；esbuild 仅 1 条已知 import.meta warning（runtime-core/paths.ts；用 ENV 兜底覆盖，不影响功能） |
| Bundle 真起 fastify 验证 | ✅ | `COMPANION_PORT=19477 node dist-bin/companion.cjs` 烟测通过：`Server listening at http://127.0.0.1:19477` |
| `prepare-companion-bundle.mjs` 跑通 | ✅ | `apps/desktop/resources/{companion,skills,prompts}/` 三目录到位 |
| supervisor 打包态走 bundle 路径 | ✅ | 打包态冷启动已验证：无 dev Companion 时启动 `.app`，sidecar 进程来自 `Contents/Resources/companion/companion.cjs` |
| `pnpm --filter @jlc/desktop pack:dir` → 生成解包产物 | ✅ | 2026-06-26 PASS，产物 `apps/desktop/release/mac-arm64/小窗.app`；已确认 `Contents/Resources` 包含 `web-standalone`、`companion/companion.cjs`、`skills`、`prompts` |
| 打包态内置 Companion 资源 | ✅ | `Contents/Resources/companion/companion.cjs` 存在，大小约 1.8MB；`skills` / `prompts` 已随 app bundle 进入包内 |
| Next standalone bundle symlink | ✅ | 首次 `pack:dir` 因 `web-standalone/web/node_modules/next` 被复制成指向仓库的绝对 symlink 导致 `codesign --verify` 失败；已通过实体化该入口修复 |
| `pnpm --filter @jlc/desktop pack:dir` → 装后即可用 | ✅ | 2026-06-26 冷启动 PASS：`open -n apps/desktop/release/mac-arm64/小窗.app` 后 `GET http://127.0.0.1:9477/v1/health` 返回 200，主进程拉起包内 `Resources/companion/companion.cjs` |
| 卸载清理 + 用户数据保留 | ⏳ 待手测 | 同上 |
| Gatekeeper / SmartScreen | ⏸ 推后 | 需 Apple Developer / Win EV 证书 |

---

## 5. 已知 / 故意推后

| 项 | 状态 | 处理 |
|----|------|------|
| Apple Developer 代码签名 + notarytool 公证 | ⏸ | entitlements 占位已写；接到证书后 `mac.hardenedRuntime: true` + `mac.identity` 即生效 |
| Windows Authenticode / EV 证书 | ⏸ | 同上需证书 |
| mac x64 / win arm64 | ⏸ | 当前 mac.target 仅 dmg、win.target 仅 nsis；arch 由 electron-builder 默认 |
| Linux 安装包 | ⏸ | roadmap §11 明确 Desktop Beta+ |
| Companion bundle 单独热更 | ❌ 不需要 | electron-updater（D1.5）替换整个 .app 时 extraResources 跟随更新 |
| esbuild `import.meta.url` warning | ⚠ 已知 | runtime-core/paths.ts 在 CJS 下 `import.meta.url` 为空；通过 supervisor 注入 `JLC_SKILLS_DIR/JLC_PROMPTS_DIR` ENV 覆盖，行为正确 |
| OpenSCAD runtime | ⚠ 已知 | 本机未准备完整 OpenSCAD runtime，`prepare-openscad-runtime.mjs` 写入 `MISSING_RUNTIME.md` marker；不影响 Companion bundle / Desktop Alpha 主链路 |

---

## 6. 后续手测清单（你本地跑）

```bash
# 1. 完整 bundle + prepare（pack 之前的所有前置）
cd D:/XIOACHUANGPRO/apps/desktop
pnpm prepare:companion
ls resources/companion resources/skills resources/prompts | head

# 2. 真打包（需 Electron 预构建，首次 ~200MB）
pnpm pack:dir            # 出 release/win-unpacked 或 release/mac
# 或
pnpm pack                # 出 release/小窗-Setup-0.1.0.exe / 小窗-0.1.0.dmg

# 3. 装 + 跑验证
#   - 装完启动小窗 → 顶栏 Badge 应直接绿（自动起 bundle）
#   - 不要先跑 pnpm companion:dev，验证"用户不感知 Companion 单独存在"
#   - 看托盘 tooltip "Companion: 已连接（内置）"
#   - 浏览器 GET http://127.0.0.1:9477/v1/health 应 200

# 4. 卸载验证
#   - Win: 控制面板卸载；mac: 拖 .app 进废纸篓
#   - 验证 ~/.jlcresearch/ 数据保留，bundle/skills/prompts 已清
```

---

## 7. 签名指引（D1.4 后续，本轮不做）

### 7.1 mac

```yaml
# electron-builder.yml
mac:
  hardenedRuntime: true
  identity: "Developer ID Application: <Your Org> (TEAMID)"
  notarize:
    teamId: TEAMID
```

环境变量：`APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD`（用 `xcrun notarytool store-credentials` 生成）。entitlements 已就位无需改。

### 7.2 Windows

```yaml
win:
  certificateFile: certs/your-cert.pfx  # 或 certificateSubjectName
```

环境变量：`CSC_LINK` / `CSC_KEY_PASSWORD`。EV 证书首选；普通 Authenticode 也能签但 SmartScreen 仍可能拦。

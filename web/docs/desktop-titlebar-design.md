# 桌面壳 — Windows 自定义标题栏设计（零菜单栏方案）

> 让 Windows 上的"系统标题栏 + 应用菜单栏 + 应用顶栏"三层合一为一行 36px。

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.1 |
| 创建日期 | 2026-06-04 |
| 修订日期 | 2026-06-04 |
| 状态 | **设计稿（待实现）** |
| **范围** | **仅 Windows / Linux**；macOS 维持现状不动 |
| 实现位置 | `apps/desktop/`（Electron 主进程）+ `web/src/components/layout/`（顶栏 React 组件） |
| 关联 | [桌面壳技术摘要](./desktop-shell.md)、[UI 设计规范-Claude 风格](../../docs/UI设计规范-Claude风格.md)、[文件夹导入](./folder-import-and-desktop-shell.md) |
| 适用版本 | Electron **33.4.11**（含 `titleBarOverlay` 完整支持） |

---

## 0. 范围声明

### 本文档**只解决**

- **Windows / Linux** 上 Electron 默认会画出来的"系统标题栏 + File/Edit/View/Window/Help 菜单栏"两层冗余
- 让窗口顶部只剩**一行 36px** 的应用顶栏，与下方对话/工作区无缝衔接
- 系统三件套（最小化/最大化/关闭）保留为原生绘制，按主题染色

### 本文档**不动**

- **macOS** 桌面壳：屏幕顶栏菜单（`小窗 / 编辑 / 视图 / 窗口` 由 `apps/desktop/src/main/brand.ts:53-75` 注入）保留；交通灯保留；窗口内顶栏维持现有 `ChatTopBar` 行为
  - 原因：Apple HIG 要求应用菜单必须在屏幕顶栏；交通灯必须由系统绘制。Mac 端**已经没有冗余菜单栏问题**，强行改造反而违背 Mac 用户习惯。
- 浏览器（非 Electron）打开的 `web/`：顶栏行为完全不变

### 跨平台接缝

`DesktopTitleBar` 组件在渲染时检测 `window.electronAPI.platform`：
- `win32` / `linux` → 渲染本文档定义的自定义标题栏外壳
- `darwin` → **直接 return children**，不渲染外壳，让 macOS 走原 ChatTopBar 路径
- 非 Electron → 同 `darwin`

---

## 1. TL;DR

- Windows 上**不画**应用菜单栏（`File / Edit / View / Window / Help`）。
- 应用顶栏 `ChatTopBar` 升一级，**直接顶到窗口最上沿**，整体高度 36px。
- 系统三件套（最小化 / 最大化 / 关闭）由 Electron 的 `titleBarOverlay` 在右上角原生绘制，**仅** 给它配色（陶土系），不自绘。
- 顶栏左侧加品牌区（图标 + "小窗" 字样）作为视觉锚点 + 拖拽手柄；右侧给系统按钮预留 138px 安全区。
- "退出 / 重启 / 开发者工具 / 关于" 等达不到的能力通过 **侧栏底部用户菜单** 和 **快捷键**（`Ctrl+R`、`Ctrl+Shift+I`、`F11`）补足。

---

## 2. 现状与问题（仅 Windows）

### 2.1 现在长什么样

```
┌─ 系统标题栏（Win11，深灰，30px 高，Electron 默认画出来的）─── ─ ▢ ✕ ┐
│ 小窗                                                                   │
├─ 应用菜单栏（Electron 自动注入的 default menu，28px 高）───────────┤
│ File(F)  Edit(E)  View(V)  Window(W)  Help(H)                        │
├─ ChatTopBar（React，48px 高）───────────────────────────────────────┤
│ ☰   会话标题             ● claude · default      ⚙ 👤            │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 三个具体问题

| # | 问题 |
|---|------|
| P1 | **三层堆叠浪费 78px 垂直空间**（系统 30 + 菜单 28 + 顶栏 48）。13 寸笔记本上对话区被压扁。 |
| P2 | 三层颜色互不相干：系统标题栏深灰、菜单栏白底、ChatTopBar 羊皮纸 — **未经设计的撞色**。 |
| P3 | 默认菜单含 `Reload` / `Toggle DevTools` 等开发态项，**研究员侧不应可见**。 |

### 2.3 macOS 上对应的现状（对比 — 不动）

```
═══ 屏幕顶栏（系统画的，独立于窗口）═══════════════════════════════════════
 🍎 小窗  编辑  视图  窗口                              🔋 📶 控制中心 ⏰
═══════════════════════════════════════════════════════════════════════
┌─ 窗口（圆角 + 大阴影）────────────────────────────────────────────────┐
│ ●●●         会话标题            ● claude · default     ⚙ 👤          │  ChatTopBar 48px
├──────────────────────────────────────────────────────────────────────┤
│ 内容区                                                                │
└──────────────────────────────────────────────────────────────────────┘
```

Mac 端已经"应用菜单 + 交通灯都由系统画 + 没有窗口内菜单栏"，**没有 P1/P2/P3 任何一个问题**。所以 Mac **不需要改**。

---

## 3. 三个候选方案对比（Windows）

| | A. 完全无边框 `frame:false` | B. **`titleBarStyle:'hidden' + titleBarOverlay`** | C. 默认系统标题栏 |
|---|---|---|---|
| 代表产品 | 早期 VS Code、Figma | **现 VS Code、GitHub Desktop、Discord、Microsoft Teams、Cursor** | 老旧 Electron 项目 |
| 我们画什么 | 整条标题栏 + 三件套 + 拖拽 + 双击最大化 + 边缘 resize hit-test | 顶栏内容 + 颜色 token；系统按钮由 OS 画 | 不画 |
| 工作量 | 高（自绘三件套 + Win11 Snap Layouts hover 兼容） | **低**（一段 Electron 配置 + 一段 CSS） | 0 |
| Win11 Snap Layouts（鼠标悬停最大化键弹半屏布局菜单） | 需手动调 `WM_NCHITTEST` 才支持 | **原生支持**（`titleBarOverlay` 由 OS 绘制） | 原生支持 |
| 与暖色主题融合度 | 完全可控 | 颜色按 token 染色，按钮形态系统统一 | 灰白系统色，与暖色背景割裂 |
| 风险 | 高（hit-test bug、双击最大化、跨 OS 行为差异） | 低（Electron 33 稳定 API） | 无 |

**选 B**。这是 Electron 26+ 在 Windows 11 上的官方推荐做法，叫 **Window Controls Overlay (WCO)**。

---

## 4. 目标视觉（Windows 11）

```
┌────────────────────────────────────────────────────────────────────────┐
│ 🪟 小窗               Q1 农产品研报             ● claude · default  ⚙ 👤  │── ▢ ✕
│ └── 品牌锚点 ──┘└──── 居中区（标题/Tab）────┘└──── 顶栏右侧 ────┘└─系统按钮─┘
│ ↑                                                                  ↑
│ 整条 36px，背景 var(--surface) 羊皮纸；除按钮/菜单外都是 app-region: drag
│                                                                  systemColor
│                                                                  陶土染色
├──────────── ChatTopBar 与窗口顶沿合一，下面是侧栏 + 工作区 ────────────┤
│ ☰        对话                                                         │
│ 📁                                                                    │
└────────────────────────────────────────────────────────────────────────┘
```

**关键尺寸：**

| 项 | 值 | 备注 |
|---|---|---|
| 标题栏总高 | **36px** | 与 ChatTopBar 现 48px 折中：节省垂直空间 + 系统按钮命中区 ≥ 32px 触摸友好 |
| 系统按钮区右侧预留 | **138px** | Electron 33 在 Win11 上的实测宽度，3 个按钮各 46px |
| 左侧品牌锚点 | **52px** | 图标 16 + 间距 12 + 文字 24 |
| 中右间距 | ≥ **16px** | 居中区与右侧控件区之间的呼吸 |

> **macOS 上对应的尺寸**（不在本设计范围，仅备查）：左侧让 78px 给交通灯；右侧不预留（无系统按钮）；不画品牌锚点（屏幕顶栏菜单已显示"小窗"）。

---

## 5. 设计令牌

新增 `web/src/app/globals.css`（与现有暖色 token 系列对齐）：

```css
:root {
  /* 桌面壳 — 自定义标题栏 */
  --titlebar-h: 36px;                              /* 标题栏总高 */
  --titlebar-bg: var(--surface);                   /* 羊皮纸主色，与顶栏融合 */
  --titlebar-fg: var(--fg);                        /* 主文案 */
  --titlebar-fg-muted: var(--fg-tertiary);         /* 状态文字 */
  --titlebar-border: var(--border);                /* 与下方分区一致 */

  /* Windows 系统按钮（由 Electron titleBarOverlay 消费）*/
  --titlebar-overlay-color: #faf9f5;               /* 按钮所在条带底色 = surface */
  --titlebar-overlay-symbol: #5e5d59;              /* 按钮图标颜色 = fg-secondary */

  /* Windows 系统按钮避让区 */
  --titlebar-win-trailing: 138px;                  /* 3 × 46px */
}

@media (prefers-color-scheme: dark) {
  :root {
    --titlebar-overlay-color: #2a2a2a;
    --titlebar-overlay-symbol: #d4d4d4;
  }
}
```

**铁律**：`titleBarOverlay.color / symbolColor` 在 Electron 里是**字符串字面量**，不能写 CSS 变量。需要在主进程通过 `nativeTheme.shouldUseDarkColors` 切换两套写死的色值（详见 §6.1 改动 3）。

---

## 6. 主进程改造（仅 Windows / Linux 分支）

### 6.1 `apps/desktop/src/main/index.ts` 修改点

#### 改动 1 — 创建窗口时声明自定义标题栏

```diff
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: APP_DISPLAY_NAME,
    ...(icon ? { icon } : {}),
+   titleBarStyle: "hidden",                  // 隐藏默认标题栏（mac/win/linux 通用）
+   ...(process.platform !== "darwin"
+     ? {
+         titleBarOverlay: {                  // ← 仅 win/linux：系统按钮原生绘制
+           color: "#faf9f5",                 //   surface · 羊皮纸
+           symbolColor: "#5e5d59",           //   fg-secondary
+           height: 36,
+         },
+       }
+     : {}),                                  //   ← mac 不传 titleBarOverlay
+                                             //     `titleBarStyle: 'hidden'` 在 mac 上
+                                             //     已自动保留交通灯
    webPreferences: { ... },
  });
```

> ✅ Electron 文档：`titleBarOverlay` 要求 `titleBarStyle ≠ 'default'`，且仅 `color/symbolColor/height` 三个键。`color/symbolColor` 接受 `#RRGGBB | #RRGGBBAA | rgba() | hsla()`。

> ✅ macOS 上同样设了 `titleBarStyle: 'hidden'`，但**交通灯由系统自动保留在左上角**，且不传 `titleBarOverlay` 就不会去画 Win 风格按钮。这是 Electron 跨平台一致 API 的"自动正确"行为。

#### 改动 2 — 仅 Windows / Linux 隐藏默认菜单

`apps/desktop/src/main/brand.ts` 的 `installDesktopBranding()`：

```diff
 export function installDesktopBranding(): void {
   app.setName(APP_DISPLAY_NAME);
   if (process.platform === "darwin") {
     applyBrandIcon();
     Menu.setApplicationMenu(Menu.buildFromTemplate(buildMacMenu()));
+    // ↑ macOS 不动：屏幕顶栏菜单保留
+  } else {
+    // Windows / Linux：用 visible:false 的菜单项保留快捷键 accelerator，
+    // 但菜单栏不可见。详见 §8 键盘可访问性。
+    registerHiddenAccelerators();
+  }
 }
```

#### 改动 3 — 跟随系统主题切换 overlay 配色（V1.1，可选）

```ts
// apps/desktop/src/main/index.ts
import { nativeTheme } from "electron";

function applyOverlayTheme(win: BrowserWindow) {
  if (process.platform === "darwin") return;       // ← Mac 跳过
  win.setTitleBarOverlay({
    color: nativeTheme.shouldUseDarkColors ? "#2a2a2a" : "#faf9f5",
    symbolColor: nativeTheme.shouldUseDarkColors ? "#d4d4d4" : "#5e5d59",
    height: 36,
  });
}

nativeTheme.on("updated", () => {
  for (const win of BrowserWindow.getAllWindows()) applyOverlayTheme(win);
});
```

MVP **不做**这步，固定浅色。

### 6.2 新建 `apps/desktop/src/main/shortcuts.ts`

```ts
import { Menu, type MenuItemConstructorOptions } from "electron";

/**
 * Windows / Linux：菜单栏不可见，但保留 accelerator。
 * 这样 Ctrl+R / Ctrl+Shift+I / F11 / Ctrl+± / Ctrl+Q 等照常工作。
 */
export function registerHiddenAccelerators(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "_invisible_",
      submenu: [
        { role: "reload", visible: false },
        { role: "forceReload", visible: false },
        { role: "toggleDevTools", visible: false },
        { role: "zoomIn", visible: false },
        { role: "zoomOut", visible: false },
        { role: "resetZoom", visible: false },
        { role: "togglefullscreen", visible: false },
        { role: "quit", visible: false },
        { role: "undo", visible: false },
        { role: "redo", visible: false },
        { role: "cut", visible: false },
        { role: "copy", visible: false },
        { role: "paste", visible: false },
        { role: "selectAll", visible: false },
      ],
    },
  ];
  // visible:false 的项不会渲染到菜单栏，但 accelerator 仍激活
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
```

### 6.3 Preload 暴露平台标记

`apps/desktop/src/preload/preload.cjs`：

```diff
 contextBridge.exposeInMainWorld("electronAPI", {
   isDesktop: true,
+  platform: process.platform,             // "win32" | "darwin" | "linux"
   pickAndImportFolder: () => ipcRenderer.invoke("desktop:pick-and-import"),
   getCompanionHealth: () => ipcRenderer.invoke("desktop:companion-health"),
   showItemInFolder: (input) => ipcRenderer.invoke("desktop:show-item-in-folder", input),
 });
```

> 渲染层用这个字段判断该不该渲染 `DesktopTitleBar` 外壳。Mac 上 `platform === 'darwin'` → 不渲染外壳。

---

## 7. 渲染层改造

### 7.1 新增 `web/src/components/layout/DesktopTitleBar.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand/BrandMark";

type Platform = "win32" | "darwin" | "linux" | null;

/**
 * 桌面壳标题栏外壳。
 *
 * 行为分支：
 * - Windows / Linux：渲染 36px 高的自定义标题栏，含品牌锚点 + children + 系统按钮避让
 * - macOS：直接 return children（让原 ChatTopBar 走 `titleBarStyle:'hidden'` 自动保留交通灯的路径）
 * - 浏览器：直接 return children（无桌面壳概念）
 */
export function DesktopTitleBar({ children }: { children: React.ReactNode }) {
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.isDesktop) setPlatform(api.platform ?? "win32");
  }, []);

  // macOS 或浏览器：不渲染外壳
  if (platform === "darwin" || platform === null) {
    return <>{children}</>;
  }

  // Windows / Linux：渲染自定义标题栏
  return (
    <div
      className="flex h-[var(--titlebar-h,36px)] shrink-0 items-stretch border-b border-[var(--titlebar-border)] bg-[var(--titlebar-bg)]"
      style={{ WebkitAppRegion: "drag", userSelect: "none" } as React.CSSProperties}
    >
      {/* 左侧品牌锚点 */}
      <div className="flex items-center gap-2 px-3 text-sm text-[var(--titlebar-fg)]">
        <BrandMark size={16} />
        <span className="font-display tracking-tight">小窗</span>
      </div>

      {/* 中央 + 右侧由 children 提供（ChatTopBar.center / right） */}
      <div className="flex min-w-0 flex-1 items-center">{children}</div>

      {/* 右侧系统按钮避让区 */}
      <div style={{ width: "var(--titlebar-win-trailing)" }} aria-hidden />
    </div>
  );
}
```

### 7.2 `ChatTopBar` 适配

在 `web/src/components/layout/AppShell.tsx` 中包裹：

```diff
- <header ... ChatTopBar ...>
+ <DesktopTitleBar>
+   <ChatTopBar
+     left={left}
+     center={center}
+     right={right}
+     sidebarCollapsed={sidebarCollapsed}
+     embedded               // ← 新 prop：嵌入桌面标题栏时禁用自身 border-b 与 px
+   />
+ </DesktopTitleBar>
```

`ChatTopBar` 改一行：

```diff
- <header className={`grid ${MAIN_TOP_BAR_CLASS} shrink-0 ... border-b border-[var(--border)] bg-[var(--surface)] pr-6 ...`}>
+ <header className={`grid ${MAIN_TOP_BAR_CLASS} shrink-0 ... ${embedded ? "" : "border-b border-[var(--border)] bg-[var(--surface)]"} pr-6 ...`}>
```

> Windows 上 `border-b` 与 `bg` 由外层 `DesktopTitleBar` 提供；mac/浏览器上仍走 ChatTopBar 自身样式。

### 7.3 `app-region` 拖拽契约

| 元素 | `app-region` | 备注 |
|---|---|---|
| `DesktopTitleBar` 整个容器 | `drag` | 默认所有区域可拖拽 |
| ChatTopBar 内的按钮（`☰`、`⚙`、`👤`、Agent 状态徽章） | `no-drag` | 必须显式标记，否则按钮**收不到点击事件** |
| 会话标题文本 | `drag` + `user-select: none` | 防止拖拽时误选文字 |
| 输入框（如顶栏内有搜索） | `no-drag` + 显式 `user-select: text` |  |

**实现方式**：定义一个 utility class：

```css
@layer utilities {
  .no-drag {
    -webkit-app-region: no-drag;
    app-region: no-drag;
  }
}
```

用法：每个按钮加 `<button className="no-drag ...">`。

---

## 8. 行为细节（Windows）

### 8.1 拖拽与最大化

- **单击 + 拖拽** 标题栏空白区 → 移动窗口（系统行为）
- **双击** 标题栏空白区 → 在最大化与还原间切换（系统行为）
- **拖拽到屏幕顶沿** → Win11 Snap Layouts 自动触发
- **悬停最大化按钮** → Win11 Snap Layouts 半屏布局菜单弹出（系统行为，`titleBarOverlay` 保留）

### 8.2 文字选择冲突

Electron 文档明确："when you drag the title bar, you may accidentally select its text contents"。两条对策：
1. `DesktopTitleBar` 容器 `user-select: none`（已加）
2. 居中区如果是可点击会话标题（点开重命名），把它包成 `no-drag` + `cursor: pointer`

### 8.3 上下文菜单

Electron 文档警示："you should never use a custom context menu on draggable areas"（draggable 区域的右键菜单是系统的，不是渲染层的）。MVP **不**在标题栏区域加自定义右键菜单。

### 8.4 键盘可访问性（替代菜单栏的关键）

| 操作 | 快捷键 | 实现 |
|---|---|---|
| 退出 | `Ctrl+Q` | `role: 'quit'`（藏在 visible:false 菜单里） |
| 重新加载 | `Ctrl+R` | `role: 'reload'` |
| 强制刷新 | `Ctrl+Shift+R` | `role: 'forceReload'` |
| 缩放 | `Ctrl+±` / `Ctrl+0` | `role: 'zoomIn / zoomOut / resetZoom'` |
| 全屏 | `F11` | `role: 'togglefullscreen'` |
| 开发者工具 | `Ctrl+Shift+I` | `role: 'toggleDevTools'`（仅 `JLC_DESKTOP_DEVTOOLS=1` 时菜单可见） |
| 撤销/重做/剪切/复制/粘贴/全选 | 标准组合键 | `role: 'undo/redo/cut/copy/paste/selectAll'`（输入框聚焦时由浏览器原生支持，菜单 role 是兜底） |
| 打开项目 | `Ctrl+O` | 自定义 accelerator → `pickAndImportFolder` IPC（V1.1） |
| 新对话 | `Ctrl+N` | 自定义 accelerator → 渲染层事件（V1.1） |

> Windows 上虽然菜单栏不可见，**accelerator 全部生效**，因为 `Menu.setApplicationMenu` 注入的菜单项在底层仍参与快捷键匹配。这是这个方案的核心精髓 — "零菜单栏 + 全快捷键"。

### 8.5 被替代的菜单项 — 怎么补回来

| 原默认菜单 | 在新设计里的去处 |
|---|---|
| File → 新建对话 | 左侧栏顶部"新对话"按钮（已有） |
| File → 打开项目 | 左侧栏项目区"添加项目"按钮（已有，触发 `desktop:pick-and-import`） |
| File → 退出 | 用户菜单（侧栏底部 `UserSettingsMenu` 增"退出小窗"项）+ `Ctrl+Q` 快捷键 |
| Edit → 撤销/复制/粘贴等 | 输入框聚焦时浏览器原生支持，无需可见菜单 |
| View → 重新加载 | `Ctrl+R` + 用户菜单"重新加载"项 |
| View → 缩放 | `Ctrl+±` / `Ctrl+0` |
| View → 全屏 | `F11` |
| View → 开发者工具 | 仅 `JLC_DESKTOP_DEVTOOLS=1` 时生效 + `Ctrl+Shift+I` |
| Window → 最小化/最大化 | 系统三件套已有 |
| Help → 文档/反馈 | 用户菜单"关于与帮助"（已有 F-SET-007） |
| Help → 关于 | 同上 |

**结论**：Windows 端 `setApplicationMenu` 用不可见菜单替代后**没有真正功能损失**。

### 8.6 浏览器降级

`DesktopTitleBar` 检测到 `platform === null` 时返回 `<>{children}</>`，**完全不渲染外壳**。原 `ChatTopBar` 行为不变，浏览器用户看到的还是原来的样式 + 浏览器自带的标签页 / 地址栏。

### 8.7 macOS 自动跳过

`DesktopTitleBar` 检测到 `platform === 'darwin'` 时也返回 `<>{children}</>`，**完全不渲染外壳**。Mac 端的视觉 = `titleBarStyle: 'hidden'` 隐藏窗口标题文字 + 交通灯系统保留 + 屏幕顶栏菜单系统保留 + ChatTopBar 自身 48px。

---

## 9. 取舍与风险

### 9.1 与"显式画菜单栏（VS Code 同款）"相比，零菜单栏丢了什么

| 丢掉的 | 影响等级 | 缓解 |
|---|---|---|
| 可视化菜单（鼠标用户的发现性） | 中 | 用户菜单 (`UserSettingsMenu`) 收纳"重新加载、全屏、关于"，加锚点提示 |
| `Alt + F` 老 Windows 用户习惯 | 低 | 我们用户是研究员，非编辑器深度用户，习惯影响小 |
| 显示"当前编辑的文件名" | 不适用 | 我们的中心区已经显示会话标题，更贴产品场景 |

### 9.2 已知风险

| # | 风险 | 应对 |
|---|------|------|
| R1 | `titleBarOverlay.color` 不支持 CSS 变量，深色模式切换需要主进程介入 | MVP 固定浅色；深色模式排到 V1.1 时实现 §6.1 改动 3 |
| R2 | 36px 总高比 Electron 默认（Windows 11 通常 32px）略高，按钮区会出现 4px 上下留白 | 实测可接受；若强迫症可改为 32px，但点击命中区下降 |
| R3 | Linux 上 `titleBarOverlay` 在某些 GTK 主题下色彩偏移 | Linux 不在 MVP 交付范围（PRD §10.2），不处理；按 Windows 同代码路径走，体验 90% |
| R4 | 拖拽区误选文字 | `user-select: none` + 按钮 `no-drag`（已在 §8.2） |
| R5 | 渲染进程检测 `electronAPI.platform` 在打包态首屏可能晚于首次 Paint | 在 `<html>` 打 `data-desktop-pending` 属性，CSS 用它给标题栏一个 `min-height: 36px` 占位，避免布局抖动 |
| R6 | macOS 上不小心也加了 36px 占位 | `DesktopTitleBar` 第一行就 `if (platform === 'darwin') return <>{children}</>`，**Mac 完全走原路径**，不可能被影响 |

---

## 10. 实施步骤（约 1.5 人天）

| 步 | 工作 | 文件 | 工时 | 平台影响 |
|---|---|---|---|---|
| 1 | 主进程加 `titleBarStyle/titleBarOverlay`（含 mac 跳过 overlay 的分支） | `apps/desktop/src/main/index.ts` | 0.5h | win+mac+linux |
| 2 | `installDesktopBranding` 加 win/linux 分支调 `registerHiddenAccelerators` | `apps/desktop/src/main/brand.ts` | 0.3h | 仅 win/linux |
| 3 | 新建 `shortcuts.ts` 注册不可见 accelerator | `apps/desktop/src/main/shortcuts.ts` | 1h | 仅 win/linux |
| 4 | 扩展 preload 平台字段 | `apps/desktop/src/preload/preload.cjs` | 0.2h | 全平台 |
| 5 | 新增 CSS 令牌 | `web/src/app/globals.css` | 0.3h | 全平台（mac 不消费 win 令牌） |
| 6 | 新建 `DesktopTitleBar.tsx`（含 mac/浏览器跳过分支） | `web/src/components/layout/DesktopTitleBar.tsx` | 1.5h | 全平台 |
| 7 | `ChatTopBar` 加 `embedded` prop | `web/src/components/chat/ChatTopBar.tsx` | 0.3h | 全平台 |
| 8 | `AppShell` 包裹 | `web/src/components/layout/AppShell.tsx` | 0.3h | 全平台 |
| 9 | 给所有顶栏按钮挂 `no-drag` | 顶栏内按钮组件 | 1h | 仅 win/linux 有效 |
| 10 | `UserSettingsMenu` 增 "重新加载 / 全屏 / 退出" | `web/src/components/settings/UserSettingsMenu.tsx` | 1.5h | 全平台 |
| 11 | 三平台冒烟（Win11 / macOS / 浏览器） | — | 1h | — |
| 12 | 截图入 PRD §12.5.X 实现快照 | `PRD-小窗.md` | 0.3h | — |

**验收条件：**

| # | 项 | 平台 | 通过 |
|---|---|---|---|
| T1 | Win11 启动桌面壳，**无菜单栏可见**，标题栏与下方顶栏视觉合一 | Win | ⬜ |
| T2 | 拖拽标题栏空白区可移动窗口；双击可最大化/还原 | Win | ⬜ |
| T3 | 点击侧栏 ☰、设置 ⚙、用户头像 👤 均能响应（不被 drag 吞掉） | Win | ⬜ |
| T4 | `Ctrl+R` 重新加载、`Ctrl+Shift+I` 开发者工具、`F11` 全屏均可用 | Win | ⬜ |
| T5 | 系统三件套悬停 Snap Layouts 弹层正常 | Win | ⬜ |
| **T6** | **macOS 桌面壳：交通灯保留，屏幕顶栏菜单保留，ChatTopBar 不被推下，与未实施前完全一致** | **Mac** | **⬜** |
| T7 | 浏览器打开 `localhost:3000`：无 `DesktopTitleBar` 外壳，原 ChatTopBar 行为不变 | Web | ⬜ |

> **T6 是关键回归**：本次改造的核心承诺是"Mac 不动"，必须验证 Mac 视觉与改造前**完全一致**。如果 Mac 上出现任何变化（哪怕是高度多 4px），方案不通过。

---

## 11. 参考样本

| 产品 | 启发 |
|---|---|
| **Cursor** | "零菜单 + 极简标题栏 + 按钮收纳进侧栏"模式，与本设计**最接近** |
| **VS Code** | `titleBarOverlay` 原生方案的最大用户；零边距标题栏 + 状态信息一体化（这次我们没选 VS Code 风格的"显式菜单"，但底层 API 与它同源） |
| **GitHub Desktop** | Electron + `titleBarOverlay` 经典实现，标题栏融合标签栏与仓库选择器 |
| **Linear** / **Notion** / **Spotify** | 现代产品向"无菜单栏"过渡的典型，依赖快捷键 + 用户菜单替代 |
| **Microsoft Teams** | 微软自家 WCO（Window Controls Overlay）参考实现，给 Win11 暖色系产品如何与系统按钮融合做了样本 |

---

## 12. macOS 端不动的承诺（重要）

本次改造**完全不触碰**以下 macOS 行为：

| 行为 | 来源 | 是否变更 |
|---|---|---|
| 屏幕顶栏菜单"小窗 / 编辑 / 视图 / 窗口" | `apps/desktop/src/main/brand.ts:53-75` `buildMacMenu()` | ❌ 不变 |
| 交通灯红黄绿三色按钮位置与外观 | Electron `titleBarStyle: 'hidden'` 自动保留 | ❌ 不变 |
| Cmd+Q 退出 / Cmd+W 关闭窗口 / Cmd+M 最小化 | macOS 系统行为 + `role` 菜单 | ❌ 不变 |
| Dock 图标 | `applyBrandIcon()` | ❌ 不变 |
| `app.on('window-all-closed')` 不退出（Mac 习惯） | `apps/desktop/src/main/index.ts:152-155` | ❌ 不变 |
| ChatTopBar 在 macOS 上的 48px 高度与样式 | `DesktopTitleBar` 在 mac 直接 return children | ❌ 不变（视觉 100% 一致） |

如果你在 Mac 上看到 ChatTopBar 高度变化、交通灯位置偏移、菜单消失等任何变化，**这是 bug，不是设计**。

---

## 13. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.1 | 2026-06-04 | **明确范围仅 Windows / Linux**；Mac 全部行为承诺不变；新增 §0 范围声明、§2.3 macOS 现状对比、§12 Mac 不动承诺；T6 升级为关键回归项 |
| v1.0 | 2026-06-04 | 初版：零菜单栏方案；`titleBarOverlay` + 隐藏 accelerator + 用户菜单收纳 |

*文档结束*

# 小窗 — UI 设计规范（Claude 风格）

> 产品：**小窗** — 未来办公场景（works）智能工作台。

| 属性 | 内容 |
|------|------|
| 文档版本 | v1.1 |
| 创建日期 | 2026-05-19 |
| 设计系统来源 | Open Design `claude` + Craft 规则 |
| 适用产品 | 小窗（**MVP v3.0 以对话 + 桌面壳为主**；全模块 B2B SaaS） |
| 关联文档 | [PRD-小窗.md](../PRD-小窗.md)（v3.6.7）、[workspace-architecture.md](../web/docs/workspace-architecture.md) |

> **说明**：本规范学习 Anthropic Claude 产品的视觉气质（暖色羊皮纸、编辑感衬线标题、环状阴影），**不是**官方品牌资产。主强调色采用 Claude **陶土色** `#c96442`（Terracotta），用于 CTA、选中态与品牌标识；`--accent-warm` 为珊瑚色 `#d97757` 辅助点缀。

---

## 1. 设计原则

### 1.1 气质定位

| 维度 | 目标 | 避免 |
|------|------|------|
| 情绪 | 可信、从容、像在读一份研究简报 | 冷峻「AI 科技感」、霓虹渐变 |
| 排版 | 衬线标题 + 无衬线界面，杂志式留白 | 全站 Inter、满屏卡片栅格 |
| 色彩 | 全暖中性灰，单一强调色 | 冷蓝灰、Tailwind 默认 indigo |
| 深度 | 环状描边阴影 + 浅色分层 | 重投影、左侧色条卡片 |
| 信息 | 以主工作流为中心（对话 → 溯源 → 导出） | 装饰性指标、emoji 功能图标 |

### 1.2 Open Design 执行约束（摘要）

- **每屏可见强调色 ≤ 2 处**（如：一个标签 + 一个主按钮）。
- **正文对比度 ≥ 4.5:1**；大号标题 ≥ 3:1。
- **有数据的界面必须覆盖五态**：加载、空、错、有数据、边界（长文本 / 大量行）。
- **禁止 AI 模板感**：默认 indigo 渐变、emoji 图标、虚构「10× 更快」等指标。

---

## 2. 设计令牌（Design Tokens）

实现时**只在本节定义原始色值**，组件一律引用 CSS 变量。

### 2.1 色彩

#### 中性色（暖调，禁止冷蓝灰）

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg` | `#f5f4ed` | 页面主背景（羊皮纸） |
| `--surface` | `#faf9f5` | 卡片、侧栏、输入区底色（象牙） |
| `--surface-elevated` | `#ffffff` | 最高层级浮层、主按钮白底变体 |
| `--fg` | `#141413` | 主文案（暖黑，非纯黑） |
| `--fg-secondary` | `#5e5d59` | 正文、说明 |
| `--fg-tertiary` | `#87867f` | 元数据、时间戳、占位 |
| `--fg-muted` | `#b0aea5` | 深色区块上的次要字 |
| `--border` | `#f0eee6` | 默认描边 |
| `--border-strong` | `#e8e6dc` | 分区线、表头底边 |

#### 品牌与强调

| Token | 色值 | 用途 |
|-------|------|------|
| `--accent` | `#c96442` | **主 CTA**、关键操作、选中态（Claude 陶土色） |
| `--accent-hover` | `#b85c3d` | 主按钮悬停 |
| `--accent-muted` | `#f5ebe6` | 标签底、弱强调背景 |
| `--accent-warm` | `#d97757` | 插图/空状态等次级暖色点缀（珊瑚色） |
| `--accent-coral` | `#d97757` | 深色背景上的链接/次要强调（同珊瑚色） |

#### 语义色

| Token | 色值 | 用途 |
|-------|------|------|
| `--success` | `#2d6a4f` | 成功、已同步 |
| `--warn` | `#b45309` | 警告、待确认 |
| `--danger` | `#b53333` | 错误、删除（Claude 暖红） |
| `--focus` | `#3898ec` | **仅**用于 focus-visible 环（唯一冷色，无障碍） |

#### 深色区块（侧栏折叠态、代码块、全宽 footer）

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-dark` | `#141413` | 深色章节背景 |
| `--surface-dark` | `#30302e` | 深色卡片、深色按钮底 |
| `--border-dark` | `#30302e` | 深色描边 |

### 2.2 字体

Claude 使用 Anthropic Serif / Sans；本项目中文字体回退方案如下：

| Token | 字体栈 | 用途 |
|-------|--------|------|
| `--font-display` | `"Source Han Serif SC", "Noto Serif SC", Georgia, serif` | 页面标题、模块名、报告封面标题 |
| `--font-ui` | `var(--font-geist-sans), "PingFang SC", "Microsoft YaHei", system-ui, sans-serif` | 导航、按钮、表格、表单 |
| `--font-mono` | `ui-monospace, "SF Mono", Menlo, monospace` | 代码、数据字段、溯源 ID |

**字重纪律（三档）**

| 档位 | 字重 | 场景 |
|------|------|------|
| Read | 400 | 正文、对话气泡内容 |
| Emphasize | 500 | 导航、标签、表头 |
| Announce | 600 | 主按钮、关键数字（少用 700） |

**衬线标题统一 500**，不用 700 加粗标题。

### 2.3 字号阶梯（1.25 倍率，最多 8 档）

| Token | 桌面 | 移动 | 行高 | 字间距 | 字体 |
|-------|------|------|------|--------|------|
| `--text-display` | 48px | 32px | 1.1 | -0.02em | display |
| `--text-h1` | 32px | 24px | 1.15 | -0.01em | display |
| `--text-h2` | 24px | 20px | 1.2 | 0 | display |
| `--text-h3` | 20px | 18px | 1.25 | 0 | display |
| `--text-body` | 16px | 16px | 1.6 | 0 | ui |
| `--text-body-lg` | 17px | 17px | 1.6 | 0 | ui |
| `--text-small` | 14px | 14px | 1.5 | 0.01em | ui |
| `--text-caption` | 12px | 12px | 1.5 | 0.02em | ui |
| `--text-overline` | 11px | 11px | 1.4 | **0.08em** | ui，全大写 |

正文最大行宽：`max-width: 65ch`。

### 2.4 间距（8px 基准）

| Token | 值 |
|-------|-----|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 24px |
| `--space-6` | 32px |
| `--space-7` | 48px |
| `--space-8` | 64px |
| `--space-section` | 80px（模块间垂直节奏） |

### 2.5 圆角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 6px | 小标签 |
| `--radius-md` | 8px | 次要按钮、标准卡片 |
| `--radius-lg` | 12px | 主按钮、输入框 |
| `--radius-xl` | 16px | 对话面板、预览区 |
| `--radius-2xl` | 24px | 大卡片、嵌入预览 |

禁止按钮/卡片使用 `< 6px` 尖角。

### 2.6 阴影与层级

优先 **ring 阴影**（像描边一样柔和），少用重 drop-shadow。

```css
/* 交互环 — 按钮默认 */
--shadow-ring: 0 0 0 1px var(--ring, #d1cfc5);

/* 悬停环 */
--shadow-ring-hover: 0 0 0 1px var(--ring-strong, #c2c0b6);

/* 卡片轻抬升 */
--shadow-whisper: 0 4px 24px rgba(0, 0, 0, 0.05);

/* 按下内凹 */
--shadow-inset: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
```

| 层级 | 处理 | 场景 |
|------|------|------|
| L0 | 无阴影 | 页面 `--bg` |
| L1 | `1px solid var(--border)` | 列表行、侧栏分区 |
| L2 | `--shadow-ring` | 按钮、可点击卡片 |
| L3 | `--shadow-whisper` | 浮层、研报预览 |
| L4 | `--shadow-inset` | 按下态 |

---

## 3. 布局与信息架构

### 3.1 应用壳层（与现有原型一致）

```
┌─────────────┬──────────────────────────────────┐
│  Sidebar    │  SubNav（模块内 Tab）              │
│  模块导航    ├──────────────────────────────────┤
│             │  主工作区（对话 / 表格 / 编辑器）   │
│             │                                  │
└─────────────┴──────────────────────────────────┘
```

| 区域 | 背景 | 宽度 |
|------|------|------|
| Sidebar | `--surface` + 右边框 `--border` | 展开 240px / 折叠 56px |
| SubNav | `--bg` | 全宽，高 48px |
| 主区 | `--bg` 或 `--surface`（按模块） | `flex-1`，`min-w-0` 防溢出 |

### 3.2 内容宽度

| 场景 | max-width |
|------|-----------|
| 对话 / 研报阅读 | 720px（居中） |
| 表格 / 知识库列表 | 100%（表格可横向滚动） |
| 营销/说明页（若有） | 1200px |

### 3.3 响应式断点

| 名称 | 宽度 | 变化 |
|------|------|------|
| sm | <640px | 侧栏抽屉化；标题降一级 |
| md | 640–991px | 双列可选 |
| lg | ≥992px | 完整三栏心智（侧栏+子导航+主区） |

触控目标最小 **44×44px**。

---

## 4. 组件规范

### 4.1 按钮

#### 层级

| 类型 | 背景 | 文字 | 边框/阴影 | 使用场景 |
|------|------|------|-----------|----------|
| Primary | `--accent` | `#faf9f5` | ring | 每屏最多 1 个主操作（生成报告、发送） |
| Secondary | `--border-strong`（`#e8e6dc`） | `--fg` | ring | 导出、次要确认 |
| Ghost | transparent | `--fg-secondary` | 无 | 工具栏、表格行内 |
| Danger | `--danger` | `#fff` | ring | 删除知识库条目 |
| Dark | `--surface-dark` | `--fg-muted` | ring | 深色区块内 |

#### 尺寸

| 尺寸 | 高 | 水平 padding | 字号 |
|------|-----|--------------|------|
| sm | 32px | 12px | 14px |
| md | 40px | 16px | 15px |
| lg | 44px | 20px | 16px |

#### 状态

| 状态 | 表现 |
|------|------|
| default | `--shadow-ring` |
| hover | 背景加深 4–6%；`--shadow-ring-hover` |
| active | `--shadow-inset` |
| focus-visible | `outline: 2px solid var(--focus); outline-offset: 2px` |
| disabled | opacity 0.45；`pointer-events: none` |
| loading | 文案隐藏，左侧 16px spinner；宽度不变 |

### 4.2 输入框与表单

| 属性 | 值 |
|------|-----|
| 背景 | `--surface-elevated` 或 `--surface` |
| 边框 | `1px solid var(--border-strong)` |
| 圆角 | `--radius-lg`（12px） |
| 字号 | 16px（防 iOS 缩放） |
| 占位符 | `--fg-tertiary` |

**校验时机**：失焦后校验；修正后立即清除错误文案。

| 状态 | 边框 | 辅助文案 |
|------|------|----------|
| default | `--border-strong` | 可选 hint，`--fg-tertiary` |
| focus | `--focus` ring | — |
| error | `--danger` | `--danger`，说明原因 + 如何修复 |
| disabled | `--border` | 背景 `--bg` |

### 4.3 侧栏导航（Sidebar）

| 元素 | 样式 |
|------|------|
| 项默认 | `--fg-secondary`，15px，`--font-ui`，圆角 8px，高 40px |
| 项 hover | 背景 `#ebe9e0`（暖灰，对应当前 `--sidebar-hover` 的暖化） |
| 项 active | 背景 `--accent-muted`，文字 `--accent`，字重 500 |
| 分组标题 | `--text-overline`，`--fg-tertiary` |
| 折叠图标 | 1.5px 描边 SVG，`currentColor` |

### 4.4 子导航 Tab（SubNav）

- 下划线式或胶囊式二选一，**全站统一**。
- 推荐胶囊：未选 `--fg-secondary`；选中 `--fg` + 底 `--surface-elevated` + `--shadow-ring`。
- **不用** 底部 3px 纯 `--accent` 粗线（易与主 CTA 抢强调色）。

### 4.5 对话（Chat）

| 元素 | 规范 |
|------|------|
| 用户气泡 | `--surface-elevated`，右对齐，圆角 `--radius-xl`，最大宽 85% |
| 助手气泡 | 透明或 `--surface`，左对齐，衬线仅用于「报告摘要」标题句 |
| 溯源引用 | 12px，`--accent` 下划线，hover 显示信源卡片 |
| 输入区 |  sticky 底， `--surface` 容器 + `--shadow-whisper` |
| 空状态 | 衬线 H2「开始你的研究问题」+ 3 个示例 prompt（Ghost 按钮） |

### 4.6 表格（研报列表、知识库）

| 元素 | 规范 |
|------|------|
| 表头 | 12px overline 或 14px 500，`--fg-tertiary`，底边 `--border-strong` |
| 行高 | 48px（可点击行 52px） |
| 行 hover | 背景 `rgba(20, 20, 19, 0.03)` |
| 行选中 | 左侧 2px `--accent` **或** 整行 `--accent-muted`（二选一，禁止「圆角卡+左边色条」） |
| 空状态 | 图标用 1.6px 线稿 SVG，不用 emoji |

### 4.7 卡片（研报预览、报告块）

```
背景: var(--surface)
边框: 1px solid var(--border)
圆角: var(--radius-md) ~ var(--radius-xl)
内边距: var(--space-5) ~ var(--space-6)
标题: var(--font-display) var(--text-h3) 500
正文: var(--text-body) var(--fg-secondary)
```

### 4.8 标签 / Badge

| 类型 | 背景 | 文字 |
|------|------|------|
| 默认 | `--border-strong` | `--fg` |
| 品牌 | `--accent-muted` | `--accent` |
| 成功 | `#e8f5e9` | `--success` |

字号 12px，padding 2px 8px，圆角 `--radius-sm`。

### 4.9  Toast / 内联提示

- 成功/警告/错误各用语义色左边 3px 条 + 中性底，**不用** 全屏色块 Toast。
- 自动消失 5s；错误需手动关闭。

---

## 5. 图标与插图

| 规则 | 说明 |
|------|------|
| 图标 | 1.5–1.75px 描边，单色 `currentColor`，24×24 视口 |
| 禁止 | emoji 作为功能图标（🚀✨等） |
| 插图 | 可选抽象线稿/暖色块面；与 Claude 一样避免 3D 科技风 |
| 产品截图 | 圆角 `--radius-xl`，`--shadow-whisper` |

---

## 6. 状态覆盖（必做清单）

以下每个界面在交付前须具备原型或标注：

| 模块 | 加载 | 空 | 错误 | 有数据 | 边界 |
|------|------|-----|------|--------|------|
| 对话 | 骨架气泡 | 示例问题 | 发送失败条 | 多轮对话 | 超长 Markdown、无溯源 |
| 研报列表 | 表格骨架 | 无研报 CTA | 拉取失败 | 分页列表 | 标题 200 字 |
| 知识库 | 卡片骨架 | 上传引导 | 解析失败 | 文件列表 | 单文件超大 |
| 报告生成 | 步骤条 loading | 未选模板 | 生成超时 | 预览 | 章节极多 |

**表单额外三态**：未触碰 / 已修改合法 / 提交等待。

加载超过 15s 显示「耗时较长，可稍后查看历史」。

---

## 7. 无障碍基线

| 项 | 要求 |
|----|------|
| 对比度 | 正文 4.5:1；大字 3:1；图标/UI 3:1 |
| 焦点 | 所有可交互元素可见 `focus-visible`，禁止 `outline: none` |
| 键盘 | Tab 顺序与视觉一致；Esc 关闭弹层 |
| 动效 | `prefers-reduced-motion` 时关闭非必要动画 |
| 表单 | `label` 关联；错误用 `aria-invalid` + `aria-describedby` |

---

## 8. 反模式（禁止）

1. 主色使用 Tailwind 默认 indigo（`#6366f1` 等）。
2. Hero 紫蓝渐变背景。
3. 圆角卡片 + 左侧 4px 彩色竖条（AI Dashboard 模板）。
4. 同屏超过 2 处 `--accent` 实心填充。
5. 虚构业务指标（「效率提升 300%」）。
6. 标题用 sans + 700 粗体堆砌。
7. 冷灰侧栏（`#6b7280` 系）与暖正文混搭 — **全站灰度统一暖调**。
8. 纯黑 `#000` / 纯白 `#fff` 作为页面底 — 用 `--bg` / `--fg`。

---

## 9. 与现有代码的映射

当前 `web/src/app/globals.css` 建议逐步迁移为：

```css
:root {
  /* 背景与表面 */
  --background: var(--bg, #f5f4ed);
  --foreground: var(--fg, #141413);
  --surface: #faf9f5;
  --muted: #5e5d59;
  --border: #f0eee6;

  /* 侧栏 — 暖化 */
  --sidebar-bg: #faf9f5;
  --sidebar-hover: #ebe9e0;
  --sidebar-active: #f5ebe6;

  /* 品牌 */
  --brand: #c96442;
  --brand-muted: #f5ebe6;

  /* 语义 */
  --accent: var(--brand);
  --focus: #3898ec;
}
```

组件类名继续用 Tailwind，但颜色**只引用变量**，不在 JSX 中散落 hex。

---

## 10. 交付自检表（Craft Review）

发布前逐项勾选：

- [ ] 已声明设计系统：**Claude-inspired（陶土色强调）**
- [ ] 主工作流一眼可见（对话输入 / 生成 / 列表）
- [ ] 衬线仅用于标题层级，UI 控件全 sans
- [ ] 每屏 accent 实心 ≤ 2
- [ ] 五态齐全或已在 PRD 标注「下期」
- [ ] 移动端无文字重叠、侧栏可访问
- [ ] 无 indigo 渐变、无 emoji 图标、无假数据
- [ ] focus、对比度、表单 label 已检查

---

## 11. 工作区与项目展示（PRD §5.3.2.1b、§12.5.3）

### 11.1 绑定目录展示

| 场景 | 主文案 | 副文案 / 元数据 |
|------|--------|-----------------|
| 用户课题 | 课题 `name`（如「蒙电十五五」） | `pathSummary`：`~/Projects/…` |
| 平台默认（XIAOCHUANG） | 任务 `name` 或会话标题 | `pathSummary`：`~/Documents/XIAOCHUANG/会话/…` |
| Composer 草稿（未 ensure） | 「不绑定课题文件夹」 | 说明：发送后将创建默认工作区目录 |
| **禁止** | 长期显示「无项目」「临时工作区」 | 任务创建后须展示真实绑定 |

**ProjectWorkPicker / 项目行：**

- 选中态：课题名或「不绑定课题文件夹」
- 下拉列表：用户课题 + 添加新项目 + 不绑定选项
- 路径用 `--fg-tertiary` + 等宽数字可选；过长 `pathSummary` 单行省略 + `title` 全文

### 11.2 侧栏历史分组

| 分组标题 | 内容 |
|----------|------|
| 用户课题目录名 | 绑定该 `projectId` 的会话 |
| **默认工作区（XIAOCHUANG）** | 平台默认任务目录下的会话 |
| （可选）全部 | 不按项目折叠时的平铺视图 |

未创建任务的 composer 草稿**不**进入侧栏；首条消息发送后归入对应组。

### 11.3 空态

| 位置 | 空态文案方向 | 主 CTA |
|------|--------------|--------|
| 默认工作区组（无历史） | 「默认工作区中的对话会保存在文稿/XIAOCHUANG 下」 | 新建对话 |
| 用户课题组（无会话） | 「在该课题下开始新对话」 | 新建对话 |
| 工作区文件树（空目录） | 「Agent 产出将出现在此」 | — |
| 工作区文件缺失（纪要/文稿） | 「工作区文件不可用或已删除」 | 返回列表 / 重试 |

空态插图可用 `--accent-warm` 点缀；**不用**冷色渐变或 emoji。

### 11.4 五态补充

工作区相关界面须覆盖：**加载**（列树）、**空**（§12.3）、**错**（Companion 未连接 / 路径不可读）、**有数据**、**边界**（超长 `pathSummary`、深层目录）。

---

## 12. 参考

| 资源 | 路径 |
|------|------|
| Open Design — Claude 系统 | `design-systems/claude/DESIGN.md` |
| 排版 Craft | `craft/typography.md` |
| 色彩 Craft | `craft/color.md` |
| 反 AI 模板 | `craft/anti-ai-slop.md` |
| 状态覆盖 | `craft/state-coverage.md` |
| 无障碍 | `craft/accessibility-baseline.md` |

Open Design 根目录：`/Users/zhaoxiaogang/Documents/同步空间/04 项目管理/coding/ZHEYE/ZHEYE-main/open-design`

---

*文档由 Open Design `open-design` 技能工作流生成：选型 `claude` → 应用 Craft → 对齐小窗 PRD 与现有原型 token。*

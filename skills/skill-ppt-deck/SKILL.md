---
slug: skill-ppt-deck
module: ppt
task: deck
version: "1.0"
templatePackId: tpl-ppt-default
---

# PPT · 演示文稿生成（默认流程）

## 目标

将研究主题、写作文稿或结构化大纲转化为可汇报的**演示文稿**，产出可在 Office/WPS 打开的 PPTX，或先以 HTML 幻灯片预览再导出。

## 适用场景

| 入口 | 说明 |
|------|------|
| 新建 PPT | 从主题与受众直接生成大纲与幻灯片 |
| 从文稿生成 | 读取工作区内写作成稿，按章节映射为幻灯片页 |
| 路演模板 | 使用已注册的版式 Skill（见 `references/template-map.md`） |

## 工作流（必须按序）

1. **澄清输入**：主题、受众、页数区间、是否嵌入图表（静态 PNG/SVG）、选定版式 `templateId`（未指定则用通用商务）。
2. **大纲确认**：输出 Markdown 大纲（章节 → 页标题 → 3～5 条要点）；等待用户确认或修订后再生成正文。
3. **生成幻灯片**：
   - 若版式为 HTML PPT 系（`skill-ppt-html-studio` 及子模板），在工作区生成 `deck.html`（单文件或 `deck/` 目录）+ 可选 `slides.json` 中间态。
   - 若需直接 PPTX，调用 `skill-ppt-pptx` / `skill-ppt-pptx-generator` / `skill-ppt-slides` 能力；HTML 导出后须用 `skill-ppt-fidelity-audit` 做版式核对。
4. **图表**：来自数据源或对话的图表以**静态图**嵌入；禁止在幻灯片内做交互图表。
5. **导出**：最终交付 `*.pptx`；可选 PDF。文件名含主题与日期，如 `螺纹钢市场展望_20260521.pptx`。

## 版式选择

- 未指定模板：信息架构清晰、白底深色字、单强调色；符合平台研究规范（见横切 Skill）。
- 已指定 `templateId`：读取对应流程 Skill 的视觉约束，**不得**混用多套调色板。
- 完整映射表见 `references/template-map.md`。

## 输出结构（工作区）

```
<projectId>/
  outline.md          # 已确认大纲
  deck.html           # 或 slides/ 目录（HTML 路径）
  assets/             # 图表 PNG/SVG
  <主题>_YYYYMMDD.pptx
```

## 数据与合规

- 行情、产量、库存等数据须标注来源与时间区间；无法核实则标「待核实」。
- 禁止捏造指标、虚构机构观点；占位文案须明确标注。
- 免责声明与风险提示按横切规范 Skill 执行。

## 禁止

- 跳过「大纲确认」直接生成全文（除非用户明确要求快速模式）。
- 在用户项目目录复制平台 `skills/` 树；模板资产经 Agent Kit 只读访问。
- 默认 AI 模板风（紫蓝渐变、无信息架构的卡片墙、emoji 装饰图标）。

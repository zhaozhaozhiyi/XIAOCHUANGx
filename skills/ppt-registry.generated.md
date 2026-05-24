# PPT Skill 注册表（由 sync-open-design-ppt-skills 生成，勿手改）

生成时间: 2026-05-21T06:37:29.020Z

## 路演模板 → 流程 Skill

```typescript
export const PPT_TEMPLATE_SKILL: Record<string, string> = {
  "guizang-editorial": "skill-ppt-guizang-editorial", // 归藏编辑墨水
  "swiss-international": "skill-ppt-swiss-international", // 瑞士国际主义
  "open-canvas": "skill-ppt-open-canvas", // 自由画布
  "quarterly-review": "skill-ppt-quarterly-review", // 复古季报回顾
  "fintech-swiss": "skill-ppt-fintech-swiss", // 金融科技瑞系
  "editorial-burgundy": "skill-ppt-editorial-burgundy", // 编辑工作室
  "pitch-deck": "skill-ppt-pitch-deck", // 路演 Pitch Deck
  "tech-sharing": "skill-ppt-tech-sharing", // 技术分享
  "weekly-report": "skill-ppt-weekly-report", // 周报
  "knowledge-arch": "skill-ppt-knowledge-arch", // 知识架构蓝图
  "blue-professional": "skill-ppt-blue-professional", // 专业蓝
};
```

## 工具类 Skill（不绑模板，由 skill-ppt-deck 引用）

- `skill-ppt-pptx` — PPTX 读写（Anthropic）
- `skill-ppt-pptx-generator` — PPTX 生成（PptxGenJS）
- `skill-ppt-slides` — Slides（OpenAI）
- `skill-ppt-fidelity-audit` — HTML→PPTX  fidelity 审计
- `skill-ppt-html-studio` — HTML PPT Studio（主技能）

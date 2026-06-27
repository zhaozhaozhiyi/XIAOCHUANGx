# PPT 模板 → 流程 Skill 映射

与 `web/src/lib/module-registry.ts` 中 `PPT_TEMPLATE_SKILL` 保持一致。同步 Open Design 后由 `scripts/sync-open-design-ppt-skills.mjs` 更新 `skills/ppt-registry.generated.md`。

| templateId | 流程 Skill | 模板包 | 说明 |
|------------|------------|--------|------|
| `default` | `skill-ppt-deck` | `tpl-ppt-default` | 通用商务（本 Skill） |
| `pitch-deck` | `skill-ppt-pitch-deck` | `tpl-ppt-pitch-deck` | 路演 / 融资 |
| `tech-sharing` | `skill-ppt-tech-sharing` | `tpl-ppt-tech-sharing` | 技术分享 |
| `weekly-report` | `skill-ppt-weekly-report` | `tpl-ppt-weekly-report` | 周报 |
| `quarterly-review` | `skill-ppt-quarterly-review` | `tpl-ppt-quarterly-review` | 季报回顾 |
| `fintech-swiss` | `skill-ppt-fintech-swiss` | `tpl-ppt-fintech-swiss` | 金融科技瑞系 |
| `guizang-editorial` | `skill-ppt-guizang-editorial` | `tpl-ppt-guizang-editorial` | 杂志风编辑 |
| `swiss-international` | `skill-ppt-swiss-international` | `tpl-ppt-swiss-international` | 瑞士国际主义 |
| `open-canvas` | `skill-ppt-open-canvas` | `tpl-ppt-open-canvas` | 自由画布 |
| `knowledge-arch` | `skill-ppt-knowledge-arch` | `tpl-ppt-knowledge-arch` | 知识架构 |
| `blue-professional` | `skill-ppt-blue-professional` | `tpl-ppt-blue-professional` | 专业蓝 |
| `editorial-burgundy` | `skill-ppt-editorial-burgundy` | `tpl-ppt-editorial-burgundy` | 编辑工作室 |

## 工具类 Skill（由本流程按需引用）

| Skill | 用途 |
|-------|------|
| `skill-ppt-html-studio` | HTML PPT 主技能（主题、版式、runtime） |
| `skill-ppt-pptx` | 读写调整 PPTX |
| `skill-ppt-pptx-generator` | PptxGenJS 从零生成 |
| `skill-ppt-slides` | OpenAI slides 管线 |
| `skill-ppt-fidelity-audit` | HTML→PPTX 导出 fidelity 审计 |

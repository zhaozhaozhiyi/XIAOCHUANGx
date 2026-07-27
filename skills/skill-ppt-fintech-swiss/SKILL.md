---
slug: skill-ppt-fintech-swiss
version: "1.0"
kind: workflow
scope: ["ppt"]
summary: "金融科技瑞系风格：数据驱动、瑞士网格"
skillDependencies: []
capabilityRequirements: []
assetPolicy: {"references":true,"scripts":false,"templates":false,"assets":true}
module: ppt
source: open-design/skills/digits-fintech-swiss-template
templateId: fintech-swiss
label: 金融科技瑞系
templatePackId: tpl-ppt-fintech-swiss
description: "|"
---

# Digits Fintech Swiss Template

A premium three-slide live-artifact template for data-storytelling in a Swiss grid language.

## Resource map

```text
digits-fintech-swiss-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Start from `assets/template.html` and keep the three-slide structure intact.
2. Replace copy and metric values while preserving card hierarchy and reading order.
3. Keep interactions:
   - Prev / Next buttons
   - keyboard navigation (`ArrowLeft` / `ArrowRight`)
   - dot navigation
4. Keep motion subtle (slide fade + tiny hover lift only).
5. Keep the file self-contained (inline CSS/JS) with no sandbox-hostile APIs.

## Output contract

Emit one concise orientation sentence and then one HTML artifact:

```xml
<artifact identifier="digits-fintech-swiss" type="text/html" title="Digits Fintech Swiss Deck">
<!doctype html>
<html>...</html>
</artifact>
```

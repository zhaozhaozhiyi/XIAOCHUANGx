---
slug: skill-ppt-editorial-burgundy
version: "1.0"
kind: workflow
scope: ["ppt"]
summary: "编辑工作室：文化叙事与原则清单"
skillDependencies: []
capabilityRequirements: []
assetPolicy: {"references":true,"scripts":false,"templates":false,"assets":true}
module: ppt
source: open-design/skills/editorial-burgundy-principles-template
templateId: editorial-burgundy
label: 编辑工作室
templatePackId: tpl-ppt-editorial-burgundy
description: "|"
---

# Editorial Burgundy Principles Template

A three-slide editorial deck for culture narratives, strategy storytelling, and internal manifestos.

## Resource map

```text
editorial-burgundy-principles-template/
├── SKILL.md
├── assets/
│   └── template.html
├── references/
│   └── checklist.md
└── example.html
```

## Workflow

1. Start from `assets/template.html`.
2. Keep the 3-slide sequence:
   - numeric headline
   - studio tags + title lockup
   - eight-principles card grid
3. Replace copy while preserving card and tag hierarchy.
4. Keep interactions:
   - Prev / Next buttons
   - dot navigation
   - keyboard navigation (`ArrowLeft` / `ArrowRight`)
5. Keep HTML self-contained and sandbox-safe.

## Output contract

Emit one concise orientation sentence and one HTML artifact:

```xml
<artifact identifier="editorial-burgundy-principles" type="text/html" title="Editorial Burgundy Principles Deck">
<!doctype html>
<html>...</html>
</artifact>
```

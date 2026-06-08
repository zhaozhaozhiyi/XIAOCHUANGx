"use client";

import { useMemo, useState } from "react";
import {
  getModuleSkillOptions,
  notifyModuleSkillTemplateChanged,
  readStoredModuleSkillTemplateId,
  writeStoredModuleSkillTemplateId,
  type ModuleSkillOption,
  type ModuleSkillPickerKind,
} from "@/lib/module-chat-config";
import {
  getTemplatePreview,
  listTemplatePreviews,
} from "@/lib/template-preview";
import { TemplatePreviewModal } from "./TemplatePreviewModal";
import { TemplateSkillCard } from "./TemplateSkillCard";

type Props = {
  module: ModuleSkillPickerKind;
};

const MODULE_GALLERY_COPY: Record<
  ModuleSkillPickerKind,
  { title: string; subtitle: string }
> = {
  writing: {
    title: "写作版式",
    subtitle: "点封面预览样稿，与会话底栏 Skill 同步",
  },
  ppt: {
    title: "演示模板",
    subtitle: "真实幻灯片样张，可翻页预览后一键选用",
  },
  translate: {
    title: "翻译场景",
    subtitle: "文本 / 文档 / 润色 三个 Skill，按粘贴内容选择",
  },
};

export function TemplateSkillGallery({ module }: Props) {
  const copy = MODULE_GALLERY_COPY[module];
  const previews = listTemplatePreviews(module);
  const options = getModuleSkillOptions(module);
  const [activeTemplateId, setActiveTemplateId] = useState(() =>
    readStoredModuleSkillTemplateId(module),
  );
  const [previewTarget, setPreviewTarget] = useState<{
    option: ModuleSkillOption;
    templateId: string;
  } | null>(null);

  const cards = useMemo(
    () =>
      previews
        .map((p) => {
          const option = options.find((o) => o.templateId === p.templateId);
          if (!option) return null;
          return { preview: p, option };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null),
    [previews, options],
  );

  const previewConfig = previewTarget
    ? getTemplatePreview(module, previewTarget.templateId)
    : undefined;

  const applyTemplate = (templateId: string) => {
    writeStoredModuleSkillTemplateId(module, templateId);
    notifyModuleSkillTemplateChanged();
    setActiveTemplateId(templateId);
  };

  if (cards.length === 0) return null;

  return (
    <>
      <section className="template-skill-gallery" aria-label="模板预览">
        <header className="template-skill-gallery__header">
          <h2 className="template-skill-gallery__title">{copy.title}</h2>
          <p className="template-skill-gallery__subtitle">{copy.subtitle}</p>
        </header>

        <ul className="template-skill-gallery__grid">
          {cards.map(({ preview, option }) => (
            <li key={option.templateId} className="template-skill-gallery__item">
              <TemplateSkillCard
                option={option}
                preview={preview}
                selected={activeTemplateId === option.templateId}
                onPreview={() =>
                  setPreviewTarget({
                    option,
                    templateId: option.templateId,
                  })
                }
                onSelect={() => applyTemplate(option.templateId)}
              />
            </li>
          ))}
        </ul>
      </section>

      {previewTarget && previewConfig ? (
        <TemplatePreviewModal
          open
          option={previewTarget.option}
          preview={previewConfig}
          onClose={() => setPreviewTarget(null)}
          onUseTemplate={() => {
            applyTemplate(previewTarget.templateId);
            setPreviewTarget(null);
          }}
        />
      ) : null}
    </>
  );
}

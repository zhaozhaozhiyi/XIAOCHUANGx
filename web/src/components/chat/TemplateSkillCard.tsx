"use client";

import type { CSSProperties } from "react";
import { Check, Eye } from "lucide-react";
import type { ModuleSkillOption } from "@/lib/module-chat-config";
import {
  previewKindLabel,
  type TemplatePreviewConfig,
} from "@/lib/template-preview";

type Props = {
  option: ModuleSkillOption;
  preview: TemplatePreviewConfig;
  selected: boolean;
  onPreview: () => void;
  onSelect: () => void;
};

export function TemplateSkillCard({
  option,
  preview,
  selected,
  onPreview,
  onSelect,
}: Props) {
  const theme = preview.coverTheme;
  const kindLabel = previewKindLabel(preview.kind);

  return (
    <article
      className={`template-skill-card group ${selected ? "template-skill-card--selected" : ""}`}
    >
      <button
        type="button"
        className="template-skill-card__cover"
        onClick={onPreview}
        aria-label={`预览「${option.label}」样张`}
        style={
          theme
            ? ({
                "--card-cover-gradient": theme.gradient,
                "--card-cover-accent": theme.accent,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="template-skill-card__cover-inner">
          {preview.kind === "html-deck" ? (
            <iframe
              title=""
              src={preview.assetUrl}
              tabIndex={-1}
              loading="lazy"
              className="template-skill-card__iframe"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div
              className={`template-skill-card__doc-mock template-skill-card__doc-mock--${preview.kind}`}
              aria-hidden
            >
              <span className="template-skill-card__doc-line template-skill-card__doc-line--title" />
              <span className="template-skill-card__doc-line" />
              <span className="template-skill-card__doc-line" />
              <span className="template-skill-card__doc-line template-skill-card__doc-line--short" />
            </div>
          )}
        </div>
        <span className="template-skill-card__cover-shine" aria-hidden />
        <span className="template-skill-card__cover-hover">
          <Eye className="h-4 w-4" strokeWidth={1.75} />
          预览样张
        </span>
        {selected ? (
          <span className="template-skill-card__badge" aria-hidden>
            <Check className="h-3 w-3" strokeWidth={2.5} />
          </span>
        ) : null}
      </button>

      <div className="template-skill-card__body">
        <div className="template-skill-card__meta">
          <h3 className="template-skill-card__title">{option.label}</h3>
          <span className="template-skill-card__kind">{kindLabel}</span>
        </div>
        <p className="template-skill-card__desc">
          {preview.coverLabel ?? option.description}
        </p>
        <button
          type="button"
          className={`template-skill-card__select ${selected ? "template-skill-card__select--active" : ""}`}
          onClick={onSelect}
        >
          {selected ? "当前模板" : "选用模板"}
        </button>
      </div>
    </article>
  );
}

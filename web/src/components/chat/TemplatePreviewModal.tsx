"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { ModuleSkillOption } from "@/lib/module-chat-config";
import type { TemplatePreviewConfig } from "@/lib/template-preview";
import { TemplatePreviewBody } from "./previews/TemplatePreviewBody";

type Props = {
  open: boolean;
  option: ModuleSkillOption;
  preview: TemplatePreviewConfig;
  onClose: () => void;
  onUseTemplate: () => void;
};

export function TemplatePreviewModal({
  open,
  option,
  preview,
  onClose,
  onUseTemplate,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const kindLabel =
    preview.kind === "html-deck"
      ? "HTML 幻灯片"
      : preview.kind === "docx"
        ? "DOCX"
        : preview.kind === "markdown"
          ? "Markdown"
          : "图片";

  return (
    <div
      className="template-preview-modal fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-8"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 border-0 bg-[rgba(20,20,19,0.52)] backdrop-blur-md"
        aria-label="关闭预览"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex h-[min(88vh,720px)] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[0_24px_64px_rgba(20,20,19,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id="template-preview-title"
              className="font-display text-base text-[var(--fg)]"
            >
              {option.label}
            </h2>
            <p className="mt-1 text-sm text-[var(--fg-secondary)]">
              {option.description}
            </p>
            <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
              预览类型：{kindLabel}
              {preview.pageCount ? ` · ${preview.pageCount} 页` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn-icon shrink-0"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <TemplatePreviewBody config={preview} />
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button type="button" className="btn btn-secondary px-4 py-2 text-sm" onClick={onClose}>
            关闭
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 py-2 text-sm"
            onClick={onUseTemplate}
          >
            使用此模板
          </button>
        </footer>
      </div>
    </div>
  );
}

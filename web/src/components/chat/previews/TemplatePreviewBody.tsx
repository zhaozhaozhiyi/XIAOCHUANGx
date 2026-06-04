"use client";

import type { TemplatePreviewConfig } from "@/lib/template-preview";
import { DocxUrlPreview } from "./DocxUrlPreview";
import { HtmlDeckPreview } from "./HtmlDeckPreview";
import { MarkdownUrlPreview } from "./MarkdownUrlPreview";

export function TemplatePreviewBody({ config }: { config: TemplatePreviewConfig }) {
  switch (config.kind) {
    case "html-deck":
      return (
        <HtmlDeckPreview
          assetUrl={config.assetUrl}
          pageCount={config.pageCount}
        />
      );
    case "docx":
      return (
        <DocxUrlPreview
          assetUrl={config.assetUrl}
          fileName={`${config.templateId}-sample.docx`}
        />
      );
    case "markdown":
      return <MarkdownUrlPreview assetUrl={config.assetUrl} />;
    case "images":
      return (
        <p className="text-sm text-[var(--fg-tertiary)]">
          图片序列预览（Demo 未接入，可扩展为翻页图集）
        </p>
      );
    default:
      return null;
  }
}

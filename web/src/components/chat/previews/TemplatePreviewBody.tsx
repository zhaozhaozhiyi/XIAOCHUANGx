"use client";

import type { CSSProperties } from "react";
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
        <div
          className="grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] p-6"
          style={
            {
              background:
                config.coverTheme?.gradient ??
                "linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)",
            } as CSSProperties
          }
        >
          <div className="flex aspect-video w-full max-w-3xl flex-col justify-between overflow-hidden rounded-[var(--radius-lg)] border border-white/35 bg-white/70 p-6 shadow-[0_18px_45px_rgba(20,20,19,0.16)] backdrop-blur">
            <div>
              <span
                className="mb-5 block h-1.5 w-16 rounded-full"
                style={{ backgroundColor: config.coverTheme?.accent ?? "#475569" }}
              />
              <p className="font-display text-2xl text-[var(--fg)]">
                {config.coverLabel ?? config.templateId}
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <span className="h-20 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.62)]" />
                <span className="h-20 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.42)]" />
                <span className="h-20 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.28)]" />
              </div>
            </div>
            <div className="flex items-end justify-between gap-4">
              <span className="h-2 w-28 rounded-full bg-[rgba(20,20,19,0.16)]" />
              <span
                className="h-10 w-10 rounded-full"
                style={{ backgroundColor: config.coverTheme?.accent ?? "#475569" }}
              />
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

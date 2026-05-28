"use client";

import { useEffect, useReducer, useRef } from "react";
import { renderAsync } from "docx-preview";
import { base64ToArrayBuffer } from "@/lib/workspace-binary";

type Props = {
  base64: string;
  fileName: string;
};

type PreviewState = {
  loading: boolean;
  error: string | null;
};

type PreviewAction =
  | { type: "start" }
  | { type: "success" }
  | { type: "error"; message: string };

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "start":
      return { loading: true, error: null };
    case "success":
      return { loading: false, error: null };
    case "error":
      return { loading: false, error: action.message };
  }
}

export function DocxPreview({ base64, fileName }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [{ loading, error }, dispatch] = useReducer(previewReducer, {
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) dispatch({ type: "start" });
    });

    void (async () => {
      const bodyContainer = bodyRef.current;
      const styleContainer = styleRef.current;
      if (!bodyContainer || !styleContainer) return;

      bodyContainer.innerHTML = "";
      styleContainer.innerHTML = "";

      try {
        const buffer = base64ToArrayBuffer(base64);
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        await renderAsync(blob, bodyContainer, styleContainer, {
          className: "docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
          renderAltChunks: true,
        });

        if (cancelled) return;
        dispatch({ type: "success" });
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "error",
          message: err instanceof Error ? err.message : "DOCX 预览失败",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base64]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
      <div className="docx-preview-host relative min-h-[420px] flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
        {loading && (
          <p className="absolute inset-x-0 top-4 z-10 px-4 text-sm text-[var(--fg-tertiary)]">
            正在加载文档预览…
          </p>
        )}
        {error && (
          <div className="absolute inset-x-4 top-4 z-10 rounded-lg border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-4 py-3 text-sm text-[var(--danger-muted)]">
            <p className="font-medium">无法预览 DOCX</p>
            <p className="mt-1 text-xs opacity-90">{error}</p>
          </div>
        )}
        <div ref={styleRef} className="docx-preview-styles" aria-hidden />
        <div
          ref={bodyRef}
          className={`docx-preview-body ${loading || error ? "invisible" : ""}`}
        />
      </div>
    </div>
  );
}

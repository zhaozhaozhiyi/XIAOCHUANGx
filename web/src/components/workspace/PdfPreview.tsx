"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { loadPdfJs } from "@/lib/pdfjs-client";
import { base64ToArrayBuffer } from "@/lib/workspace-binary";
import { PreviewZoomToolbar } from "./PreviewZoomToolbar";

type Props = {
  base64: string;
  fileName: string;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;

type PreviewState = {
  loading: boolean;
  error: string | null;
  numPages: number;
  page: number;
  scale: number;
  ready: boolean;
};

type PreviewAction =
  | { type: "start" }
  | { type: "loaded"; numPages: number }
  | { type: "error"; message: string }
  | { type: "setPage"; page: number }
  | { type: "setScale"; scale: number };

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "start":
      return {
        loading: true,
        error: null,
        numPages: 0,
        page: 1,
        scale: 1,
        ready: false,
      };
    case "loaded":
      return {
        ...state,
        loading: false,
        error: null,
        numPages: action.numPages,
        page: 1,
        ready: true,
      };
    case "error":
      return {
        ...state,
        loading: false,
        error: action.message,
        ready: false,
      };
    case "setPage":
      return { ...state, page: action.page };
    case "setScale":
      return { ...state, scale: clampScale(action.scale) };
  }
}

export function PdfPreview({ base64, fileName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [{ loading, error, numPages, page, scale, ready }, dispatch] = useReducer(
    previewReducer,
    {
      loading: true,
      error: null,
      numPages: 0,
      page: 1,
      scale: 1,
      ready: false,
    },
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) dispatch({ type: "start" });
    });

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        const doc = await pdfjs
          .getDocument({ data: base64ToArrayBuffer(base64) })
          .promise;
        if (cancelled) {
          void doc.destroy();
          return;
        }
        pdfDocRef.current = doc;
        dispatch({ type: "loaded", numPages: doc.numPages });
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: "error",
            message: err instanceof Error ? err.message : "PDF 预览失败",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      void pdfDocRef.current?.destroy();
      pdfDocRef.current = null;
    };
  }, [base64]);

  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!ready || !doc || !canvas) return;

    let cancelled = false;

    void (async () => {
      try {
        renderTaskRef.current?.cancel();
        const pageObj = await doc.getPage(page);
        if (cancelled) return;

        const viewport = pageObj.getViewport({ scale });
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const task = pageObj.render({ canvasContext: context, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message.includes("Rendering cancelled")) {
          return;
        }
        dispatch({
          type: "error",
          message: err instanceof Error ? err.message : "PDF 页面渲染失败",
        });
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [page, scale, ready]);

  const zoomIn = useCallback(() => {
    dispatch({ type: "setScale", scale: scale + ZOOM_STEP });
  }, [scale]);

  const zoomOut = useCallback(() => {
    dispatch({ type: "setScale", scale: scale - ZOOM_STEP });
  }, [scale]);

  const resetView = useCallback(() => {
    dispatch({ type: "setScale", scale: 1 });
  }, []);

  const fitWidth = useCallback(() => {
    const doc = pdfDocRef.current;
    const viewport = viewportRef.current;
    if (!doc || !viewport) return;

    void (async () => {
      const pageObj = await doc.getPage(page);
      const baseViewport = pageObj.getViewport({ scale: 1 });
      const padding = 32;
      const nextScale = (viewport.clientWidth - padding) / baseViewport.width;
      dispatch({ type: "setScale", scale: nextScale });
    })();
  }, [page]);

  if (loading) {
    return <p className="text-sm text-[var(--fg-tertiary)]">正在加载 PDF…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-4 py-3 text-sm text-[var(--danger-muted)]">
        <p className="font-medium">无法预览 PDF</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-icon disabled:opacity-40"
              aria-label="上一页"
              disabled={page <= 1}
              onClick={() => dispatch({ type: "setPage", page: page - 1 })}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-[var(--fg-secondary)]">
              {page} / {numPages}
            </span>
            <button
              type="button"
              className="btn-icon disabled:opacity-40"
              aria-label="下一页"
              disabled={page >= numPages}
              onClick={() => dispatch({ type: "setPage", page: page + 1 })}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          <PreviewZoomToolbar
            scale={scale}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetView}
            onFit={fitWidth}
            canZoomIn={scale < MAX_SCALE}
            canZoomOut={scale > MIN_SCALE}
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className="flex min-h-[420px] flex-1 items-start justify-center overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4"
      >
        <canvas ref={canvasRef} className="shadow-[var(--shadow-sm)]" />
      </div>
    </div>
  );
}

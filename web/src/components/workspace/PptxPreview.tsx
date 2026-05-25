"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  base64ToArrayBuffer,
  isLikelyZipBuffer,
} from "@/lib/workspace-binary";

type Props = {
  base64: string;
  fileName: string;
};

export function PptxPreview({ base64, fileName }: Props) {
  const slideHostRef = useRef<HTMLDivElement>(null);
  const [slideHtml, setSlideHtml] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIndex(0);
    setSlideHtml([]);

    void (async () => {
      try {
        const buffer = base64ToArrayBuffer(base64);
        if (!isLikelyZipBuffer(buffer)) {
          if (!cancelled) {
            setError(
              "文件数据无效：未识别为 ZIP 格式，可能未以二进制方式读取。请重新打开该文件。",
            );
          }
          return;
        }

        const hostWidth =
          slideHostRef.current?.clientWidth &&
          slideHostRef.current.clientWidth > 0
            ? slideHostRef.current.clientWidth
            : 720;

        const { pptxToHtml } = await import("@jvmr/pptx-to-html");
        const slides = await pptxToHtml(buffer, {
          width: hostWidth,
          scaleToFit: true,
          letterbox: true,
        });

        if (cancelled) return;
        if (slides.length === 0) {
          setError("演示文稿中没有可预览的幻灯片");
          return;
        }
        setSlideHtml(slides);
        setIndex(0);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "无法解析 PPTX 文件",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base64]);

  const currentHtml = slideHtml[index] ?? "";

  if (loading) {
    return <p className="text-sm text-[var(--fg-tertiary)]">正在加载演示文稿…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-4 py-3 text-sm text-[var(--danger-muted)]">
        <p className="font-medium">无法预览演示文稿</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
        <p className="mt-2 text-xs text-[var(--fg-tertiary)]">
          请确认文件为有效的 .pptx，或在工作区中重新点击该文件以刷新缓存。
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn-icon"
            aria-label="上一张"
            disabled={index <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-[var(--fg-secondary)]">
            {index + 1} / {slideHtml.length}
          </span>
          <button
            type="button"
            className="btn-icon"
            aria-label="下一张"
            disabled={index >= slideHtml.length - 1}
            onClick={() =>
              setIndex((i) => Math.min(slideHtml.length - 1, i + 1))
            }
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div
        ref={slideHostRef}
        className="pptx-html-slide-host flex min-h-[320px] flex-1 items-center justify-center overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4"
      >
        {currentHtml ? (
          <div
            className="pptx-html-slide mx-auto max-w-full [&_img]:max-w-full [&_img]:h-auto"
            dangerouslySetInnerHTML={{ __html: currentHtml }}
          />
        ) : null}
      </div>
    </div>
  );
}

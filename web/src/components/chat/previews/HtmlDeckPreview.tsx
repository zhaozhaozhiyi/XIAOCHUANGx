"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  assetUrl: string;
  pageCount?: number;
};

export function HtmlDeckPreview({ assetUrl, pageCount = 1 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pageState, setPageState] = useState({ assetUrl, page: 0 });
  const total = Math.max(1, pageCount);
  const page =
    pageState.assetUrl === assetUrl ? Math.min(pageState.page, total - 1) : 0;

  const post = useCallback((msg: string | { type: string; page: number }) => {
    iframeRef.current?.contentWindow?.postMessage(msg, "*");
  }, []);

  useEffect(() => {
    post("preview-first");
  }, [assetUrl, post]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(total - 1, next));
    setPageState({ assetUrl, page: clamped });
    post({ type: "preview-goto", page: clamped });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[#0f172a]">
        <iframe
          ref={iframeRef}
          title="幻灯片样张预览"
          src={assetUrl}
          className="h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className="btn btn-secondary px-3 py-1.5 text-sm"
          disabled={page <= 0}
          onClick={() => go(page - 1)}
        >
          上一页
        </button>
        <span className="text-sm tabular-nums text-[var(--fg-secondary)]">
          {page + 1} / {total}
        </span>
        <button
          type="button"
          className="btn btn-secondary px-3 py-1.5 text-sm"
          disabled={page >= total - 1}
          onClick={() => go(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}

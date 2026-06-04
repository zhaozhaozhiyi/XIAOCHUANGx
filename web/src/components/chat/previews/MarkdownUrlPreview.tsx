"use client";

import { useEffect, useState } from "react";
import { MarkdownPreview } from "@/components/workspace/MarkdownPreview";

type Props = { assetUrl: string };
type MarkdownLoadState = {
  assetUrl: string;
  source: string | null;
  error: string | null;
};

export function MarkdownUrlPreview({ assetUrl }: Props) {
  const [loadState, setLoadState] = useState<MarkdownLoadState>({
    assetUrl,
    source: null,
    error: null,
  });
  const current =
    loadState.assetUrl === assetUrl
      ? loadState
      : { assetUrl, source: null, error: null };

  useEffect(() => {
    let cancelled = false;
    void fetch(assetUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) setLoadState({ assetUrl, source: text, error: null });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadState({
            assetUrl,
            source: null,
            error: err instanceof Error ? err.message : "加载失败",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetUrl]);

  if (current.error) {
    return (
      <p className="text-sm text-[var(--danger-muted)]">
        无法加载预览：{current.error}
      </p>
    );
  }
  if (!current.source) {
    return (
      <p className="text-sm text-[var(--fg-tertiary)]">正在加载文稿预览…</p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-white p-6">
      <MarkdownPreview source={current.source} />
    </div>
  );
}

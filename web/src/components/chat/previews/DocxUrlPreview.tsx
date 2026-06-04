"use client";

import { useEffect, useState } from "react";
import { DocxPreview } from "@/components/workspace/DocxPreview";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

type Props = { assetUrl: string; fileName?: string };
type DocxLoadState = {
  assetUrl: string;
  base64: string | null;
  error: string | null;
};

export function DocxUrlPreview({
  assetUrl,
  fileName = "样稿.docx",
}: Props) {
  const [loadState, setLoadState] = useState<DocxLoadState>({
    assetUrl,
    base64: null,
    error: null,
  });
  const current =
    loadState.assetUrl === assetUrl
      ? loadState
      : { assetUrl, base64: null, error: null };

  useEffect(() => {
    let cancelled = false;
    void fetch(assetUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => {
        if (!cancelled) {
          setLoadState({
            assetUrl,
            base64: arrayBufferToBase64(buf),
            error: null,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadState({
            assetUrl,
            base64: null,
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
        无法加载 DOCX 预览：{current.error}
      </p>
    );
  }
  if (!current.base64) {
    return (
      <p className="text-sm text-[var(--fg-tertiary)]">正在加载 DOCX 预览…</p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DocxPreview base64={current.base64} fileName={fileName} />
    </div>
  );
}

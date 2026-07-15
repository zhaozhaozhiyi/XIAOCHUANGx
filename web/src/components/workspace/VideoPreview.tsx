"use client";

import { useMemo, useState } from "react";
import { inferMimeFromPath } from "@/lib/workspace-binary";

type Props = {
  projectId: string;
  relativePath: string;
  fileName: string;
};

export function VideoPreview({ projectId, relativePath, fileName }: Props) {
  const [error, setError] = useState(false);
  const src = useMemo(() => {
    const q = new URLSearchParams({ projectId, path: relativePath });
    return `/api/workspace/media?${q}`;
  }, [projectId, relativePath]);
  const mime = inferMimeFromPath(fileName);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
      <div className="relative flex min-h-[320px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-black">
        <video
          key={src}
          controls
          playsInline
          preload="metadata"
          className="h-full max-h-[72vh] w-full bg-black object-contain"
          onCanPlay={() => setError(false)}
          onError={() => setError(true)}
        >
          <source src={src} type={mime} />
        </video>
        {error ? (
          <div className="absolute inset-x-4 top-4 rounded-lg border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-4 py-3 text-sm text-[var(--danger-muted)]">
            当前编码无法内嵌播放，可用系统打开。
          </div>
        ) : null}
      </div>
    </div>
  );
}

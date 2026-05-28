"use client";

import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit?: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
};

export function PreviewZoomToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  canZoomIn = true,
  canZoomOut = true,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className="btn-icon disabled:opacity-40"
        aria-label="缩小"
        disabled={!canZoomOut}
        onClick={onZoomOut}
      >
        <ZoomOut className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-[var(--fg-secondary)]">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        className="btn-icon disabled:opacity-40"
        aria-label="放大"
        disabled={!canZoomIn}
        onClick={onZoomIn}
      >
        <ZoomIn className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="btn-icon"
        aria-label="重置缩放"
        onClick={onReset}
      >
        <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {onFit && (
        <button
          type="button"
          className="btn-icon"
          aria-label="适应窗口"
          onClick={onFit}
        >
          <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

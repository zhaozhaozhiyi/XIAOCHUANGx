"use client";

import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { PreviewZoomToolbar } from "./PreviewZoomToolbar";

type Props = {
  base64: string;
  mime?: string;
  fileName: string;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const ZOOM_STEP = 0.2;

function inferImageMime(fileName: string, fallback?: string): string {
  if (fallback?.startsWith("image/")) return fallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/*";
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function ImagePreview({ base64, mime, fileName }: Props) {
  const src = `data:${inferImageMime(fileName, mime)};base64,${base64}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  const zoomIn = useCallback(() => {
    setScale((current) => clampScale(current + ZOOM_STEP));
  }, []);

  const zoomOut = useCallback(() => {
    setScale((current) => clampScale(current - ZOOM_STEP));
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const fitToContainer = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !naturalSize) {
      resetView();
      return;
    }
    const padding = 32;
    const scaleX = (viewport.clientWidth - padding) / naturalSize.w;
    const scaleY = (viewport.clientHeight - padding) / naturalSize.h;
    setScale(clampScale(Math.min(scaleX, scaleY, 1)));
    setOffset({ x: 0, y: 0 });
  }, [naturalSize, resetView]);

  const onWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((current) => clampScale(current + delta));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset.x, offset.y],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setOffset({
      x: drag.originX + (event.clientX - drag.startX),
      y: drag.originY + (event.clientY - drag.startY),
    });
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-tertiary)]">{fileName}</p>
        <PreviewZoomToolbar
          scale={scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={resetView}
          onFit={fitToContainer}
          canZoomIn={scale < MAX_SCALE}
          canZoomOut={scale > MIN_SCALE}
        />
      </div>

      <div
        ref={viewportRef}
        className="relative flex min-h-[320px] flex-1 touch-none select-none items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          className="will-change-transform"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- workspace binary data URL */}
          <img
            src={src}
            alt={fileName}
            draggable={false}
            className="max-h-[70vh] max-w-full object-contain"
            onLoad={(event) => {
              setNaturalSize({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              });
            }}
          />
        </div>
      </div>

      <p className="text-[10px] text-[var(--fg-tertiary)]">
        滚轮缩放 · 拖拽平移
      </p>
    </div>
  );
}

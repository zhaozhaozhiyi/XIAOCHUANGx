"use client";

import { useMemo } from "react";
import {
  parseDxfPreview,
  type DxfPreviewBounds,
  type DxfPreviewEntity,
} from "@/lib/dxf-preview";

type Props = {
  source: string;
  fileName: string;
};

function viewBox(bounds: DxfPreviewBounds): string {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padding = Math.max(width, height, 1) * 0.08;
  return [
    bounds.minX - padding,
    -(bounds.maxY + padding),
    width + padding * 2,
    height + padding * 2,
  ].join(" ");
}

function formatMm(value: number): string {
  return `${value.toFixed(value >= 100 ? 1 : 2)} mm`;
}

function dimensionOverlay(bounds: DxfPreviewBounds) {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const padding = Math.max(width, height, 1) * 0.08;
  const tick = padding * 0.22;
  const fontSize = Math.max(Math.max(width, height) * 0.035, 3);
  const widthY = -bounds.minY + padding * 0.45;
  const heightX = bounds.minX - padding * 0.45;
  const minY = -bounds.minY;
  const maxY = -bounds.maxY;
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (minY + maxY) / 2;

  return (
    <g className="pointer-events-none" stroke="#64748b" fill="#64748b">
      <line
        x1={bounds.minX}
        y1={widthY}
        x2={bounds.maxX}
        y2={widthY}
        vectorEffect="non-scaling-stroke"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <line
        x1={bounds.minX}
        y1={widthY - tick}
        x2={bounds.minX}
        y2={widthY + tick}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1}
      />
      <line
        x1={bounds.maxX}
        y1={widthY - tick}
        x2={bounds.maxX}
        y2={widthY + tick}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1}
      />
      <text
        x={midX}
        y={widthY + tick + fontSize}
        textAnchor="middle"
        fontSize={fontSize}
        stroke="none"
      >
        {formatMm(width)}
      </text>
      <line
        x1={heightX}
        y1={minY}
        x2={heightX}
        y2={maxY}
        vectorEffect="non-scaling-stroke"
        strokeDasharray="3 3"
        strokeWidth={1}
      />
      <line
        x1={heightX - tick}
        y1={minY}
        x2={heightX + tick}
        y2={minY}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1}
      />
      <line
        x1={heightX - tick}
        y1={maxY}
        x2={heightX + tick}
        y2={maxY}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1}
      />
      <text
        x={heightX - tick}
        y={midY}
        textAnchor="middle"
        fontSize={fontSize}
        stroke="none"
        transform={`rotate(-90 ${heightX - tick} ${midY})`}
      >
        {formatMm(height)}
      </text>
    </g>
  );
}

function arcPath(entity: Extract<DxfPreviewEntity, { type: "arc" }>): string {
  const start = (entity.startAngle * Math.PI) / 180;
  const end = (entity.endAngle * Math.PI) / 180;
  const startPoint = {
    x: entity.center.x + Math.cos(start) * entity.radius,
    y: entity.center.y + Math.sin(start) * entity.radius,
  };
  const endPoint = {
    x: entity.center.x + Math.cos(end) * entity.radius,
    y: entity.center.y + Math.sin(end) * entity.radius,
  };
  const normalizedEnd =
    entity.endAngle >= entity.startAngle
      ? entity.endAngle
      : entity.endAngle + 360;
  const largeArc = normalizedEnd - entity.startAngle > 180 ? 1 : 0;

  return [
    `M ${startPoint.x} ${startPoint.y}`,
    `A ${entity.radius} ${entity.radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`,
  ].join(" ");
}

function entityStroke(entity: DxfPreviewEntity): string {
  if (entity.layer.toLowerCase().includes("hole")) return "#d97706";
  if (entity.type === "circle") return "#d97706";
  if (entity.type === "arc") return "#2563eb";
  return "#0f766e";
}

function renderEntity(entity: DxfPreviewEntity, index: number) {
  const stroke = entityStroke(entity);
  if (entity.type === "line") {
    return (
      <line
        key={`${entity.type}-${index}`}
        x1={entity.start.x}
        y1={entity.start.y}
        x2={entity.end.x}
        y2={entity.end.y}
        vectorEffect="non-scaling-stroke"
        stroke={stroke}
        strokeLinecap="round"
        strokeWidth={1.5}
      />
    );
  }
  if (entity.type === "circle") {
    return (
      <circle
        key={`${entity.type}-${index}`}
        cx={entity.center.x}
        cy={entity.center.y}
        r={entity.radius}
        vectorEffect="non-scaling-stroke"
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
      />
    );
  }
  return (
    <path
      key={`${entity.type}-${index}`}
      d={arcPath(entity)}
      vectorEffect="non-scaling-stroke"
      fill="none"
      stroke={stroke}
      strokeLinecap="round"
      strokeWidth={1.5}
    />
  );
}

export function DxfPreview({ source, fileName }: Props) {
  const model = useMemo(() => parseDxfPreview(source), [source]);
  const width = model.bounds.maxX - model.bounds.minX;
  const height = model.bounds.maxY - model.bounds.minY;
  const holeDiameters = model.stats.uniqueCircleDiameters
    .map((diameter) => `Ø${formatMm(diameter)}`)
    .join(", ");

  if (model.entities.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--fg-tertiary)]">
        暂未解析到可预览的 DXF 实体。当前预览支持 R12 LINE、CIRCLE、ARC 和
        LWPOLYLINE。
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div>
          <p className="text-xs font-medium text-[var(--fg)]">{fileName}</p>
          <p className="text-[11px] text-[var(--fg-tertiary)]">
            {model.entities.length} entities · {model.layers.length} layers ·{" "}
            {width.toFixed(1)} x {height.toFixed(1)} mm
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-[10px] text-[var(--fg-tertiary)]">
          {model.layers.slice(0, 5).map((layer) => (
            <span
              key={layer}
              className="rounded-full border border-[var(--border)] px-2 py-0.5"
            >
              {layer}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
            外框
          </p>
          <p className="mt-1 font-medium text-[var(--fg)]">
            {formatMm(width)} x {formatMm(height)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
            切割长度
          </p>
          <p className="mt-1 font-medium text-[var(--fg)]">
            {formatMm(model.stats.totalCutLength)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
            实体
          </p>
          <p className="mt-1 font-medium text-[var(--fg)]">
            {model.stats.lineCount} 线 · {model.stats.circleCount} 圆 ·{" "}
            {model.stats.arcCount} 弧
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fg-tertiary)]">
            孔径
          </p>
          <p className="mt-1 truncate font-medium text-[var(--fg)]">
            {holeDiameters || "未检测到圆孔"}
          </p>
        </div>
      </div>
      <div className="min-h-[420px] flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-[radial-gradient(circle_at_20%_20%,rgba(15,118,110,0.12),transparent_32%),linear-gradient(180deg,var(--surface),var(--bg))]">
        <svg
          className="h-full min-h-[420px] w-full"
          role="img"
          aria-label={`${fileName} DXF preview`}
          viewBox={viewBox(model.bounds)}
        >
          <g transform="scale(1 -1)">
            <g opacity="0.28">
              {model.entities.map((entity, index) =>
                entity.type === "circle" ? (
                  <circle
                    key={`shadow-${index}`}
                    cx={entity.center.x}
                    cy={entity.center.y}
                    r={entity.radius}
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={4}
                  />
                ) : null,
              )}
            </g>
            {model.entities.map(renderEntity)}
          </g>
          {dimensionOverlay(model.bounds)}
        </svg>
      </div>
    </div>
  );
}

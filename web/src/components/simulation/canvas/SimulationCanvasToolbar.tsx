"use client";

import type { ReactNode } from "react";
import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import {
  Maximize2,
  Minus,
  Palette,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
} from "lucide-react";
import { SimulationLayerTabs } from "@/components/simulation/SimulationLayerTabs";
import type { CanvasFlowEdge, CanvasFlowNode } from "./canvasTypes";
import { SIMULATION_NODE_FAMILY_LEGEND } from "./canvasHelpers";

function SimulationNodeFamilyLegend() {
  const title = `节点颜色图例：${SIMULATION_NODE_FAMILY_LEGEND.map(
    (item) => item.label,
  ).join(" / ")}`;

  return (
    <details className="group relative">
      <summary
        role="button"
        aria-label="节点颜色图例"
        title={title}
        className="simulation-canvas-actionbar__btn inline-flex h-8 w-8 shrink-0 list-none items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden"
        style={{ listStyle: "none" }}
      >
        <Palette className="h-3.5 w-3.5" aria-hidden />
      </summary>
      <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-[230] hidden w-[11.5rem] rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-2 text-xs shadow-[0_0_0_1px_var(--composer-border),0_8px_22px_rgb(0_0_0_/_0.06)] group-open:block group-hover:block group-focus-within:block">
        <div className="mb-1.5 text-[11px] font-medium text-[var(--fg-tertiary)]">
          节点颜色
        </div>
        <div className="space-y-1">
          {SIMULATION_NODE_FAMILY_LEGEND.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="text-[11px] text-[var(--fg-secondary)]">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export function SimulationCanvasSideRail({
  isRevealing,
  revealedCount,
  nodeCount,
  pathStatusLabel,
  waveLabel,
  scenarioPathActions,
  layers,
  activeLayerId,
  layerCounts,
  onLayerChange,
  manualPositionCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetLayout,
}: {
  isRevealing: boolean;
  revealedCount: number;
  nodeCount: number;
  pathStatusLabel: string;
  waveLabel?: string;
  scenarioPathActions: ReactNode;
  layers: Array<{ id: string; label: string }>;
  activeLayerId: string;
  layerCounts: Map<string, number>;
  onLayerChange: (layerId: string) => void;
  manualPositionCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayout: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const { zoom } = useViewport();
  const zoomPercent = Math.round(zoom * 100);
  const actionBtn =
    "simulation-canvas-actionbar__btn inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-35";

  return (
    <Panel position="top-left" className="simulation-canvas-side-rail nodrag nowheel !m-3">
      <div className="simulation-canvas-actionbar max-w-[calc(100vw-1.5rem)] flex-wrap">
        <SimulationLayerTabs
          variant="rail"
          menuPlacement="below"
          layers={layers}
          activeLayerId={activeLayerId}
          layerCounts={layerCounts}
          onLayerChange={onLayerChange}
        />
        <SimulationNodeFamilyLegend />

        <div className="simulation-canvas-actionbar__divider" aria-hidden />

        <div className="flex items-center">
          <button
            type="button"
            title="撤销布局"
            aria-label="撤销布局"
            disabled={!canUndo}
            onClick={onUndo}
            className={actionBtn}
          >
            <Undo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            title="重做布局"
            aria-label="重做布局"
            disabled={!canRedo}
            onClick={onRedo}
            className={actionBtn}
          >
            <Redo2 className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            title="恢复自动布局"
            aria-label="恢复自动布局"
            disabled={manualPositionCount === 0}
            onClick={onResetLayout}
            className={actionBtn}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          </button>
          <button
            type="button"
            title="适应画布"
            aria-label="适应画布"
            onClick={() => fitView({ padding: 0.18, duration: 240 })}
            className={actionBtn}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="simulation-canvas-actionbar__divider" aria-hidden />

        <div className="flex items-center">
          <button
            type="button"
            title="缩小"
            aria-label="缩小"
            onClick={() => zoomOut({ duration: 160 })}
            className={actionBtn}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </button>
          <span className="w-9 select-none text-center text-xs tabular-nums text-[var(--fg-tertiary)]">
            {zoomPercent}%
          </span>
          <button
            type="button"
            title="放大"
            aria-label="放大"
            onClick={() => zoomIn({ duration: 160 })}
            className={actionBtn}
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>

        <div className="simulation-canvas-actionbar__divider" aria-hidden />

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 px-2">
          <span className="whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--fg)]">
            {pathStatusLabel}
          </span>
          {isRevealing ? (
            <span className="whitespace-nowrap text-[11px] text-[var(--fg-tertiary)]">
              生成 {revealedCount}/{nodeCount}
            </span>
          ) : null}
          {waveLabel ? (
            <span className="max-w-[11rem] truncate whitespace-nowrap rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--fg-tertiary)]">
              {waveLabel}
            </span>
          ) : null}
          {scenarioPathActions}
        </div>
      </div>
    </Panel>
  );
}

export function SimulationCanvasTools({
  manualPositionCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onResetLayout,
}: {
  manualPositionCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onResetLayout: () => void;
}) {
  const { fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();

  return (
    <Panel position="top-left" className="!m-3">
      <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1 shadow-[var(--shadow-sm)]">
        <button
          type="button"
          title="撤销布局"
          aria-label="撤销布局"
          disabled={!canUndo}
          onClick={onUndo}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title="重做布局"
          aria-label="重做布局"
          disabled={!canRedo}
          onClick={onRedo}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Redo2 className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title="恢复自动布局"
          aria-label="恢复自动布局"
          disabled={manualPositionCount === 0}
          onClick={onResetLayout}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          title="适应画布"
          aria-label="适应画布"
          onClick={() => fitView({ padding: 0.18, duration: 240 })}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--fg-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
        >
          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </Panel>
  );
}

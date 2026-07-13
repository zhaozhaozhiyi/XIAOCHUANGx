import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  type ConnectionLineComponentProps,
  type EdgeProps,
} from "@xyflow/react";
import { Plus } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import {
  EDGE_INSERT_OPTIONS,
  EDGE_RELATION_META,
  SEMANTIC_EDGE_RELATION_TYPES,
} from "./canvasConstants";
import type { CanvasFlowEdge, CanvasFlowNode } from "./canvasTypes";
import { nodeColor } from "./canvasHelpers";

const INSERT_CONTROL_SLIDE = 16;

function getInsertControlPosition({
  labelX,
  labelY,
  sourceX,
  sourceY,
  targetX,
  targetY,
}: {
  labelX: number;
  labelY: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): { x: number; y: number } {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { x: labelX, y: labelY };

  return {
    x: labelX + (dx / length) * INSERT_CONTROL_SLIDE,
    y: labelY + (dy / length) * INSERT_CONTROL_SLIDE,
  };
}

function getUpperArcPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}): [string, number, number] {
  const arcHeight = Math.max(96, Math.abs(targetY - sourceY) * 0.42 + 72);
  const sourceControlX = sourceX + 112;
  const targetControlX = targetX - 112;
  const sourceControlY = Math.min(sourceY, targetY) - arcHeight;
  const targetControlY = sourceControlY;
  const labelX = (sourceX + targetX) / 2;
  const labelY = sourceControlY + arcHeight * 0.24;

  return [
    `M ${sourceX},${sourceY} C ${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`,
    labelX,
    labelY,
  ];
}

function getCanvasEdgePath(props: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
}): [string, number, number] {
  if (props.targetX < props.sourceX - 32) {
    return getUpperArcPath(props);
  }
  // Product requirement: simulation relationships must read as curved arcs,
  // not orthogonal/step lines. Keep this as Bezier unless the requirement changes.
  const [path, labelX, labelY] = getBezierPath({
    ...props,
    curvature: 0.2,
  });
  return [path, labelX, labelY];
}

function SimulationCanvasEdge(props: EdgeProps<CanvasFlowEdge>) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    selected,
    data,
  } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const insertControlRef = useRef<HTMLDivElement | null>(null);
  const [edgePath, labelX, labelY] = getCanvasEdgePath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const insertControlPosition = getInsertControlPosition({
    labelX,
    labelY,
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const insertControlVisible = Boolean(
    data?.onInsertNode && (data.isHovered || triggerHovered || menuOpen),
  );
  const active = Boolean(
    selected || data?.isSelected || data?.isHovered || triggerHovered || menuOpen,
  );
  const color = data?.kind ? nodeColor(data.kind) : "#64748b";
  // F3: 按关系类型决定线型（因果实线 / 时序长虚线 / 证据支撑点线）。
  // 尊重 buildCanvas 已显式设置的 strokeDasharray（如输出边），不覆盖。
  const relationMeta = data?.relationType
    ? EDGE_RELATION_META[data.relationType]
    : undefined;
  const relationDash = style?.strokeDasharray ?? relationMeta?.dash;
  const isSemanticRelation = Boolean(
    data?.relationType &&
      SEMANTIC_EDGE_RELATION_TYPES.has(data.relationType),
  );
  const relationTooltipVisible = Boolean(
    isSemanticRelation && (data?.isHovered || active),
  );
  const edgeStyleValue = {
    ...style,
    stroke: style?.stroke ?? color,
    strokeWidth: active ? 2.35 : style?.strokeWidth,
    strokeDasharray: relationDash,
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (insertControlRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <g>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          interactionWidth={18}
          style={edgeStyleValue}
        />
      </g>
      <EdgeLabelRenderer>
        {relationTooltipVisible && relationMeta ? (
          <div
            className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-[10px] leading-tight text-[var(--fg-secondary)] shadow-[0_8px_24px_rgba(15,23,42,0.16)]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 22}px)`,
              pointerEvents: "none",
            }}
          >
            <span
              className="font-medium text-[var(--fg)]"
              style={{ color: edgeStyleValue.stroke }}
            >
              {relationMeta.label}
            </span>
            {data?.label ? (
              <span className="ml-1 text-[var(--fg-secondary)]">
                · {data.label}
              </span>
            ) : (
              <span className="ml-1 text-[var(--fg-tertiary)]">
                {relationMeta.hint}
              </span>
            )}
          </div>
        ) : null}
        <div
          className="nodrag nopan absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 transition-[opacity,transform] duration-150 ease-out"
          style={{
            transform: `translate(-50%, -50%) translate(${insertControlPosition.x}px, ${insertControlPosition.y}px)`,
            pointerEvents: insertControlVisible ? "all" : "none",
            opacity: insertControlVisible ? 1 : 0,
          }}
          ref={insertControlRef}
          onMouseEnter={() => setTriggerHovered(true)}
          onMouseLeave={() => setTriggerHovered(false)}
        >
          {data?.onInsertNode ? (
            <div className="relative">
              <button
                type="button"
                title="在这条边上插入节点"
                aria-label="在这条边上插入节点"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuOpen((current) => !current);
                }}
                className={[
                  "relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border-0 bg-[var(--accent)] p-0 text-white shadow-[0_2px_8px_rgba(20,20,19,0.16)] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:scale-150 hover:bg-[var(--accent-hover)] hover:shadow-[0_4px_14px_rgba(20,20,19,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
                  menuOpen ? "scale-150 bg-[var(--accent-hover)]" : "scale-100",
                ].join(" ")}
              >
                <Plus className="h-2.5 w-2.5" strokeWidth={2.7} aria-hidden />
              </button>
              {menuOpen ? (
                <div className="absolute left-1/2 top-5 z-20 flex -translate-x-1/2 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[0_18px_40px_rgba(15,23,42,0.18)]">
                  {EDGE_INSERT_OPTIONS.map((option) => (
	                    <button
	                      key={option.type}
	                      type="button"
	                      data-action-id="edge.insertNode"
	                      data-behavior-type="pending"
	                      data-target-kind="edge"
	                      data-insert-type={option.type}
	                      onClick={(event) => {
                        event.stopPropagation();
                        data.onInsertNode?.({
                          edgeId: id,
                          insertType: option.type,
                          sourceId: source,
                          targetId: target,
                          sourceLabel: data.sourceLabel ?? source,
                          targetLabel: data.targetLabel ?? target,
                          edgeLabel: data.label,
                        });
                        setMenuOpen(false);
                      }}
                      className="whitespace-nowrap px-3 py-1.5 text-left text-xs text-[var(--fg-secondary)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--fg)]"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export function SimulationConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
  connectionStatus,
}: ConnectionLineComponentProps<CanvasFlowNode>) {
  const [edgePath] = getCanvasEdgePath({
    sourceX: fromX,
    sourceY: fromY,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
  });

  return (
    <path
      d={edgePath}
      fill="none"
      stroke={connectionStatus === "invalid" ? "#dc2626" : "#111827"}
      strokeDasharray="6 5"
      strokeLinecap="round"
      strokeWidth={1.8}
    />
  );
}

const MemoizedSimulationCanvasEdge = memo(SimulationCanvasEdge);
MemoizedSimulationCanvasEdge.displayName = "SimulationCanvasEdge";

export const edgeTypes = { simulation: MemoizedSimulationCanvasEdge };

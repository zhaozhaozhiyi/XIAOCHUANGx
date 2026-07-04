"use client";

import { Background, ReactFlow } from "@xyflow/react";

export type SimulationStartStatus = {
  status: string;
  title: string;
  description: string;
};

export function SimulationStartCanvas({
  status,
  showCenterHint = true,
}: {
  status?: SimulationStartStatus;
  showCenterHint?: boolean;
}) {
  return (
    <div className="relative h-full min-h-[520px] overflow-hidden bg-[var(--surface)]">
      <ReactFlow
        nodes={[]}
        edges={[]}
        minZoom={0.35}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
      </ReactFlow>

      {status ? (
        <div className="pointer-events-none absolute left-4 top-4 max-w-[min(560px,calc(100%-2rem))] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]">
          <div className="text-xs font-medium text-[var(--fg-tertiary)]">
            {status.status}
          </div>
          <div className="mt-1 line-clamp-2 text-base font-semibold text-[var(--fg)]">
            {status.title}
          </div>
          <p className="mt-1 text-sm leading-5 text-[var(--fg-secondary)]">
            {status.description}
          </p>
        </div>
      ) : showCenterHint ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 pb-28">
          <p className="max-w-md text-center text-sm leading-6 text-[var(--fg-tertiary)]">
            输入推演问题，发送后会在画布上建立起点节点。
          </p>
        </div>
      ) : null}
    </div>
  );
}

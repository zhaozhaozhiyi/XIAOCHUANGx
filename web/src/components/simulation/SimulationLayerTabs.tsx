"use client";

import { ChevronDown, Layers3 } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

type SimulationLayerTab = {
  id: string;
  label: string;
};

type SimulationLayerTabsProps = {
  layers: SimulationLayerTab[];
  activeLayerId: string;
  layerCounts: Map<string, number>;
  onLayerChange: (layerId: string) => void;
  variant?: "bar" | "floating" | "rail";
  menuPlacement?: "below" | "right";
  fullWidth?: boolean;
};

type FloatingMenuPosition = {
  top: number;
  left: number;
  minWidth: number;
};

function useFloatingMenuPosition(
  open: boolean,
  anchorRef: RefObject<HTMLButtonElement | null>,
  menuPlacement: "below" | "right",
) {
  const [position, setPosition] = useState<FloatingMenuPosition | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPosition(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition(
        menuPlacement === "right"
          ? {
              top: rect.top,
              left: rect.right + 6,
              minWidth: Math.max(rect.width, 176),
            }
          : {
              top: rect.bottom + 6,
              left: rect.left,
              minWidth: Math.max(rect.width, 176),
            },
      );
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, menuPlacement, open]);

  return position;
}

export function SimulationLayerTabs({
  layers,
  activeLayerId,
  layerCounts,
  onLayerChange,
  variant = "bar",
  menuPlacement = "below",
  fullWidth = false,
}: SimulationLayerTabsProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuPosition = useFloatingMenuPosition(open, triggerRef, menuPlacement);
  const activeLayer =
    layers.find((layer) => layer.id === activeLayerId) ?? layers[0];
  const activeCount = layerCounts.get(activeLayer?.id ?? "") ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const menuItems = layers.map((layer) => {
    const selected = activeLayerId === layer.id;
    const count = layerCounts.get(layer.id) ?? 0;
    return (
      <li key={layer.id} role="none">
        <button
          type="button"
          role="menuitem"
          data-simulation-layer-id={layer.id}
          onClick={() => {
            onLayerChange(layer.id);
            setOpen(false);
          }}
          className={[
            "flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left text-xs transition-colors",
            selected
              ? "bg-[var(--accent-muted)] text-[var(--fg)]"
              : "text-[var(--fg-secondary)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]",
          ].join(" ")}
        >
          <span>{layer.label}</span>
          <span className="font-mono text-[10px] text-[var(--fg-tertiary)]">
            {count}
          </span>
        </button>
      </li>
    );
  });

  const menu =
    open && menuPosition ? (
      <ul
        ref={menuRef}
        role="menu"
        className="simulation-layer-tabs-menu fixed z-[220] min-w-[11rem] overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1"
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          minWidth: menuPosition.minWidth,
        }}
      >
        {menuItems}
      </ul>
    ) : null;

  if (variant === "floating" || variant === "rail") {
    const triggerClass =
      variant === "rail"
        ? "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs text-[var(--fg-secondary)] transition-colors hover:bg-[var(--sidebar-hover)] hover:text-[var(--fg)]"
        : [
            "inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2 text-xs text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]",
            fullWidth ? "w-full justify-between" : "",
          ].join(" ");

    return (
      <div ref={rootRef} className={fullWidth ? "relative w-full" : "relative"}>
        <button
          ref={triggerRef}
          type="button"
          data-simulation-layer-trigger="true"
          data-simulation-active-layer-id={activeLayer?.id}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          className={triggerClass}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Layers3 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">{activeLayer?.label ?? "分层"}</span>
            <span className="font-mono text-[10px] text-[var(--fg-tertiary)]">
              {activeCount}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={1.75}
            aria-hidden
          />
        </button>
        {typeof document !== "undefined" && menu
          ? createPortal(menu, document.body)
          : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      {layers.map((layer) => {
        const selected = activeLayerId === layer.id;
        const count = layerCounts.get(layer.id) ?? 0;
        return (
          <button
            key={layer.id}
            type="button"
            data-simulation-layer-id={layer.id}
            onClick={() => onLayerChange(layer.id)}
            className={[
              "inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-md)] border px-2 text-xs transition-colors",
              selected
                ? "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--fg)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--accent)] hover:text-[var(--fg)]",
            ].join(" ")}
            aria-pressed={selected}
          >
            <span>{layer.label}</span>
            <span className="font-mono text-[10px] text-[var(--fg-tertiary)]">
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

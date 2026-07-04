import type { CSSProperties, ReactNode } from "react";
import { useViewportScale } from "../hooks/useViewportScale";

interface Props {
  onAdvance(): void;
  children: ReactNode;
}

/**
 * The 16:9 canvas surface. Click anywhere except interactive children
 * to advance one beat.
 */
export function CanvasSurface({ onAdvance, children }: Props) {
  const scale = useViewportScale();
  const fitterStyle: CSSProperties = {
    width: 1920 * scale,
    height: 1080 * scale,
  };
  const frameStyle: CSSProperties = {
    transform: `scale(${scale})`,
  };
  return (
    <div className="studio-shell">
      <div className="canvas-fitter" style={fitterStyle}>
        <div
          className="canvas-plane"
          style={frameStyle}
          onClick={(e) => {
            const t = e.target as HTMLElement;
            if (t.closest("button, a, input, [data-no-advance]")) return;
            onAdvance();
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

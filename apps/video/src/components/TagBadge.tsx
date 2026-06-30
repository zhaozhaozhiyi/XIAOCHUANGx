import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT } from "../constants";

interface TagBadgeProps {
  text: string;
  x: number;
  y: number;
  enterFrame?: number;
  highlightColor?: string;
  orbitAngle?: number;
  orbitRadius?: number;
  center?: { x: number; y: number };
}

/**
 * 圆角关键词标签 — "玻璃标签"
 * 毛玻璃底 + 细边框 + 内发光 + 大字号
 */
export const TagBadge: React.FC<TagBadgeProps> = ({
  text,
  x,
  y,
  enterFrame = 0,
  highlightColor = COLORS.accent,
  orbitAngle = 0,
  orbitRadius = 0,
  center,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // 环绕运动
  const currentAngle = orbitAngle + (frame - enterFrame) * 0.008;
  const orbitX = center ? Math.cos(currentAngle) * orbitRadius : 0;
  const orbitY = center ? Math.sin(currentAngle) * orbitRadius * 0.5 : 0;

  const finalX = x + orbitX;
  const finalY = y + orbitY;

  const scale = interpolate(sp, [0, 1], [0.3, 1]);
  const opacity = interpolate(sp, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: finalX,
        top: finalY,
        transform: `scale(${scale}) translate(-50%, -50%)`,
        opacity,
        backgroundColor: "rgba(255, 255, 255, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: `1px solid rgba(201, 100, 66, 0.3)`,
        borderRadius: 999,
        padding: "14px 32px",
        boxShadow: [
          `0 4px 20px rgba(201, 100, 66, 0.12)`,
          `inset 0 0 20px rgba(201, 100, 66, 0.08)`,
        ].join(", "),
      }}
    >
      <span
        style={{
          fontFamily: FONT.ui,
          fontSize: 28,
          color: highlightColor,
          fontWeight: 600,
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
        }}
      >
        {text}
      </span>
    </div>
  );
};

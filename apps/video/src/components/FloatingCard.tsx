import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import type { LucideIcon } from "lucide-react";
import { COLORS, FONT } from "../constants";
import { Icon } from "./Icon";

interface FloatingCardProps {
  icon: LucideIcon;
  label: string;
  x: number;
  y: number;
  enterDelay?: number;
  enterFrom?: { x: number; y: number };
  dashed?: boolean;
  style?: React.CSSProperties;
  iconGradient?: [string, string];
}

/**
 * 虚线边框浮动卡片 — "浮动卡片"
 * 渐变图标 + 加强阴影 + 底部品牌色暗示 + 悬浮感
 */
export const FloatingCard: React.FC<FloatingCardProps> = ({
  icon: GlyphIcon,
  label,
  x,
  y,
  enterDelay = 0,
  enterFrom = { x: 0, y: -200 },
  dashed = true,
  style,
  iconGradient,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 10, stiffness: 80 },
  });

  const translateX = interpolate(sp, [0, 1], [enterFrom.x, 0]);
  const translateY = interpolate(sp, [0, 1], [enterFrom.y, 0]);

  // 落地后微抖动
  const jitter = sp >= 0.95
    ? Math.sin((frame - enterDelay) * 0.3) * 2
    : 0;

  // 图标渐变色
  const gradientColors = iconGradient || [COLORS.accent, COLORS.accentHover];

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 200,
        padding: "24px 16px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        border: dashed ? `2px dashed ${COLORS.fgMuted}` : `2px solid ${COLORS.borderStrong}`,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceElevated,
        transform: `translate(${translateX}px, ${translateY + jitter}px)`,
        opacity: interpolate(sp, [0, 1], [0, 1]),
        boxShadow: [
          "0 8px 32px rgba(0, 0, 0, 0.08)",
          "0 2px 8px rgba(0, 0, 0, 0.04)",
        ].join(", "),
        borderBottom: `3px solid ${COLORS.accent}15`,
        ...style,
      }}
    >
      {/* 渐变图标圆 */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: `linear-gradient(135deg, ${gradientColors[0]}, ${gradientColors[1]})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          boxShadow: `0 4px 16px ${gradientColors[0]}33`,
        }}
      >
        <Icon icon={GlyphIcon} size={28} color="#ffffff" strokeWidth={1.8} />
      </div>
      <span
        style={{
          fontFamily: FONT.ui,
          fontSize: 20,
          color: COLORS.fgSecondary,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
};

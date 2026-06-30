import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { FONT, COLORS } from "../constants";

interface SubtitleBarProps {
  text: string;
  visibleFrom?: number;
  visibleUntil?: number;
  fontSize?: number;
}

/**
 * 底部字幕条 — "品牌字幕"
 * 渐变底 + 左侧赤陶竖线 + 大字号 + 品牌色融入
 */
export const SubtitleBar: React.FC<SubtitleBarProps> = ({
  text,
  visibleFrom = 0,
  visibleUntil = 99999,
  fontSize = 40,
}) => {
  const frame = useCurrentFrame();

  // 计算淡入淡出 opacity
  let opacity = 1;
  const fadeInEnd = visibleFrom + 9;
  const fadeOutStart = visibleUntil - 9;

  if (frame < visibleFrom) {
    opacity = 0;
  } else if (frame < fadeInEnd) {
    opacity = interpolate(frame, [visibleFrom, fadeInEnd], [0, 1]);
  } else if (frame > visibleUntil) {
    opacity = 0;
  } else if (frame > fadeOutStart) {
    opacity = interpolate(frame, [fadeOutStart, visibleUntil], [1, 0]);
  }

  if (frame < visibleFrom - 5 || frame > visibleUntil + 5) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 80,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, rgba(26, 26, 26, 0.82), rgba(201, 100, 66, 0.25))",
          borderRadius: 12,
          padding: "16px 48px 16px 40px",
          opacity,
          borderLeft: `4px solid ${COLORS.accent}`,
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: FONT.ui,
            fontSize,
            color: COLORS.surfaceElevated,
            fontWeight: 500,
            letterSpacing: "0.04em",
          }}
        >
          {text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

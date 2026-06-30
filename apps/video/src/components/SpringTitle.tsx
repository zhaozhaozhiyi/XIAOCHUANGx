import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { FONT, COLORS } from "../constants";

interface SpringTitleProps {
  text: string;
  enterFrom?: "bottom" | "left" | "right";
  delay?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  style?: React.CSSProperties;
}

/**
 * 弹性弹入大标题
 * 使用 spring() 实现自然弹性动画
 */
export const SpringTitle: React.FC<SpringTitleProps> = ({
  text,
  enterFrom = "bottom",
  delay = 0,
  fontSize = 140,
  color = COLORS.fg,
  fontFamily = FONT.display,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });

  const offsetMap = {
    bottom: { x: 0, y: 120 },
    left: { x: -200, y: 0 },
    right: { x: 200, y: 0 },
  };
  const offset = offsetMap[enterFrom];

  const translateX = interpolate(sp, [0, 1], [offset.x, 0]);
  const translateY = interpolate(sp, [0, 1], [offset.y, 0]);
  const opacity = interpolate(sp, [0, 1], [0, 1]);

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        color,
        fontWeight: 600,
        lineHeight: 1.2,
        opacity,
        transform: `translate(${translateX}px, ${translateY}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

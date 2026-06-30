import React from "react";
import { COLORS } from "../constants";

interface ArrowConnectorProps {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number; // 0-1，控制绘制进度
  color?: string;
  dashed?: boolean;
  opacity?: number;
}

/**
 * SVG 箭头连接线
 * 使用 strokeDasharray + strokeDashoffset 实现渐进绘制动画
 * progress 由父组件通过 interpolate() 驱动
 */
export const ArrowConnector: React.FC<ArrowConnectorProps> = ({
  fromX,
  fromY,
  toX,
  toY,
  progress,
  color = COLORS.accent,
  dashed = true,
  opacity = 1,
}) => {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const totalLength = length;

  // 箭头头部大小
  const arrowSize = 12;
  const angle = Math.atan2(dy, dx);

  return (
    <svg
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      viewBox="0 0 1920 1080"
    >
      <line
        x1={fromX}
        y1={fromY}
        x2={toX}
        y2={toY}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "8 6" : "none"}
        strokeDashoffset={totalLength * (1 - progress)}
        opacity={opacity}
      />
      {progress > 0.9 && (
        <polygon
          points={`
            ${toX},${toY}
            ${toX - arrowSize * Math.cos(angle - 0.4)},${toY - arrowSize * Math.sin(angle - 0.4)}
            ${toX - arrowSize * Math.cos(angle + 0.4)},${toY - arrowSize * Math.sin(angle + 0.4)}
          `}
          fill={color}
          opacity={opacity * (progress - 0.9) * 10}
        />
      )}
    </svg>
  );
};

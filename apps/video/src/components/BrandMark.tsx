import React from "react";
import { COLORS } from "../constants";

interface BrandMarkProps {
  size?: number;
  opacity?: number;
  blur?: number;
  scale?: number;
  rotation?: number;
  reflection?: boolean;
  style?: React.CSSProperties;
}

/**
 * 小窗品牌标 — "发光品牌标"
 * 多层外发光 + 内环渐变 + 底部倒影
 */
export const BrandMark: React.FC<BrandMarkProps> = ({
  size = 120,
  opacity = 1,
  blur = 0,
  scale = 1,
  rotation = 0,
  reflection = true,
  style,
}) => {
  const innerSize = size * 0.55;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        ...style,
      }}
    >
      {/* 主品牌标 */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: COLORS.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: [
            `0 0 60px ${COLORS.accent}44`,
            `0 0 120px ${COLORS.accent}22`,
          ].join(", "),
          position: "relative",
        }}
      >
        <svg
          viewBox="0 0 16 16"
          width={innerSize}
          height={innerSize}
          fill="none"
        >
          <defs>
            <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#faf9f5" />
            </linearGradient>
          </defs>
          <circle
            cx="8"
            cy="8"
            r="4.5"
            stroke="url(#brandGradient)"
            strokeWidth="4"
          />
        </svg>
      </div>

      {/* 底部倒影 */}
      {reflection && (
        <div
          style={{
            width: size * 0.8,
            height: size * 0.15,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, ${COLORS.accent}33, transparent 70%)`,
            marginTop: 8,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
};

import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../constants";

/**
 * 暖纸纹理背景 — "暖纸纹理"
 * SVG 噪点纹理 + 暗角 vignette
 */
export const WarmBackground: React.FC<{ opacity?: number }> = ({
  opacity = 1,
}) => {
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* 基底色 + 微径向渐变 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: COLORS.bg,
          backgroundImage: `radial-gradient(circle at 50% 40%, ${COLORS.surface} 0%, ${COLORS.bg} 70%)`,
        }}
      />

      {/* 纸纹噪点 */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, opacity: 0.03 }}
      >
        <filter id="paperNoise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1920" height="1080" filter="url(#paperNoise)" opacity="1" />
      </svg>

      {/* 暗角 vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.04) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

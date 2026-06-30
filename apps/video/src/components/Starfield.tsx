import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../constants";

/** 确定论伪随机数，保证每帧渲染一致 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

interface Star {
  id: number;
  cx: number;
  cy: number;
  r: number;
  baseOpacity: number;
  speed: number;
  phase: number;
  color: string;
}

function generateStars(count: number, seed = 42): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    cx: seededRandom(i * 3 + seed) * 1920,
    cy: seededRandom(i * 3 + 1 + seed) * 1080,
    r: 0.5 + seededRandom(i * 3 + 2 + seed) * 2.5,
    baseOpacity: 0.15 + seededRandom(i * 5 + seed) * 0.5,
    speed: 0.1 + seededRandom(i * 7 + seed) * 0.3,
    phase: seededRandom(i * 11 + seed) * Math.PI * 2,
    color: seededRandom(i * 13 + seed) > 0.8 ? "#f5f4ed" : COLORS.accent,
  }));
}

const STARS = generateStars(200);

interface StarfieldProps {
  opacity?: number;
}

/**
 * 深墨色星空粒子背景 — "高级星空"
 * 200 颗混合色星点 + 中心径向光晕 + 缓慢漂移
 */
export const Starfield: React.FC<StarfieldProps> = ({ opacity = 1 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark, opacity }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          {/* 中心微光 */}
          <radialGradient id="starfieldGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.06" />
            <stop offset="60%" stopColor={COLORS.accent} stopOpacity="0.02" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 中心光晕 */}
        <rect x="0" y="0" width="1920" height="1080" fill="url(#starfieldGlow)" />

        {STARS.map((star) => {
          // 星点缓慢向上漂移
          const drift = interpolate(
            frame,
            [0, 3000],
            [0, -star.speed * 3000],
            { extrapolateRight: "wrap" }
          );
          const cy = ((star.cy + drift) % 1080 + 1080) % 1080;

          // 闪烁效果
          const twinkle = interpolate(
            Math.sin(frame * 0.03 + star.phase),
            [-1, 1],
            [0.6, 1]
          );

          return (
            <circle
              key={star.id}
              cx={star.cx}
              cy={cy}
              r={star.r}
              fill={star.color}
              opacity={star.baseOpacity * twinkle}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

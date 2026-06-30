import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { Starfield } from "../components/Starfield";
import { BrandMark } from "../components/BrandMark";
import { FONT, COLORS } from "../constants";

/**
 * 第一幕 · 开场（0–6s，帧 0–180）
 *
 * Shot01 (0–3s): 星空背景 + 品牌标从模糊渐清、居中放大
 * Shot02 (3–6s): 品牌标 docking 进入"图标 + 文字"水平锁定组（居中、对齐、尺寸协调）
 */
export const Scene01_Opening: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Shot01: 独立居中品牌标 ──
  const markOpacity = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });
  const markBlur = interpolate(frame, [0, 60], [20, 0], {
    extrapolateRight: "clamp",
  });
  const markScale = interpolate(frame, [0, 90], [1.5, 1], {
    easing: Easing.out(Easing.cubic),
    extrapolateRight: "clamp",
  });

  // Shot01 → Shot02 交叉淡出（独立标淡出）
  const standaloneOpacity = interpolate(frame, [82, 104], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Shot02: 锁定组淡入 ──
  const lockupOpacity = interpolate(frame, [92, 116], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 文字相对图标的轻微滑入
  const wordmarkShiftX = interpolate(frame, [96, 128], [40, 0], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wordmarkOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // 英文副标渐现
  const englishOpacity = interpolate(frame, [138, 168], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 统一锁定尺寸：图标与"小窗"字号同量级，确保大小协调
  const LOGO = 132;
  const WORD = 128;

  return (
    <AbsoluteFill>
      <Starfield />

      {/* Shot01: 独立居中品牌标 */}
      {frame < 110 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: standaloneOpacity,
          }}
        >
          <BrandMark
            size={LOGO}
            opacity={markOpacity}
            blur={markBlur}
            scale={markScale}
            reflection={false}
          />
        </div>
      )}

      {/* Shot02: 图标 + 文字 水平锁定组（整体居中 + 垂直居中对齐） */}
      {frame >= 90 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            gap: 36,
            opacity: lockupOpacity,
          }}
        >
          {/* 图标 */}
          <BrandMark size={LOGO} reflection={false} />

          {/* 竖向分隔线 */}
          <div
            style={{
              width: 2,
              height: LOGO * 0.62,
              background: `linear-gradient(${COLORS.borderStrong}, transparent)`,
              opacity: wordmarkOpacity * 0.8,
            }}
          />

          {/* 文字组 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transform: `translateX(${wordmarkShiftX}px)`,
              opacity: wordmarkOpacity,
            }}
          >
            <span
              style={{
                fontFamily: FONT.display,
                fontSize: WORD,
                lineHeight: 1,
                color: COLORS.accent,
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              小窗
            </span>
            <span
              style={{
                fontFamily: FONT.ui,
                fontSize: 26,
                color: COLORS.fgMuted,
                letterSpacing: "0.34em",
                marginTop: 14,
                opacity: englishOpacity,
              }}
            >
              XIAOCHUANG
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

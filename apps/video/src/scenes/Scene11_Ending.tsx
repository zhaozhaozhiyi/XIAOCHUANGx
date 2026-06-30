import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { Starfield } from "../components/Starfield";
import { BrandMark } from "../components/BrandMark";
import { TypewriterText } from "../components/TypewriterText";
import { FONT, COLORS } from "../constants";

/**
 * 第十一幕 · 品牌收尾（118–128s，帧 0–300）
 *
 * Shot36 (0–3s): 淡回星空 + 品牌标
 * Shot37 (3–7s): "小窗" + 标语
 * Shot38 (7–10s): QR 码 + 版本号
 */
export const Scene11_Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 品牌标
  const markSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 80 },
  });
  const markScale = interpolate(markSpring, [0, 1], [0, 1]);
  const markOpacity = interpolate(markSpring, [0, 1], [0, 1]);

  // "小窗" 标题
  const titleOpacity = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 标语打字机
  const taglineStartFrame = 100;

  // 品牌标微旋转
  const ringRotation = Math.sin(frame * 0.02) * 3;

  // QR 码
  const qrOpacity = interpolate(frame, [200, 230], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 版本号
  const versionOpacity = interpolate(frame, [220, 250], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Starfield />

      {/* 品牌标 */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${markScale}) rotate(${ringRotation}deg)`,
          opacity: markOpacity,
        }}
      >
        <BrandMark size={140} />
      </div>

      {/* "小窗" 标题 */}
      <div
        style={{
          position: "absolute",
          top: "26%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontFamily: FONT.display,
            fontSize: 100,
            color: COLORS.accent,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          小窗
        </span>
      </div>

      {/* 标语 */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        {frame >= taglineStartFrame && (
          <TypewriterText
            text="专注 works 的智能工作台"
            startFrame={taglineStartFrame}
            charsPerFrame={3}
            fontSize={32}
            color={COLORS.fgMuted}
          />
        )}
      </div>

      {/* QR 码区域 */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: qrOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* QR 码占位 */}
        <div
          style={{
            width: 120,
            height: 120,
            backgroundColor: COLORS.surfaceElevated,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <span style={{ fontFamily: FONT.ui, fontSize: 12, color: COLORS.fgTertiary }}>
            QR Code
          </span>
        </div>

        {/* 下载提示 */}
        <span
          style={{
            fontFamily: FONT.ui,
            fontSize: 18,
            color: COLORS.fgMuted,
            opacity: versionOpacity,
          }}
        >
          即刻体验 · Desktop Alpha
        </span>

        {/* 版本号 */}
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 14,
            color: COLORS.fgTertiary,
            opacity: versionOpacity,
          }}
        >
          v0.1.0-alpha
        </span>
      </div>
    </AbsoluteFill>
  );
};

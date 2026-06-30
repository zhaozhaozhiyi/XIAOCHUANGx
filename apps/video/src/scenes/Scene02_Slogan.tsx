import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { WarmBackground } from "../components/WarmBackground";
import { SpringTitle } from "../components/SpringTitle";
import { TypewriterText } from "../components/TypewriterText";
import { FONT, COLORS } from "../constants";

/**
 * 第二幕 · 核心口号（6–12s，帧 0–180）
 *
 * Shot03 (0–3s): 暖纸底 + "专注 works" 弹入 + "小窗专注 works，把活干完" 打字机
 * Shot04 (3–6s): "一个工作台" 替换 + "研究·写作·演示" 依次亮赤陶色
 */
export const Scene02_Slogan: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Shot03 → Shot04 过渡 ──

  // "专注 works" 上移淡出
  const title1Opacity = interpolate(frame, [80, 95], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const title1TranslateY = interpolate(frame, [80, 95], [0, -80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "一个工作台" 弹入
  const title2Spring = spring({
    frame: frame - 85,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.8 },
  });
  const title2Opacity = interpolate(title2Spring, [0, 1], [0, 1]);
  const title2TranslateY = interpolate(title2Spring, [0, 1], [80, 0]);

  // 五个关键词依次变色
  const keywords = ["研究", "写作", "演示", "制图", "推演"];
  const keywordFrames = [105, 115, 125, 135, 145];

  return (
    <AbsoluteFill>
      <WarmBackground />

      {/* 左侧大标题 — "专注 works" */}
      <div
        style={{
          position: "absolute",
          left: 200,
          top: "50%",
          transform: `translateY(calc(-50% + ${title1TranslateY}px))`,
          opacity: title1Opacity,
        }}
      >
        <SpringTitle
          text="专注 works"
          enterFrom="bottom"
          delay={5}
          fontSize={160}
          color={COLORS.fg}
        />
      </div>

      {/* 右侧打字机文字 */}
      <div
        style={{
          position: "absolute",
          right: 200,
          top: "calc(50% + 40px)",
          textAlign: "right",
        }}
      >
        <TypewriterText
          text="小窗专注 works，把活干完"
          startFrame={25}
          charsPerFrame={4}
          fontSize={28}
          color={COLORS.fgSecondary}
        />
      </div>

      {/* 左侧大标题 — "一个工作台" */}
      {frame > 80 && (
        <div
          style={{
            position: "absolute",
            left: 200,
            top: "50%",
            transform: `translateY(calc(-50% + ${title2TranslateY}px))`,
            opacity: title2Opacity,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 160,
              color: COLORS.fg,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            一个工作台
          </span>
        </div>
      )}

      {/* 关键词 */}
      {frame > 100 && (
        <div
          style={{
            position: "absolute",
            left: 200,
            top: "calc(50% + 100px)",
            display: "flex",
            gap: 40,
          }}
        >
          {keywords.map((kw, i) => {
            const kf = keywordFrames[i];
            const isActive = frame >= kf;
            const sp = spring({
              frame: frame - kf,
              fps,
              config: { damping: 14, stiffness: 120 },
            });
            const opacity = interpolate(sp, [0, 1], [0, 1]);
            return (
              <span
                key={kw}
                style={{
                  fontFamily: FONT.display,
                  fontSize: 48,
                  color: isActive ? COLORS.accent : COLORS.fgTertiary,
                  fontWeight: 600,
                  opacity,
                  transition: "color 0.3s",
                }}
              >
                {kw}
              </span>
            );
          })}
          <span
            style={{
              fontFamily: FONT.ui,
              fontSize: 36,
              color: COLORS.fgTertiary,
              opacity: interpolate(
                spring({
                  frame: frame - 155,
                  fps,
                  config: { damping: 14, stiffness: 120 },
                }),
                [0, 1],
                [0, 1]
              ),
            }}
          >
            ，一站完成
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

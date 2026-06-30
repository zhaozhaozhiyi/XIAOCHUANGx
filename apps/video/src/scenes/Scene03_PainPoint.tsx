import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from "remotion";
import { Globe, FileText, MessageSquare, Presentation } from "lucide-react";
import { WarmBackground } from "../components/WarmBackground";
import { FloatingCard } from "../components/FloatingCard";
import { ArrowConnector } from "../components/ArrowConnector";
import { BrandMark } from "../components/BrandMark";
import { SubtitleBar } from "../components/SubtitleBar";
import { FONT, COLORS } from "../constants";

/**
 * 第三幕 · 痛点共鸣（12–20s，帧 0–240）
 *
 * Shot05 (0–2s): 4 个工具卡片从四面飞入
 * Shot06 (2–4s): 红色虚线箭头 + "???" + 画面微震
 * Shot07 (4–6s): 卡片吸入品牌标
 * Shot08 (6–8s): 品牌标 morph 为产品窗口
 */
export const Scene03_PainPoint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 卡片位置
  const cards = [
    { icon: Globe, label: "浏览器", x: 360, y: 200, enterFrom: { x: -200, y: 0 } },
    { icon: FileText, label: "文档", x: 1360, y: 200, enterFrom: { x: 200, y: 0 } },
    { icon: MessageSquare, label: "聊天工具", x: 360, y: 680, enterFrom: { x: 0, y: 200 } },
    { icon: Presentation, label: "PPT", x: 1360, y: 680, enterFrom: { x: 0, y: -200 } },
  ];

  // ── Shot06: 箭头 + "???" + 微震 ──
  const arrowProgress = interpolate(frame, [60, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowFlashOpacity = frame >= 60 && frame < 120
    ? 0.4 + Math.sin(frame * 0.5) * 0.4
    : 0;

  const questionOpacity = interpolate(frame, [80, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 画面微震
  const shakeX = frame >= 60 && frame < 120
    ? Math.sin(frame * 2) * 3
    : 0;
  const shakeY = frame >= 60 && frame < 120
    ? Math.cos(frame * 2.5) * 2
    : 0;

  // ── Shot07: 卡片吸入品牌标 ──
  const convergeProgress = interpolate(frame, [120, 160], [0, 1], {
    easing: Easing.in(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 品牌标出现
  const markScale = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const markOpacity = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Shot08: 品牌标 morph 为窗口 ──
  const morphScale = interpolate(frame, [180, 210], [1, 3.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const morphRadius = interpolate(frame, [180, 210], [22, 12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const windowContentOpacity = interpolate(frame, [195, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 卡片在各阶段的位置
  const getCardTransform = (index: number) => {
    const card = cards[index];
    // Shot07: 向中心收敛
    const centerX = 960;
    const centerY = 540;
    const cardCenterX = card.x + 100;
    const cardCenterY = card.y + 60;

    const convergeX = interpolate(convergeProgress, [0, 1], [0, centerX - cardCenterX]);
    const convergeY = interpolate(convergeProgress, [0, 1], [0, centerY - cardCenterY]);
    const convergeScale = interpolate(convergeProgress, [0, 1], [1, 0]);
    const convergeOpacity = interpolate(convergeProgress, [0, 0.8], [1, 0], {
      extrapolateRight: "clamp",
    });

    return { convergeX, convergeY, convergeScale, convergeOpacity };
  };

  return (
    <AbsoluteFill
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}
    >
      <WarmBackground />

      {/* 四张卡片 */}
      {frame < 180 &&
        cards.map((card, i) => {
          const t = getCardTransform(i);
          const isVisible = frame < 170;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: card.x + t.convergeX,
                top: card.y + t.convergeY,
                transform: `scale(${t.convergeScale})`,
                opacity: t.convergeOpacity,
              }}
            >
              <FloatingCard
                icon={card.icon}
                label={card.label}
                x={0}
                y={0}
                enterDelay={i * 12}
                enterFrom={card.enterFrom}
              />
            </div>
          );
        })}

      {/* 箭头 */}
      {frame >= 60 && frame < 120 && (
        <>
          <ArrowConnector
            fromX={560} fromY={280} toX={1360} toY={280}
            progress={arrowProgress}
            opacity={arrowFlashOpacity}
            dashed
          />
          <ArrowConnector
            fromX={1360} fromY={740} toX={560} toY={740}
            progress={arrowProgress}
            opacity={arrowFlashOpacity}
            dashed
          />
          <ArrowConnector
            fromX={460} fromY={380} toX={1460} toY={680}
            progress={arrowProgress}
            opacity={arrowFlashOpacity * 0.7}
            dashed
          />
        </>
      )}

      {/* "???" */}
      {frame >= 80 && frame < 130 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: questionOpacity,
          }}
        >
          <span
            style={{
              fontFamily: FONT.display,
              fontSize: 100,
              color: COLORS.danger,
              fontWeight: 700,
            }}
          >
            ???
          </span>
        </div>
      )}

      {/* 品牌标（收敛 + morph 阶段） */}
      {frame >= 120 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${frame >= 180 ? morphScale : markScale})`,
            opacity: frame >= 180 ? 1 : markOpacity,
          }}
        >
          <div
            style={{
              width: 160,
              height: 160 * (frame >= 180 ? 0.6 : 1),
              borderRadius: frame >= 180 ? morphRadius : 22,
              backgroundColor: COLORS.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {frame >= 195 && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: windowContentOpacity,
                  color: COLORS.bg,
                  fontFamily: FONT.ui,
                  fontSize: 14,
                }}
              >
                产品界面
              </div>
            )}
          </div>
        </div>
      )}

      {/* 字幕 */}
      <SubtitleBar text="现在，一个小窗就够了" visibleFrom={160} visibleUntil={230} />
    </AbsoluteFill>
  );
};

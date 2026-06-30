import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS, FONT } from "../constants";

interface ProductScreenFrameProps {
  src?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  borderRadius?: number;
  enterFrom?: "scale" | "right" | "center";
  enterDelay?: number;
  title?: string;
  children?: React.ReactNode;
}

/**
 * 产品界面录屏框架 — "发布会窗口"
 * 多层阴影 + 毛玻璃标题栏 + 赤陶色渐变光条 + 大圆角
 */
export const ProductScreenFrame: React.FC<ProductScreenFrameProps> = ({
  x = 0,
  y = 0,
  width = 1600,
  height = 900,
  borderRadius = 16,
  enterFrom = "scale",
  enterDelay = 0,
  title = "Xiaochuang",
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const sp = spring({
    frame: frame - enterDelay,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const scaleMap = {
    scale: interpolate(sp, [0, 1], [0.6, 1]),
    right: 1,
    center: interpolate(sp, [0, 1], [0.8, 1]),
  };
  const scale = scaleMap[enterFrom];

  const translateXMap = {
    scale: 0,
    right: interpolate(sp, [0, 1], [400, 0]),
    center: 0,
  };
  const translateX = translateXMap[enterFrom];

  const opacity = interpolate(sp, [0, 1], [0, 1]);

  // 多层阴影：环境光 + 方向光 + 品牌色微辉光
  const boxShadow = [
    "0 4px 12px rgba(0, 0, 0, 0.06)",       // ambient
    "0 16px 48px rgba(0, 0, 0, 0.12)",        // directional
    `0 0 80px rgba(201, 100, 66, 0.08)`,      // accent glow
  ].join(", ");

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        borderRadius,
        overflow: "hidden",
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.borderStrong}`,
        boxShadow,
        transform: `translate(${translateX}px, 0) scale(${scale})`,
        opacity,
      }}
    >
      {/* 标题栏 — 毛玻璃 + 窗口按钮 + 标题文字 */}
      <div
        style={{
          height: 40,
          backgroundColor: "rgba(250, 249, 245, 0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          paddingLeft: 16,
          gap: 8,
          position: "relative",
        }}
      >
        {/* 窗口按钮 */}
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#ffbd2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#28c840" }} />

        {/* 窗口标题 */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontFamily: FONT.ui,
            fontSize: 13,
            color: COLORS.fgTertiary,
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </div>

        {/* 赤陶色渐变光条 */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${COLORS.accent}66, transparent)`,
          }}
        />
      </div>

      {/* 内容区 */}
      <div style={{ width: "100%", height: height - 40, overflow: "hidden" }}>
        {children || (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.fgMuted,
              fontSize: 20,
              fontFamily: FONT.ui,
            }}
          >
            产品界面
          </div>
        )}
      </div>
    </div>
  );
};

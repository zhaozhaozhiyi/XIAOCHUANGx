import React from "react";
import { useCurrentFrame } from "remotion";
import { FONT, COLORS } from "../constants";

interface TypewriterTextProps {
  text: string;
  startFrame?: number;
  charsPerFrame?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  showCursor?: boolean;
  style?: React.CSSProperties;
}

/**
 * 逐字显示文字 + 闪烁光标
 * 使用 useCurrentFrame 计算可见字符数
 */
export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame = 0,
  charsPerFrame = 3,
  fontSize = 28,
  color = COLORS.fgSecondary,
  fontFamily = FONT.ui,
  showCursor = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const visibleChars = Math.min(text.length, Math.floor(elapsed * charsPerFrame));
  const visibleText = text.slice(0, visibleChars);

  // 光标闪烁：每 15 帧切换
  const cursorVisible = showCursor && Math.floor(frame / 15) % 2 === 0;

  return (
    <span
      style={{
        fontFamily,
        fontSize,
        color,
        ...style,
      }}
    >
      {visibleText}
      {cursorVisible && (
        <span
          style={{
            borderLeft: `2px solid ${color}`,
            marginLeft: 2,
            animation: "none",
          }}
        >
          {"​"}
        </span>
      )}
    </span>
  );
};

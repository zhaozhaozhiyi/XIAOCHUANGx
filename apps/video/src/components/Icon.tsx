import React from "react";
import type { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

/**
 * 统一图标封装 — 基于 lucide-react 图标库
 * 全站图标统一走这里，确保线宽 / 对齐 / 尺寸一致，杜绝表情符号。
 */
export const Icon: React.FC<IconProps> = ({
  icon: LucideGlyph,
  size = 16,
  color = "currentColor",
  strokeWidth = 2,
  style,
}) => (
  <LucideGlyph
    size={size}
    color={color}
    strokeWidth={strokeWidth}
    style={{ flexShrink: 0, display: "block", ...style }}
  />
);

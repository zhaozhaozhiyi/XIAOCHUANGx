import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "../constants";

/** 深墨色背景 #1a1a1a */
export const DarkBackground: React.FC<{ opacity?: number }> = ({
  opacity = 1,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.dark,
        opacity,
      }}
    />
  );
};

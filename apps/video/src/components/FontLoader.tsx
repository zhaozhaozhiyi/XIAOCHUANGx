import { useEffect } from "react";
import { loadFont } from "@remotion/google-fonts/NotoSerifSC";

/**
 * 在组合层挂载，确保 Noto Serif SC 字体在渲染前加载完成。
 * Remotion 的 headless 渲染器需要显式加载字体。
 */
export function FontLoader() {
  useEffect(() => {
    loadFont();
  }, []);
  return null;
}

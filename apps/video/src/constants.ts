/**
 * 小窗宣传片 — 品牌常量
 * 色值对齐 web/src/app/globals.css :root 变量
 */

export const COLORS = {
  accent: "#c96442",
  accentHover: "#b85c3d",
  accentMuted: "#f5ebe6",
  accentWarm: "#d97757",
  bg: "#f5f4ed",
  surface: "#faf9f5",
  surfaceElevated: "#ffffff",
  dark: "#1a1a1a",
  fg: "#141413",
  fgSecondary: "#5e5d59",
  fgTertiary: "#87867f",
  fgMuted: "#b0aea5",
  border: "#f0eee6",
  borderStrong: "#e8e6dc",
  success: "#2d6a4f",
  danger: "#b53333",
} as const;

export const FONT = {
  display: "Noto Serif SC",
  ui: "Geist, system-ui, sans-serif",
  mono: "ui-monospace, SF Mono, Menlo, monospace",
} as const;

export const VIDEO = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 128 * 30, // 3840
} as const;

/** 场景时间表（帧数） — v2.0 / 128s / 11 幕 */
export const SCENE_TIMINGS = [
  { from: 0, duration: 180 },     // Scene01 Opening: 0–6s
  { from: 180, duration: 180 },   // Scene02 Slogan: 6–12s
  { from: 360, duration: 240 },   // Scene03 PainPoint: 12–20s
  { from: 600, duration: 360 },   // Scene04 ChatResearch: 20–32s
  { from: 960, duration: 420 },   // Scene05 Writing: 32–46s
  { from: 1380, duration: 480 },  // Scene06 PPT: 46–62s
  { from: 1860, duration: 420 },  // Scene07 IndustrialDrawing: 62–76s
  { from: 2280, duration: 480 },  // Scene08 Simulation: 76–92s
  { from: 2760, duration: 360 },  // Scene09 Workspace: 92–104s
  { from: 3120, duration: 420 },  // Scene10 Montage: 104–118s
  { from: 3540, duration: 300 },  // Scene11 Ending: 118–128s
] as const;

/** 秒 → 帧 */
export const sec = (s: number) => Math.round(s * VIDEO.fps);

/** 帧 → 秒 */
export const toSec = (f: number) => f / VIDEO.fps;

/** cross-dissolve 过渡帧数 */
export const TRANSITION_FRAMES = 9; // 0.3s @ 30fps

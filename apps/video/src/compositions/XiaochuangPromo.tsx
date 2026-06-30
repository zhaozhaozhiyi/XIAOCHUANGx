import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { FontLoader } from "../components/FontLoader";
import { Scene01_Opening } from "../scenes/Scene01_Opening";
import { Scene02_Slogan } from "../scenes/Scene02_Slogan";
import { Scene03_PainPoint } from "../scenes/Scene03_PainPoint";
import { Scene04_ChatResearch } from "../scenes/Scene04_ChatResearch";
import { Scene05_Writing } from "../scenes/Scene05_Writing";
import { Scene06_PPT } from "../scenes/Scene06_PPT";
import { Scene07_IndustrialDrawing } from "../scenes/Scene07_IndustrialDrawing";
import { Scene08_Simulation } from "../scenes/Scene08_Simulation";
import { Scene09_Workspace } from "../scenes/Scene09_Workspace";
import { Scene10_Montage } from "../scenes/Scene10_Montage";
import { Scene11_Ending } from "../scenes/Scene11_Ending";
import { SCENE_TIMINGS, TRANSITION_FRAMES, COLORS } from "../constants";

/**
 * 小窗产品宣传片 — 主组合（128s / 3840 帧 / 30fps / 1920×1080）
 *
 * 11 个场景按时间排列，相邻场景重叠 TRANSITION_FRAMES 帧实现 cross-dissolve。
 * 场景切换通过 opacity 交叉淡入淡出实现。
 */
export const XiaochuangPromo: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.dark }}>
      <FontLoader />

      {/* ── Scene01: 开场 (0–6s) ── */}
      <Sequence from={SCENE_TIMINGS[0].from} durationInFrames={SCENE_TIMINGS[0].duration}>
        <Scene01_Opening />
      </Sequence>

      {/* ── Scene02: 核心口号 (6–12s) ── */}
      <Sequence from={SCENE_TIMINGS[1].from} durationInFrames={SCENE_TIMINGS[1].duration}>
        <Scene02_Slogan />
      </Sequence>

      {/* ── Scene03: 痛点共鸣 (12–20s) ── */}
      <Sequence from={SCENE_TIMINGS[2].from} durationInFrames={SCENE_TIMINGS[2].duration}>
        <Scene03_PainPoint />
      </Sequence>

      {/* ── Scene04: 对话研究 (20–32s) ── */}
      <Sequence from={SCENE_TIMINGS[3].from} durationInFrames={SCENE_TIMINGS[3].duration}>
        <Scene04_ChatResearch />
      </Sequence>

      {/* ── Scene05: 写作能力 (32–46s) ── */}
      <Sequence from={SCENE_TIMINGS[4].from} durationInFrames={SCENE_TIMINGS[4].duration}>
        <Scene05_Writing />
      </Sequence>

      {/* ── Scene06: PPT 能力 (46–62s) ── */}
      <Sequence from={SCENE_TIMINGS[5].from} durationInFrames={SCENE_TIMINGS[5].duration}>
        <Scene06_PPT />
      </Sequence>

      {/* ── Scene07: 工业制图 (62–76s) ── */}
      <Sequence from={SCENE_TIMINGS[6].from} durationInFrames={SCENE_TIMINGS[6].duration}>
        <Scene07_IndustrialDrawing />
      </Sequence>

      {/* ── Scene08: 推演 (76–92s) ── */}
      <Sequence from={SCENE_TIMINGS[7].from} durationInFrames={SCENE_TIMINGS[7].duration}>
        <Scene08_Simulation />
      </Sequence>

      {/* ── Scene09: 工作区 + 引擎 (92–104s) ── */}
      <Sequence from={SCENE_TIMINGS[8].from} durationInFrames={SCENE_TIMINGS[8].duration}>
        <Scene09_Workspace />
      </Sequence>

      {/* ── Scene10: 全场景串联 (104–118s) ── */}
      <Sequence from={SCENE_TIMINGS[9].from} durationInFrames={SCENE_TIMINGS[9].duration}>
        <Scene10_Montage />
      </Sequence>

      {/* ── Scene11: 品牌收尾 (118–128s) ── */}
      <Sequence from={SCENE_TIMINGS[10].from} durationInFrames={SCENE_TIMINGS[10].duration}>
        <Scene11_Ending />
      </Sequence>

      {/* ── 音频（当资源就绪时启用） ── */}
      {/* <Audio src={staticFile("audio/bgm.mp3")} volume={(f) => {
        if (f < 600) return 0.2;
        if (f < 2280) return 0.4;
        if (f < 2760) return 0.25;
        if (f < 3120) return 0.4;
        return interpolate(f, [3540, 3840], [0.4, 0.2]);
      }} /> */}
      {/* <Audio src={staticFile("audio/voiceover.mp3")} volume={1} /> */}
    </AbsoluteFill>
  );
};

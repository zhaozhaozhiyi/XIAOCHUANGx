import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/animations.css";

import { useCallback } from "react";
import { CanvasSurface } from "./components/CanvasSurface";
import { CueRail } from "./components/CueRail";
import { LaunchGate } from "./components/LaunchGate";
import { ModeDial } from "./components/ModeDial";
import { PreviewDeck } from "./components/PreviewDeck";
import { useCueCursor } from "./hooks/useCueCursor";
import { usePlaybackProfile } from "./hooks/usePlaybackProfile";
import { useVoiceTrack } from "./hooks/useVoiceTrack";
import { SCORE } from "./runtime/score";

function estimateMs(text: string) {
  if (!text) return 1400;
  return Math.max(1400, text.length * 250);
}

function isPreviewMode() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function StudioApp() {
  const cursor = useCueCursor(SCORE);
  const active = SCORE[cursor.cursor.sequence]!;
  const Scene = active.Scene;
  const cue = active.cues[cursor.cursor.beat] ?? "";
  const playback = usePlaybackProfile();

  const voiceSrc =
    playback.mode === "manual" || cue === ""
      ? null
      : `${import.meta.env.BASE_URL}voice/${active.id}/${cursor.cursor.beat + 1}.mp3`;

  const onCaptureAdvance = useCallback(() => cursor.next(), [cursor]);

  useVoiceTrack({
    src: voiceSrc,
    mode: playback.mode,
    trailMs: 160,
    estimateFallbackMs: estimateMs(cue),
    onAutoAdvance: onCaptureAdvance,
    autoStarted: playback.captureArmed,
  });

  return (
    <>
      <CanvasSurface onAdvance={cursor.next}>
        <div key={active.id} className="scene">
          <Scene beat={cursor.cursor.beat} />
        </div>
      </CanvasSurface>
      <CueRail
        sequences={SCORE}
        cursor={cursor.cursor}
        onJumpSequence={cursor.jumpToSequence}
      />
      <ModeDial mode={playback.mode} onCycle={playback.cycleMode} />
      <LaunchGate
        visible={playback.mode === "capture" && !playback.captureArmed}
        onStart={() => playback.setCaptureArmed(true)}
      />
    </>
  );
}

export default function App() {
  return isPreviewMode() ? <PreviewDeck sequences={SCORE} /> : <StudioApp />;
}

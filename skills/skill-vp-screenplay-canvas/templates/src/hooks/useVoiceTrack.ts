import { useEffect, useRef } from "react";

export type PlaybackMode = "manual" | "voice" | "capture";

interface Options {
  src: string | null;
  mode: PlaybackMode;
  trailMs?: number;
  estimateFallbackMs?: number;
  onAutoAdvance: () => void;
  autoStarted: boolean;
}

export function useVoiceTrack({
  src,
  mode,
  trailMs = 200,
  estimateFallbackMs = 1500,
  onAutoAdvance,
  autoStarted,
}: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onAdvanceRef = useRef(onAutoAdvance);
  onAdvanceRef.current = onAutoAdvance;

  useEffect(() => {
    const prev = audioRef.current;
    if (prev) {
      prev.pause();
      prev.removeAttribute("src");
      prev.load();
      audioRef.current = null;
    }

    if (mode === "manual") return;
    if (mode === "capture" && !autoStarted) return;

    let advanced = false;
    let timer: number | null = null;

    const advanceAfter = (ms: number) => {
      if (mode !== "capture" || advanced) return;
      timer = window.setTimeout(() => {
        if (advanced) return;
        advanced = true;
        onAdvanceRef.current();
      }, Math.max(0, ms));
    };

    if (src) {
      const audio = new Audio(src);
      audioRef.current = audio;
      audio.preload = "auto";
      audio.addEventListener("ended", () => advanceAfter(trailMs));
      audio.addEventListener("error", () => {
        if (mode === "capture") advanceAfter(estimateFallbackMs);
      });
      audio.play().catch((err) => {
        console.warn("voice playback failed:", err);
        if (mode === "capture") advanceAfter(estimateFallbackMs);
      });
    } else if (mode === "capture") {
      advanceAfter(estimateFallbackMs);
    }

    return () => {
      advanced = true;
      if (timer != null) clearTimeout(timer);
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audioRef.current = null;
      }
    };
  }, [src, mode, trailMs, estimateFallbackMs, autoStarted]);
}

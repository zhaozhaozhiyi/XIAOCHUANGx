import { useCallback, useEffect, useState } from "react";
import type { PlaybackMode } from "./useVoiceTrack";

const ORDER: PlaybackMode[] = ["manual", "voice", "capture"];

function readModeFromURL(): PlaybackMode {
  if (typeof window === "undefined") return "manual";
  const q = new URLSearchParams(window.location.search);
  if (q.get("capture") === "1") return "capture";
  if (q.get("voice") === "1") return "voice";
  return "manual";
}

export function usePlaybackProfile() {
  const [mode, setModeState] = useState<PlaybackMode>(() => readModeFromURL());
  const [captureArmed, setCaptureArmed] = useState(false);

  const setMode = useCallback((next: PlaybackMode) => {
    setModeState(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("voice");
    url.searchParams.delete("capture");
    if (next === "voice") url.searchParams.set("voice", "1");
    if (next === "capture") url.searchParams.set("capture", "1");
    window.history.replaceState(null, "", url.toString());
    if (next !== "capture") setCaptureArmed(false);
  }, []);

  const cycleMode = useCallback(() => {
    setMode(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!);
  }, [mode, setMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        cycleMode();
      } else if (event.key === " " && mode === "capture" && !captureArmed) {
        event.preventDefault();
        setCaptureArmed(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, captureArmed, cycleMode]);

  return { mode, setMode, cycleMode, captureArmed, setCaptureArmed };
}

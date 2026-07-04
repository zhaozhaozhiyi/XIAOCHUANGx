import type { PlaybackMode } from "../hooks/useVoiceTrack";
import "./ModeDial.css";

interface Props {
  mode: PlaybackMode;
  onCycle(): void;
}

const LABEL: Record<PlaybackMode, string> = {
  manual: "MANUAL",
  voice: "VOICE",
  capture: "CAPTURE",
};

export function ModeDial({ mode, onCycle }: Props) {
  return (
    <div className="md-hover" data-no-advance>
      <button
        className={`md-btn md-${mode}`}
        onClick={(e) => {
          e.stopPropagation();
          onCycle();
        }}
        title="Switch playback profile (P)"
      >
        <span className="md-dot" />
        <span className="md-label">{LABEL[mode]}</span>
      </button>
    </div>
  );
}

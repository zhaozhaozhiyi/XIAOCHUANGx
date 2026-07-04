import "./LaunchGate.css";

interface Props {
  visible: boolean;
  onStart(): void;
}

export function LaunchGate({ visible, onStart }: Props) {
  if (!visible) return null;
  return (
    <div
      className="launch-gate"
      data-no-advance
      onClick={onStart}
      role="button"
      tabIndex={0}
    >
      <div className="launch-gate-card">
        <div className="launch-gate-kicker">CAPTURE PASS</div>
        <div className="launch-gate-title">Press SPACE to roll</div>
        <div className="launch-gate-sub">
          Voice playback will drive the cue timeline.
          <br />
          Press <kbd>P</kbd> any time to change playback profile.
        </div>
      </div>
    </div>
  );
}

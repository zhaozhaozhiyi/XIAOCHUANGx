import { WordCut } from "../../components/WordCut";
import type { SceneBeatProps } from "../../runtime/models";
import "./PilotScene.css";

export default function PilotScene({ beat }: SceneBeatProps) {
  if (beat === 0) {
    return (
      <div className="pilot-scene scene-pad">
        <div className="pilot-hero">
          <div className="kicker">Sequence 01 / Pilot</div>
          <h1 className="pilot-title">
            <WordCut show duration={900}>
              <span className="serif-cn">这不是</span>
            </WordCut>
            <WordCut show delay={220} duration={900}>
              <span className="serif-it pilot-accent">PPT</span>
            </WordCut>
            <WordCut show delay={420} duration={900}>
              <span className="serif-cn">，而是屏幕叙事。</span>
            </WordCut>
          </h1>
          <p className="pilot-copy">
            Screenplay Canvas treats the browser like a directed surface:
            cue-driven, voice-aware, and clean enough to record as a finished
            story.
          </p>
        </div>
      </div>
    );
  }

  if (beat === 1) {
    return (
      <div className="pilot-scene scene-pad">
        <div className="pilot-grid">
          <div className="pilot-mark hero-num">02</div>
          <div className="pilot-body">
            <div className="kicker">One beat / one focus</div>
            <h2 className="pilot-subtitle">
              <WordCut show duration={900}>
                <span className="serif-cn">每一拍只讲一件事，</span>
              </WordCut>
              <WordCut show delay={250} duration={900}>
                <span className="serif-it pilot-accent">cue</span>
              </WordCut>
              <WordCut show delay={420} duration={900}>
                <span className="serif-cn"> 是节奏真相源。</span>
              </WordCut>
            </h2>
            <p className="pilot-copy">
              Sequences own structure. Cues own pacing. The visual layer follows
              the score instead of drifting away from it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pilot-scene pilot-close scene-pad">
      <div className="pilot-quote pull-quote">
        <WordCut show duration={1000}>
          <span className="serif-cn">Replace this pilot with your own </span>
        </WordCut>
        <WordCut show delay={260} duration={1000}>
          <span className="serif-it pilot-accent">screen story</span>
        </WordCut>
        <WordCut show delay={520} duration={1000}>
          <span className="serif-cn">.</span>
        </WordCut>
      </div>
      <div className="pilot-foot label-mono">
        preview / voice / capture
      </div>
    </div>
  );
}

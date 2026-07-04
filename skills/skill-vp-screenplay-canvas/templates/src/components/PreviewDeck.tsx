import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SequenceDef } from "../runtime/models";
import "./PreviewDeck.css";

const STAGE_W = 1920;
const STAGE_H = 1080;

type FlatBeat = {
  sequenceIndex: number;
  localBeat: number;
  durationMs: number;
};

function estimateMs(text: string) {
  if (!text) return 1400;
  return Math.max(1400, text.length * 250);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, a, input, [data-no-advance]"))
    : false;
}

export function PreviewDeck({ sequences }: { sequences: SequenceDef[] }) {
  const { beats, total } = useMemo(() => {
    const flat: FlatBeat[] = [];
    sequences.forEach((sequence, sequenceIndex) => {
      sequence.cues.forEach((text, localBeat) => {
        flat.push({ sequenceIndex, localBeat, durationMs: estimateMs(text) });
      });
    });
    return { beats: flat, total: flat.length };
  }, [sequences]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scale, setScale] = useState(1);

  const shellRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const rafRef = useRef(0);

  const safeIndex = clamp(index, 0, Math.max(0, total - 1));
  const current = beats[safeIndex];
  const sequence = current ? sequences[current.sequenceIndex] : null;
  const Scene = sequence?.Scene;
  const playing = total > 0 && !paused && !ended;

  useEffect(() => {
    const update = () => {
      const usefulW = Math.max(320, window.innerWidth);
      const usefulH = Math.max(180, window.innerHeight);
      setScale(Math.min(usefulW / STAGE_W, usefulH / STAGE_H));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!playing || !current) return;
    const begin = performance.now() - elapsedRef.current;
    const loop = (now: number) => {
      const elapsed = now - begin;
      elapsedRef.current = elapsed;
      if (elapsed >= current.durationMs) {
        elapsedRef.current = 0;
        if (safeIndex < total - 1) {
          setProgress(0);
          setIndex((value) => value + 1);
        } else {
          setProgress(1);
          setEnded(true);
        }
        return;
      }
      setProgress(elapsed / current.durationMs);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, safeIndex, total, current]);

  const jumpTo = useCallback(
    (nextIndex: number) => {
      elapsedRef.current = 0;
      setProgress(0);
      setEnded(false);
      setIndex(clamp(nextIndex, 0, Math.max(0, total - 1)));
    },
    [total],
  );

  const advance = useCallback(() => {
    elapsedRef.current = 0;
    if (safeIndex < total - 1) {
      setProgress(0);
      setEnded(false);
      setIndex((value) => value + 1);
    } else {
      setProgress(1);
      setEnded(true);
    }
  }, [safeIndex, total]);

  const replay = useCallback(() => {
    setPaused(false);
    jumpTo(0);
  }, [jumpTo]);

  const togglePlay = useCallback(() => {
    if (ended) {
      replay();
      return;
    }
    setPaused((value) => !value);
  }, [ended, replay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        jumpTo(safeIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        jumpTo(0);
      } else if (event.key === "End") {
        event.preventDefault();
        jumpTo(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, jumpTo, safeIndex, togglePlay, total]);

  if (!current || !sequence || !Scene) {
    return <div className="preview-shell" ref={shellRef} />;
  }

  const showOverlay = (paused && !ended) || ended;

  return (
    <div className="preview-shell" ref={shellRef}>
      <div
        className="preview-fitter"
        style={{ width: STAGE_W * scale, height: STAGE_H * scale }}
      >
        <div
          className="preview-frame"
          style={{ transform: `scale(${scale})` }}
          onClick={(event) => {
            if (isInteractiveTarget(event.target)) return;
            advance();
          }}
          role="button"
          aria-label="Advance cue"
        >
          <div key={sequence.id} className="scene">
            <Scene beat={current.localBeat} />
          </div>
        </div>

        {showOverlay && (
          <button
            type="button"
            className="preview-overlay"
            onClick={ended ? replay : togglePlay}
            aria-label={ended ? "Replay" : "Play"}
          >
            <span className="preview-overlay-button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ended ? (
                  <path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </span>
            <span className="preview-overlay-label">
              {ended ? "Replay" : "Play"}
            </span>
          </button>
        )}

        <div
          className={`preview-ui${ended ? " preview-ended" : ""}${
            paused ? " preview-paused" : ""
          }`}
          data-no-advance
        >
          <button
            type="button"
            className="preview-play"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? (
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>
          <div className="preview-track">
            {beats.map((_, beatIndex) => {
              const width =
                beatIndex < safeIndex
                  ? 1
                  : beatIndex === safeIndex
                    ? progress
                    : 0;
              return (
                <span
                  key={beatIndex}
                  className="preview-seg"
                  onClick={() => jumpTo(beatIndex)}
                  role="button"
                  aria-label={`Jump to beat ${beatIndex + 1}`}
                >
                  <span
                    className="preview-seg-fill"
                    style={{ width: `${width * 100}%` }}
                  />
                </span>
              );
            })}
          </div>
          <span className="preview-label">{sequence.label}</span>
        </div>
      </div>
    </div>
  );
}

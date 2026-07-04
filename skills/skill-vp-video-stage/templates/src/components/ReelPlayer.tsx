import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChapterDef } from "../registry/types";
import "./ReelPlayer.css";

const STAGE_W = 1920;
const STAGE_H = 1080;

type FlatStep = {
  chapterIndex: number;
  localStep: number;
  durationMs: number;
};

function estimateMs(text: string): number {
  if (!text) return 1500;
  return Math.max(1500, text.length * 250);
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    ? Boolean(target.closest("button, a, input, [data-no-advance]"))
    : false;
}

export function ReelPlayer({ chapters }: { chapters: ChapterDef[] }) {
  const { steps, total } = useMemo(() => {
    const flat: FlatStep[] = [];
    chapters.forEach((chapter, chapterIndex) => {
      chapter.narrations.forEach((text, localStep) => {
        flat.push({
          chapterIndex,
          localStep,
          durationMs: estimateMs(text),
        });
      });
    });
    return { steps: flat, total: flat.length };
  }, [chapters]);

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scale, setScale] = useState(1);

  const shellRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const rafRef = useRef(0);

  const safeIndex = clamp(index, 0, Math.max(0, total - 1));
  const current = steps[safeIndex];
  const chapter = current ? chapters[current.chapterIndex] : null;
  const Component = chapter?.Component;
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

  if (!current || !chapter || !Component) {
    return <div className="reel-shell" ref={shellRef} />;
  }

  const showOverlay = (paused && !ended) || ended;

  return (
    <div className="reel-shell" ref={shellRef}>
      <div
        className="reel-fitter"
        style={{ width: STAGE_W * scale, height: STAGE_H * scale }}
      >
        <div
          className="reel-frame"
          style={{ transform: `scale(${scale})` }}
          onClick={(event) => {
            if (isInteractiveTarget(event.target)) return;
            advance();
          }}
          role="button"
          aria-label="跳到下一步"
        >
          <div key={chapter.id} className="scene">
            <Component step={current.localStep} />
          </div>
        </div>

        {showOverlay && (
          <button
            type="button"
            className="reel-overlay"
            onClick={ended ? replay : togglePlay}
            aria-label={ended ? "重播" : "播放"}
          >
            <span className="reel-overlay-button">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {ended ? (
                  <path d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z" />
                ) : (
                  <path d="M8 5v14l11-7z" />
                )}
              </svg>
            </span>
            <span className="reel-overlay-label">
              {ended ? "Replay" : "Play"}
            </span>
          </button>
        )}

        <div
          className={`reel-ui${ended ? " reel-ended" : ""}${
            paused ? " reel-paused" : ""
          }`}
          data-no-advance
        >
          <button
            type="button"
            className="reel-play"
            onClick={togglePlay}
            aria-label={playing ? "暂停" : "播放"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {playing ? (
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>
          <div className="reel-track">
            {steps.map((_, stepIndex) => {
              const width =
                stepIndex < safeIndex
                  ? 1
                  : stepIndex === safeIndex
                    ? progress
                    : 0;
              return (
                <span
                  key={stepIndex}
                  className="reel-seg"
                  onClick={() => jumpTo(stepIndex)}
                  role="button"
                  aria-label={`跳到第 ${stepIndex + 1} 步`}
                >
                  <span
                    className="reel-seg-fill"
                    style={{ width: `${width * 100}%` }}
                  />
                </span>
              );
            })}
          </div>
          <span className="reel-label">{chapter.title}</span>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SequenceDef } from "../runtime/models";

/**
 * Bump this when chapter step counts / structure change so old persisted
 * cursors don't land mid-removed-step.
 */
const STORAGE_KEY = "screenplay-canvas-cursor-v1";

export type Cursor = { sequence: number; beat: number };

export interface CueCursorState {
  cursor: Cursor;
  totalSequences: number;
  sequenceTotalBeats: number;
  globalIndex: number;
  totalGlobal: number;
  next(): void;
  prev(): void;
  jumpToSequence(idx: number, beat?: number): void;
  jumpToGlobal(globalIdx: number): void;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Clamp a (possibly stale) cursor to the current chapter list. Persisted
 * cursors can outlive structural changes — fewer chapters, fewer steps,
 * a different scaffolded project sharing the same dev-server origin — so
 * we always re-validate before handing one to React.
 */
function sanitize(cursor: Cursor, sequences: SequenceDef[]): Cursor {
  if (sequences.length === 0) return { sequence: 0, beat: 0 };
  const sequence = clamp(cursor.sequence | 0, 0, sequences.length - 1);
  const beatCount = sequences[sequence]!.cues.length;
  const beat = clamp(cursor.beat | 0, 0, Math.max(0, beatCount - 1));
  return { sequence, beat };
}

export function useCueCursor(sequences: SequenceDef[]): CueCursorState {
  const [cursor, setCursor] = useState<Cursor>(() => {
    const fallback = { sequence: 0, beat: 0 };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) return sanitize(JSON.parse(raw), sequences);
    } catch {
      /* ignore */
    }
    return fallback;
  });

  // Re-sanitize if the chapter list shape changes after mount (e.g. HMR
  // updates `chapters.ts`) — keeps a stale persisted cursor from leaking
  // into a render where it's now out of range.
  useEffect(() => {
    setCursor((cur) => {
      const next = sanitize(cur, sequences);
      return next.sequence === cur.sequence && next.beat === cur.beat
        ? cur
        : next;
    });
  }, [sequences]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cursor));
    } catch {
      /* ignore */
    }
  }, [cursor]);

  const offsets = useMemo(() => {
    const arr: number[] = [];
    let acc = 0;
    for (const c of sequences) {
      arr.push(acc);
      acc += c.cues.length;
    }
    return arr;
  }, [sequences]);
  const totalGlobal = useMemo(
    () => sequences.reduce((s, c) => s + c.cues.length, 0),
    [sequences],
  );
  const globalIndex = (offsets[cursor.sequence] ?? 0) + cursor.beat;

  const next = useCallback(() => {
    setCursor((cur) => {
      const c = sequences[cur.sequence]!;
      if (cur.beat < c.cues.length - 1)
        return { ...cur, beat: cur.beat + 1 };
      if (cur.sequence < sequences.length - 1)
        return { sequence: cur.sequence + 1, beat: 0 };
      return cur;
    });
  }, [sequences]);

  const prev = useCallback(() => {
    setCursor((cur) => {
      if (cur.beat > 0) return { ...cur, beat: cur.beat - 1 };
      if (cur.sequence > 0) {
        const p = sequences[cur.sequence - 1]!;
        return { sequence: cur.sequence - 1, beat: p.cues.length - 1 };
      }
      return cur;
    });
  }, [sequences]);

  const jumpToSequence = useCallback(
    (idx: number, beat = 0) => {
      const sequence = clamp(idx, 0, sequences.length - 1);
      const c = sequences[sequence]!;
      setCursor({
        sequence,
        beat: clamp(beat, 0, c.cues.length - 1),
      });
    },
    [sequences],
  );

  const jumpToGlobal = useCallback(
    (g: number) => {
      const target = clamp(g, 0, totalGlobal - 1);
      let acc = 0;
      for (let i = 0; i < sequences.length; i++) {
        const t = sequences[i]!.cues.length;
        if (target < acc + t) {
          setCursor({ sequence: i, beat: target - acc });
          return;
        }
        acc += t;
      }
    },
    [sequences, totalGlobal],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "Backspace") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        jumpToSequence(0, 0);
      } else if (e.key === "End") {
        const last = sequences.length - 1;
        jumpToSequence(last, sequences[last]!.cues.length - 1);
      } else if (e.key >= "1" && e.key <= "9") {
        const n = Number(e.key) - 1;
        if (n < sequences.length) jumpToSequence(n, 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, jumpToSequence, sequences]);

  const ch = sequences[cursor.sequence]!;
  return {
    cursor,
    totalSequences: sequences.length,
    sequenceTotalBeats: ch.cues.length,
    globalIndex,
    totalGlobal,
    next,
    prev,
    jumpToSequence,
    jumpToGlobal,
  };
}

import { useEffect, useRef } from "react";
import type { SequenceDef } from "../runtime/models";
import "./CueRail.css";

interface Props {
  sequences: SequenceDef[];
  cursor: { sequence: number; beat: number };
  onJumpSequence(idx: number, beat?: number): void;
}

export function CueRail({ sequences, cursor, onJumpSequence }: Props) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [cursor.sequence]);

  return (
    <div className="cr-hover" data-no-advance>
      <div className="cr-strip">
        {sequences.map((c, i) => {
          const isActive = i === cursor.sequence;
          return (
            <button
              key={c.id}
              ref={isActive ? activeRef : undefined}
              className={`cr-sequence ${isActive ? "cr-active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onJumpSequence(i, 0);
              }}
            >
              <span className="cr-index">{String(i + 1).padStart(2, "0")}</span>
              <span className="cr-label">{c.label}</span>
              {isActive && (
                <div className="cr-pips">
                  {Array.from({ length: c.cues.length }, (_, s) => (
                    <span
                      key={s}
                      className={`cr-pip ${
                        s <= cursor.beat ? "cr-pip-on" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onJumpSequence(i, s);
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

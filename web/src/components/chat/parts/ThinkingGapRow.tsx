"use client";

type Props = {
  label: string;
};

/** 步间思考间隔（对齐 Cursor Thought for Xs） */
export function ThinkingGapRow({ label }: Props) {
  return (
    <p className="py-0.5 text-xs text-[var(--fg-tertiary)]" aria-label={label}>
      {label}
    </p>
  );
}

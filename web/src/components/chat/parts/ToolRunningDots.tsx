"use client";

type Props = {
  label?: string;
};

export function ToolRunningDots({ label = "工具执行中…" }: Props) {
  return (
    <div
      className="flex items-center gap-2 py-0.5 text-xs text-[var(--fg-tertiary)]"
      aria-live="polite"
    >
      <span className="inline-flex gap-0.5" aria-hidden>
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent)]/75 [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent)]/75 [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-[var(--accent)]/75 [animation-delay:300ms]" />
      </span>
      <span>{label}</span>
    </div>
  );
}

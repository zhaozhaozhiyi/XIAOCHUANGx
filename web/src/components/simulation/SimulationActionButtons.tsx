"use client";

import type { ReactNode } from "react";

type SimulationActionButtonRowProps = {
  children: ReactNode;
  className?: string;
  withTopMargin?: boolean;
};

type SimulationActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  className?: string;
};

export function SimulationActionButtonRow({
  children,
  className = "",
  withTopMargin = true,
}: SimulationActionButtonRowProps) {
  return (
    <div
      className={[
        withTopMargin ? "mt-2" : "",
        "flex flex-wrap gap-1.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function SimulationActionButton({
  children,
  onClick,
  className = "",
}: SimulationActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

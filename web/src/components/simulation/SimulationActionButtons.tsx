"use client";

import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  getCanvasActionDefinition,
  type CanvasActionBehavior,
} from "@/components/simulation/canvas/canvasActions";

type SimulationActionButtonRowProps = {
  children: ReactNode;
  className?: string;
  withTopMargin?: boolean;
};

type SimulationActionButtonProps = {
  children: ReactNode;
  onClick: () => void;
  actionId?: string;
  behaviorType?: CanvasActionBehavior;
  className?: string;
  disabled?: boolean;
  title?: string;
};

type SimulationActionMoreMenuProps = {
  children: ReactNode;
  label?: string;
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
  actionId,
  behaviorType,
  className = "",
  disabled = false,
  title,
}: SimulationActionButtonProps) {
  const actionDefinition = getCanvasActionDefinition(actionId);
  const resolvedBehaviorType =
    behaviorType ?? actionDefinition?.defaultBehaviorType;

  return (
    <button
      type="button"
      data-action-id={actionId}
      data-behavior-type={resolvedBehaviorType}
      data-target-kind={actionDefinition?.targetKind}
      data-creates-new-round={
        typeof actionDefinition?.createsNewRound === "boolean"
          ? String(actionDefinition.createsNewRound)
          : undefined
      }
      data-requires-confirmation={
        typeof actionDefinition?.requiresConfirmation === "boolean"
          ? String(actionDefinition.requiresConfirmation)
          : undefined
      }
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={[
        "inline-flex h-8 items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)]",
        disabled ? "cursor-not-allowed opacity-50 hover:border-[var(--border)] hover:text-[var(--fg-secondary)]" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

export function SimulationActionMoreMenu({
  children,
  label = "更多",
}: SimulationActionMoreMenuProps) {
  return (
    <details className="group relative">
      <summary
        data-action-more-menu="true"
        aria-label={label}
        title={label}
        className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)] [&::-webkit-details-marker]:hidden"
      >
        <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        <span>{label}</span>
      </summary>
      <div className="absolute right-0 top-9 z-30 flex min-w-40 flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] p-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.16)]">
        {children}
      </div>
    </details>
  );
}

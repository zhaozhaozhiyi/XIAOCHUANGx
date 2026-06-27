"use client";

import { useMemo, useState } from "react";
import { SendHorizontal } from "lucide-react";
import type { ClarificationPart } from "@/lib/chat-parts";
import { submitRunClarification } from "@/lib/companion/clarification";

type SelectionMap = Record<string, string[]>;

function buildAnswer(
  part: ClarificationPart,
  selections: SelectionMap,
  freeText: string,
): string {
  const selectedLines = part.questions.flatMap((q, index) => {
    const selected = selections[q.id] ?? [];
    if (selected.length === 0) return [];
    const prefix = part.questions.length > 1 ? `${index + 1}. ` : "";
    return [`${prefix}${q.question}\n${selected.join(" / ")}`];
  });
  const extra = freeText.trim();
  return [...selectedLines, ...(extra ? [`补充说明：\n${extra}`] : [])]
    .join("\n\n")
    .trim();
}

export function ClarificationCard({
  part,
  onSubmitted,
  onContinueAsMessage,
  onDraftChange,
}: {
  part: ClarificationPart;
  onSubmitted?: (partId: string, answer: string) => void;
  onContinueAsMessage?: (answer: string) => void;
  onDraftChange?: (
    partId: string,
    patch: { selectedOptions?: SelectionMap; draft?: string },
  ) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = part.submitted || Boolean(part.answer);
  const freeText = part.draft ?? "";
  const selections = part.selectedOptions ?? {};
  const answer = useMemo(
    () => buildAnswer(part, selections, freeText),
    [freeText, part, selections],
  );

  const toggleOption = (
    questionId: string,
    optionLabel: string,
    multiSelect?: boolean,
  ) => {
    if (submitted || submitting) return;
    const nextSelections = (() => {
      const prev = selections;
      const current = prev[questionId] ?? [];
      const selected = current.includes(optionLabel);
      return {
        ...prev,
        [questionId]: multiSelect
          ? selected
            ? current.filter((item) => item !== optionLabel)
            : [...current, optionLabel]
          : selected
            ? []
            : [optionLabel],
      };
    })();
    onDraftChange?.(part.id, { selectedOptions: nextSelections });
  };

  const onSubmit = async () => {
    const content = answer.trim();
    if (!content || submitting || submitted) return;
    setSubmitting(true);
    setError(null);
    onSubmitted?.(part.id, content);
    const result = await submitRunClarification({
      runId: part.runId,
      toolUseId: part.toolUseId,
      content,
    });
    setSubmitting(false);
    if (!result.ok) {
      if (
        result.error === "clarification_not_pending" ||
        result.error === "run_not_resumable"
      ) {
        onContinueAsMessage?.(content);
        return;
      }
      setError(result.message);
      return;
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--warn)]/30 bg-[var(--activity-chip-wait-bg)] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--warn)]">
        需要你补充
      </div>
      <div className="mt-2 flex flex-col gap-3">
        {part.questions.map((q, index) => {
          const selected = selections[q.id] ?? [];
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-sm leading-6 text-[var(--activity-chip-wait-fg)]">
                {part.questions.length > 1 ? `${index + 1}. ` : ""}
                {q.question}
              </p>
              {q.options && q.options.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {q.options.map((option) => {
                    const active = selected.includes(option.label);
                    return (
                      <button
                        key={option.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          toggleOption(q.id, option.label, q.multiSelect)
                        }
                        disabled={submitted || submitting}
                        className={
                          active
                            ? "rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-70"
                            : "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg)] disabled:opacity-70"
                        }
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {submitted ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-white/55 px-3 py-2 text-sm text-[var(--fg-secondary)]">
          {part.answer ?? answer}
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <textarea
            value={freeText}
            onChange={(event) =>
              onDraftChange?.(part.id, { draft: event.target.value })
            }
            className="min-h-20 flex-1 resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
            placeholder="可补充没有出现在选项里的信息"
            disabled={submitting}
          />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!answer.trim() || submitting}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent)] text-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="提交补充信息"
            title="提交补充信息"
          >
            <SendHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      {error ? (
        <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>
      ) : null}
    </div>
  );
}

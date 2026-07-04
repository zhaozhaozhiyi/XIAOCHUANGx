"use client";

import { useMemo, useState } from "react";
import { Loader2, Route, SendHorizontal, SlidersHorizontal } from "lucide-react";
import { submitRunClarification } from "@/lib/companion/clarification";
import type { RequirementsPart } from "@/lib/chat-parts";

export type SimulationRequirementsPart = RequirementsPart & {
  kind: "simulation_requirements";
};

type SelectionMap = Record<string, string[]>;
type AnswerMap = Record<string, string>;

function buildAnswer(
  part: SimulationRequirementsPart,
  selections: SelectionMap,
  answers: AnswerMap,
): string {
  return part.questions
    .map((question, index) => {
      const selected = selections[question.id] ?? [];
      const typed = (answers[question.id] ?? "").trim();
      const value =
        question.type === "single_select" || question.type === "multi_select"
          ? selected.join(" / ")
          : typed;
      if (!value) return "";
      return `${part.questions.length > 1 ? `${index + 1}. ` : ""}${question.label}\n${value}`;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function isQuestionAnswered(
  part: SimulationRequirementsPart,
  questionId: string,
  selections: SelectionMap,
  answers: AnswerMap,
): boolean {
  const question = part.questions.find((item) => item.id === questionId);
  if (!question) return false;
  if (question.type === "single_select" || question.type === "multi_select") {
    return (selections[questionId] ?? []).length > 0;
  }
  return Boolean((answers[questionId] ?? "").trim());
}

function fieldIcon(kind: string) {
  if (kind === "variables") {
    return <SlidersHorizontal className="h-4 w-4" aria-hidden />;
  }
  if (kind === "initial_direction") {
    return <Route className="h-4 w-4" aria-hidden />;
  }
  return <span className="text-xs font-semibold">Q</span>;
}

function fieldHeight(
  type: SimulationRequirementsPart["questions"][number]["type"],
): string {
  return type === "textarea" ? "min-h-[108px]" : "min-h-[44px]";
}

export function SimulationEntryRequirementsCard({
  part,
  embedded = false,
  onSubmitted,
  onContinueAsMessage,
  onDraftChange,
}: {
  part: SimulationRequirementsPart;
  embedded?: boolean;
  onSubmitted?: (partId: string, answer: string) => void;
  onContinueAsMessage?: (answer: string) => void;
  onDraftChange?: (
    partId: string,
    patch: {
      selectedOptions?: SelectionMap;
      answers?: AnswerMap;
    },
  ) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = part.submitted || Boolean(part.answer);
  const selections = useMemo(() => part.selectedOptions ?? {}, [part.selectedOptions]);
  const answers = useMemo(() => part.answers ?? {}, [part.answers]);
  const answer = useMemo(
    () => buildAnswer(part, selections, answers),
    [answers, part, selections],
  );
  const missingRequired = useMemo(
    () =>
      part.questions.filter(
        (question) =>
          question.required &&
          !isQuestionAnswered(part, question.id, selections, answers),
      ),
    [answers, part, selections],
  );

  const updateAnswer = (questionId: string, value: string) => {
    if (submitted || submitting) return;
    onDraftChange?.(part.id, {
      answers: {
        ...answers,
        [questionId]: value,
      },
    });
  };

  const toggleOption = (
    questionId: string,
    optionLabel: string,
    multiSelect?: boolean,
  ) => {
    if (submitted || submitting) return;
    const current = selections[questionId] ?? [];
    const selected = current.includes(optionLabel);
    onDraftChange?.(part.id, {
      selectedOptions: {
        ...selections,
        [questionId]: multiSelect
          ? selected
            ? current.filter((item) => item !== optionLabel)
            : [...current, optionLabel]
          : selected
            ? []
            : [optionLabel],
      },
    });
  };

  const onSubmit = async () => {
    if (submitted || submitting) return;
    if (missingRequired.length > 0) {
      setError(`请先补充：${missingRequired.map((item) => item.label).join("、")}`);
      return;
    }
    const content = answer.trim();
    if (!content) return;
    setSubmitting(true);
    setError(null);
    onSubmitted?.(part.id, content);
    if (part.runId && part.toolUseId) {
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
      return;
    }
    onContinueAsMessage?.(content);
    setSubmitting(false);
  };

  return (
    <div
      className={
        embedded
          ? "nodrag nowheel min-w-0"
          : "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]"
      }
    >
      {embedded ? (
        <div className="px-1 pb-1">
          <div className="text-sm font-semibold text-[var(--fg)]">{part.title}</div>
          {part.description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--fg-secondary)]">
              {part.description}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-tertiary)]">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1">
              问题层
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1">
              入口确认节点组
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-elevated)] px-2.5 py-1">
              {part.questions.filter((question) => question.required).length} 项必填
            </span>
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--fg)]">
            {part.title}
          </div>
          {part.description ? (
            <p className="mt-1 text-sm leading-6 text-[var(--fg-secondary)]">
              {part.description}
            </p>
          ) : null}
        </div>
      )}

      <div
        className={[
          "grid gap-3 lg:grid-cols-2",
          embedded ? "px-1 py-2" : "px-4 py-4",
        ].join(" ")}
      >
        {part.questions.map((question, index) => {
          const selected = selections[question.id] ?? [];
          const typed = answers[question.id] ?? "";
          const isTextarea = question.type === "textarea";
          const isSelect =
            question.type === "single_select" || question.type === "multi_select";
          const cardTitle = `${index + 1}. ${question.label}`;
          return (
            <section
              key={question.id}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)]">
                  {fieldIcon(question.id)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-medium text-[var(--fg)]">
                      {cardTitle}
                    </div>
                    {question.required ? (
                      <span className="rounded-full bg-[var(--accent-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg)]">
                        必填
                      </span>
                    ) : null}
                  </div>
                  {question.description ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--fg-tertiary)]">
                      {question.description}
                    </p>
                  ) : null}

                  {isSelect ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {question.options?.map((option) => {
                        const active = selected.includes(option.label);
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() =>
                              toggleOption(
                                question.id,
                                option.label,
                                question.type === "multi_select",
                              )
                            }
                            disabled={submitted || submitting}
                            className={[
                              "rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition-colors",
                              active
                                ? "border-[var(--accent)] bg-[var(--accent-muted)] text-[var(--fg)]"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg-secondary)] hover:border-[var(--accent)]/45 hover:text-[var(--fg)]",
                            ].join(" ")}
                          >
                            <span className="block">{option.label}</span>
                            {option.description ? (
                              <span className="mt-1 block text-xs text-[var(--fg-tertiary)]">
                                {option.description}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : isTextarea ? (
                    <textarea
                      value={typed}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      placeholder={question.placeholder}
                      disabled={submitted || submitting}
                      className={`mt-3 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60 ${fieldHeight(question.type)}`}
                    />
                  ) : (
                    <input
                      type={question.type === "number" ? "number" : "text"}
                      value={typed}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      placeholder={question.placeholder}
                      disabled={submitted || submitting}
                      className={`mt-3 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60 ${fieldHeight(question.type)}`}
                    />
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div
        className={[
          embedded ? "px-1 py-2" : "border-t border-[var(--border)] px-4 py-3",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--fg-tertiary)]">
            {submitted
              ? "入口设定已提交，正在等待 AI 生成初始沙盘。"
              : "确认后会进入初始沙盘生成，并保留问题层的 Prompt → Topic 双节点关系。"}
          </div>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitted || submitting}
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <SendHorizontal className="h-4 w-4" aria-hidden />
            )}
            {submitted ? "已提交" : "确认并生成初始沙盘"}
          </button>
        </div>
        {error ? (
          <div className="mt-2 rounded-[var(--radius-md)] border border-[var(--danger-muted)]/40 bg-[var(--danger-muted-bg)] px-3 py-2 text-xs text-[var(--danger-muted)]">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}

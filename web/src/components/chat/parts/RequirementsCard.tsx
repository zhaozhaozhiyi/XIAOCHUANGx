"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  FileUp,
  FolderSearch,
  Hash,
  Loader2,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import type { RequirementsPart } from "@/lib/chat-parts";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { useProjectFileIndex } from "@/hooks/useProjectFileIndex";
import { submitRunClarification } from "@/lib/companion/clarification";
import { uploadCompanionProjectFile } from "@/lib/companion/client";
import { NO_PROJECT_ID } from "@/lib/research-projects";

type SelectionMap = Record<string, string[]>;
type AnswerMap = Record<string, string>;

function buildAnswer(
  part: RequirementsPart,
  selections: SelectionMap,
  answers: AnswerMap,
): string {
  return part.questions
    .map((question, index) => {
      const selected = selections[question.id] ?? [];
      const typed = (answers[question.id] ?? "").trim();
      const value =
        question.type === "single_select" ||
        question.type === "multi_select" ||
        question.type === "file_pick" ||
        question.type === "file_upload"
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
  part: RequirementsPart,
  questionId: string,
  selections: SelectionMap,
  answers: AnswerMap,
): boolean {
  const question = part.questions.find((item) => item.id === questionId);
  if (!question) return false;
  if (
    question.type === "single_select" ||
    question.type === "multi_select" ||
    question.type === "file_pick" ||
    question.type === "file_upload"
  ) {
    return (selections[questionId] ?? []).length > 0;
  }
  return Boolean((answers[questionId] ?? "").trim());
}

function inputTypeForQuestion(
  type: RequirementsPart["questions"][number]["type"],
): "text" | "date" | "time" | "datetime-local" | "number" {
  switch (type) {
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "datetime-local";
    case "number":
      return "number";
    default:
      return "text";
  }
}

function questionTypeLabel(
  type: RequirementsPart["questions"][number]["type"],
): string {
  switch (type) {
    case "single_select":
      return "单选";
    case "multi_select":
      return "多选";
    case "textarea":
      return "详细填写";
    case "date":
      return "日期";
    case "time":
      return "时间";
    case "datetime":
      return "日期时间";
    case "number":
      return "数字";
    case "file_pick":
      return "选文件";
    case "file_upload":
      return "传文件";
    default:
      return "填写";
  }
}

function questionIcon(
  type: RequirementsPart["questions"][number]["type"],
) {
  switch (type) {
    case "date":
      return <CalendarDays className="h-4 w-4" aria-hidden />;
    case "time":
    case "datetime":
      return <Clock3 className="h-4 w-4" aria-hidden />;
    case "number":
      return <Hash className="h-4 w-4" aria-hidden />;
    case "file_pick":
      return <FolderSearch className="h-4 w-4" aria-hidden />;
    case "file_upload":
      return <FileUp className="h-4 w-4" aria-hidden />;
    default:
      return <Sparkles className="h-4 w-4" aria-hidden />;
  }
}

function SelectedPathPill({
  value,
  onRemove,
  disabled,
}: {
  value: string;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--fg)]">
      <span className="truncate">{value}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="shrink-0 text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg)] disabled:opacity-50"
          aria-label="移除"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </span>
  );
}

function FilePickField({
  questionId,
  selected,
  disabled,
  onSelect,
  onRemove,
}: {
  questionId: string;
  selected: string[];
  disabled: boolean;
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const { workspaceProjectId } = useWorkspaceProject();
  const [query, setQuery] = useState("");
  const { files, loading, error } = useProjectFileIndex(
    workspaceProjectId !== NO_PROJECT_ID ? workspaceProjectId : null,
    query,
  );
  const canBrowse = workspaceProjectId !== NO_PROJECT_ID;
  const suggestions = files
    .filter((file) => file.type === "file" && file.relativePath)
    .slice(0, 8);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-60"
        placeholder={
          canBrowse ? "搜索工作区文件，例如：资料、通知、原油" : "请先绑定工作区后再选择文件"
        }
        disabled={disabled || !canBrowse}
      />

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <SelectedPathPill
              key={`${questionId}-${value}`}
              value={value}
              disabled={disabled}
              onRemove={() => onRemove(value)}
            />
          ))}
        </div>
      ) : null}

      {canBrowse ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/70 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--fg-tertiary)]">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                <span>正在搜索工作区文件…</span>
              </>
            ) : (
              <span>从当前工作区中选择文件</span>
            )}
          </div>
          {error ? (
            <p className="text-xs text-[var(--danger)]">{error}</p>
          ) : suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((file) => {
                const path = file.relativePath ?? file.name;
                const active = selected.includes(path);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelect(path)}
                    disabled={disabled || active}
                    className={
                      active
                        ? "rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-left text-sm font-medium text-white disabled:opacity-70"
                        : "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)]/45 hover:text-[var(--fg)] disabled:opacity-60"
                    }
                  >
                    <span className="block truncate">{file.name}</span>
                    <span className="mt-1 block truncate text-[11px] opacity-80">
                      {path}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--fg-tertiary)]">
              {query.trim() ? "没有找到匹配文件" : "输入关键词后会显示匹配文件"}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function FileUploadField({
  questionId,
  selected,
  disabled,
  onSelect,
  onRemove,
}: {
  questionId: string;
  selected: string[];
  disabled: boolean;
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const { workspaceProjectId } = useWorkspaceProject();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canUpload = workspaceProjectId !== NO_PROJECT_ID;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || disabled || !canUpload) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadCompanionProjectFile({
        projectId: workspaceProjectId,
        name: file.name,
        bytes: await file.arrayBuffer(),
      });
      onSelect(uploaded.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-elevated)]/70 px-4 py-3 transition-colors hover:border-[var(--accent)]/45">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--fg)]">
            {canUpload ? "上传文件到当前工作区" : "请先绑定工作区后再上传文件"}
          </p>
          <p className="mt-1 text-xs text-[var(--fg-tertiary)]">
            上传成功后会把工作区路径写入本题答案
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg-secondary)]">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <FileUp className="h-4 w-4" aria-hidden />
          )}
          选择文件
        </div>
        <input
          type="file"
          className="sr-only"
          onChange={(event) => void handleFileChange(event)}
          disabled={disabled || uploading || !canUpload}
        />
      </label>

      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <SelectedPathPill
              key={`${questionId}-${value}`}
              value={value}
              disabled={disabled || uploading}
              onRemove={() => onRemove(value)}
            />
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

export function RequirementsCard({
  part,
  onSubmitted,
  onContinueAsMessage,
  onDraftChange,
}: {
  part: RequirementsPart;
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

  const toggleOption = (
    questionId: string,
    optionLabel: string,
    multiSelect?: boolean,
  ) => {
    if (submitted || submitting) return;
    const current = selections[questionId] ?? [];
    const selected = current.includes(optionLabel);
    const nextSelections = {
      ...selections,
      [questionId]: multiSelect
        ? selected
          ? current.filter((item) => item !== optionLabel)
          : [...current, optionLabel]
        : selected
          ? []
          : [optionLabel],
    };
    onDraftChange?.(part.id, { selectedOptions: nextSelections });
  };

  const updateAnswer = (questionId: string, value: string) => {
    if (submitted || submitting) return;
    onDraftChange?.(part.id, {
      answers: {
        ...answers,
        [questionId]: value,
      },
    });
  };

  const setPathSelection = (questionId: string, value: string) => {
    if (submitted || submitting) return;
    onDraftChange?.(part.id, {
      selectedOptions: {
        ...selections,
        [questionId]: [value],
      },
      answers: {
        ...answers,
        [questionId]: value,
      },
    });
  };

  const removePathSelection = (questionId: string, value: string) => {
    if (submitted || submitting) return;
    const current = selections[questionId] ?? [];
    const nextSelected = current.filter((item) => item !== value);
    const nextAnswers = { ...answers };
    if (nextSelected.length === 0) {
      delete nextAnswers[questionId];
    } else {
      nextAnswers[questionId] = nextSelected.join(" / ");
    }
    onDraftChange?.(part.id, {
      selectedOptions: {
        ...selections,
        [questionId]: nextSelected,
      },
      answers: nextAnswers,
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
    <div className="overflow-hidden rounded-[calc(var(--radius-lg)+2px)] border border-[var(--accent)]/18 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--accent)_5%,white),var(--surface)_16%,var(--surface))] shadow-[0_18px_48px_-32px_color-mix(in_srgb,var(--accent)_48%,transparent)]">
      <div className="border-b border-[var(--accent)]/10 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--accent)]">
            需求表单
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] text-[var(--fg-secondary)]">
            {part.questions.filter((question) => question.required).length} 项必填
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] text-[var(--fg-secondary)]">
            预计 1-2 分钟
          </span>
        </div>
        <p className="mt-3 text-base font-semibold text-[var(--fg)]">{part.title}</p>
        {part.description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--fg-secondary)]">
            {part.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 px-5 py-5">
        {part.questions.map((question) => {
          const selected = selections[question.id] ?? [];
          const typed = answers[question.id] ?? "";
          const isTextarea = question.type === "textarea";
          const isSelect =
            question.type === "single_select" ||
            question.type === "multi_select";
          const isFilePick = question.type === "file_pick";
          const isFileUpload = question.type === "file_upload";
          return (
            <section
              key={question.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border)]/80 bg-[var(--surface)] px-4 py-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.28)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[var(--fg-secondary)]">
                    {questionIcon(question.type)}
                    <span className="text-[11px] font-medium uppercase tracking-[0.06em]">
                      {questionTypeLabel(question.type)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--fg)]">
                    {question.label}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {question.required ? (
                    <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]">
                      必填
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--surface-elevated)] px-2 py-0.5 text-[11px] text-[var(--fg-tertiary)]">
                      可选
                    </span>
                  )}
                </div>
              </div>
              {question.description ? (
                <p className="mt-2 text-xs leading-5 text-[var(--fg-tertiary)]">
                  {question.description}
                </p>
              ) : null}
              <div className="mt-3">
                {isSelect && question.options?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => {
                      const active = selected.includes(option.label);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            toggleOption(
                              question.id,
                              option.label,
                              question.type === "multi_select",
                            )
                          }
                          disabled={submitted || submitting}
                          className={
                            active
                              ? "rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white shadow-[0_10px_24px_-18px_color-mix(in_srgb,var(--accent)_80%,transparent)] disabled:opacity-70"
                              : "rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-[var(--fg-secondary)] transition-colors hover:border-[var(--accent)]/45 hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface-elevated))] hover:text-[var(--fg)] disabled:opacity-70"
                          }
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {isFilePick ? (
                  <FilePickField
                    questionId={question.id}
                    selected={selected}
                    disabled={submitted || submitting}
                    onSelect={(value) => setPathSelection(question.id, value)}
                    onRemove={(value) => removePathSelection(question.id, value)}
                  />
                ) : null}
                {isFileUpload ? (
                  <FileUploadField
                    questionId={question.id}
                    selected={selected}
                    disabled={submitted || submitting}
                    onSelect={(value) => setPathSelection(question.id, value)}
                    onRemove={(value) => removePathSelection(question.id, value)}
                  />
                ) : null}
                {!isSelect && !isFilePick && !isFileUpload ? (
                  isTextarea ? (
                    <textarea
                      value={typed}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      className="min-h-28 w-full resize-y rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)]"
                      placeholder={question.placeholder}
                      disabled={submitted || submitting}
                    />
                  ) : (
                    <input
                      type={inputTypeForQuestion(question.type)}
                      value={typed}
                      onChange={(event) => updateAnswer(question.id, event.target.value)}
                      className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 text-sm text-[var(--fg)] outline-none transition-colors focus:border-[var(--accent)]"
                      placeholder={question.placeholder}
                      disabled={submitted || submitting}
                    />
                  )
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {submitted ? (
        <div className="border-t border-[var(--border)]/80 bg-[var(--surface)] px-5 py-4">
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-elevated)] px-3 py-3 text-sm text-[var(--fg-secondary)] whitespace-pre-wrap">
            {part.answer ?? answer}
          </div>
        </div>
      ) : (
        <div className="border-t border-[var(--border)]/80 bg-[var(--surface)] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[var(--fg-tertiary)]">
              {missingRequired.length > 0
                ? `还需完成 ${missingRequired.length} 个必填项`
                : "信息已齐备，提交后进入下一步"}
            </div>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting || missingRequired.length > 0 || !answer.trim()}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_16px_34px_-22px_color-mix(in_srgb,var(--accent)_80%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <SendHorizontal className="h-4 w-4" aria-hidden />
              提交信息
            </button>
          </div>
        </div>
      )}
      {error ? (
        <div className="px-5 pb-4">
          <p className="text-xs text-[var(--danger)]">{error}</p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FileSourceView } from "./FileSourceView";
import type { CodeLanguage } from "./FileSourceView";

type Props = {
  projectId: string;
  relativePath: string;
  content: string;
  language?: CodeLanguage;
  onSaved?: (nextContent: string) => void;
  onWorkspaceChanged?: () => void;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

async function writeWorkspaceFile(input: {
  projectId: string;
  path: string;
  content: string;
}): Promise<void> {
  const res = await fetch("/api/workspace/file", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: input.projectId,
      path: input.path,
      content: input.content,
      encoding: "utf8",
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `write_failed_${res.status}`);
  }
}

export function EditableFileSourceView({
  projectId,
  relativePath,
  content,
  language,
  onSaved,
  onWorkspaceChanged,
}: Props) {
  const [draft, setDraft] = useState(content);
  const [editing, setEditing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  useEffect(() => {
    // The editor draft should reset when the workspace selection changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(content);
    setSaveState({ status: "idle" });
  }, [content, relativePath]);

  const dirty = draft !== content;
  const lineCount = useMemo(() => Math.max(1, draft.split("\n").length), [draft]);

  const save = async () => {
    setSaveState({ status: "saving" });
    try {
      await writeWorkspaceFile({ projectId, path: relativePath, content: draft });
      onSaved?.(draft);
      onWorkspaceChanged?.();
      setEditing(false);
      setSaveState({ status: "saved", message: "源文件已保存。" });
    } catch (err) {
      setSaveState({
        status: "error",
        message: err instanceof Error ? err.message : "保存失败",
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <p className="text-xs text-[var(--fg-tertiary)]">
          {editing ? "正在编辑源文件" : "源文件可直接编辑，保存后会刷新工作区。"}
        </p>
        <div className="flex items-center gap-2">
          {saveState.status !== "idle" && (
            <span
              className={`text-xs ${
                saveState.status === "error"
                  ? "text-[var(--danger)]"
                  : "text-[var(--fg-tertiary)]"
              }`}
            >
              {saveState.status === "saving" ? "正在保存…" : saveState.message}
            </span>
          )}
          {editing && (
            <button
              type="button"
              className="btn btn-secondary px-3 py-1.5 text-xs"
              disabled={saveState.status === "saving" || !dirty}
              onClick={() => {
                setDraft(content);
                setSaveState({ status: "idle" });
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              还原
            </button>
          )}
          {editing ? (
            <button
              type="button"
              className="btn btn-primary px-3 py-1.5 text-xs"
              disabled={saveState.status === "saving" || !dirty}
              onClick={() => void save()}
            >
              <Save className="h-3.5 w-3.5" strokeWidth={1.75} />
              保存
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary px-3 py-1.5 text-xs"
              onClick={() => {
                setEditing(true);
                setSaveState({ status: "idle" });
              }}
            >
              编辑源文件
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setSaveState({ status: "idle" });
          }}
          spellCheck={false}
          className="min-h-[420px] flex-1 resize-y rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[13px] leading-relaxed text-[var(--fg)] outline-none focus:border-[var(--focus)] focus:ring-2 focus:ring-[var(--focus)]/20"
          style={{ height: `${Math.min(720, Math.max(420, lineCount * 21))}px` }}
        />
      ) : (
        <FileSourceView content={content} language={language} />
      )}
    </div>
  );
}

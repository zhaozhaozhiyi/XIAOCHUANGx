"use client";

import { ArrowUp, ChevronDown, Paperclip, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import { useRouter } from "next/navigation";
import { useSettings } from "@/components/settings/SettingsContext";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import { MentionMenu } from "@/components/chat/MentionMenu";
import { ProjectWorkPicker } from "@/components/chat/ProjectWorkPicker";
import { CHAT_MODES, type ChatModeId } from "@/lib/navigation";
import { isSessionStarted } from "@/lib/chat-history";
import {
  filterMentionableFiles,
  getResearchProject,
  getSessionProjectId,
  isUsingLocalProject,
  NO_PROJECT_ID,
  resolveWorkspaceProjectId,
  setSessionProjectId,
  type ResearchProject,
} from "@/lib/research-projects";
import type { AgentId } from "@/lib/settings";
import { useProjectFileIndex } from "@/hooks/useProjectFileIndex";
import type { WorkspaceFileNode } from "@/lib/workspace";

export type ChatComposerSendPayload = {
  text: string;
  mode: ChatModeId;
  executionSource: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
  projectId: string;
};

type ChatComposerProps = {
  sessionId?: string;
  onSend?: (payload: ChatComposerSendPayload) => void;
  placeholder?: string;
  disabled?: boolean;
  generating?: boolean;
  /** AI 输出中且输入为空时，主按钮变为停止 */
  onStop?: () => void;
  /** 首页未建会话时的受控项目（可选） */
  projectId?: string;
  onProjectIdChange?: (id: string) => void;
  /** 仅新建/未发送会话时展示「进入项目工作」 */
  showProjectPicker?: boolean;
  executionSource: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
};

function detectMentionQuery(
  text: string,
  cursor: number,
): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  const between = before.slice(at + 1);
  if (/\s/.test(between)) return null;
  return { start: at, query: between };
}

export function ChatComposer({
  sessionId,
  onSend,
  placeholder,
  disabled = false,
  generating = false,
  onStop,
  projectId: controlledProjectId,
  onProjectIdChange,
  showProjectPicker = false,
  executionSource,
  agentId,
  agentModel,
}: ChatComposerProps) {
  const router = useRouter();
  const { settings, updateSettings } = useSettings();
  const { setWorkspaceProject } = useWorkspaceProject();
  const workspace = useWorkspaceOptional();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  /** 中文等 IME 组字中；此期间 Enter 用于选字，不得触发发送 */
  const isComposingRef = useRef(false);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatModeId>(settings.defaultChatMode);
  const [modeOpen, setModeOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [internalProjectId, setInternalProjectId] = useState(NO_PROJECT_ID);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [switchHint, setSwitchHint] = useState<string | null>(null);

  const projectId = controlledProjectId ?? internalProjectId;
  const setProjectId = onProjectIdChange ?? setInternalProjectId;
  const currentMode = CHAT_MODES.find((m) => m.id === mode)!;

  useEffect(() => {
    if (sessionId) {
      setInternalProjectId(getSessionProjectId(sessionId));
    }
  }, [sessionId]);

  useEffect(() => {
    if (!attachOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(e.target as Node)) {
        setAttachOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [attachOpen]);

  useEffect(() => {
    const p = getResearchProject(projectId);
    setWorkspaceProject(projectId, p?.name ?? "临时工作区");
  }, [projectId, setWorkspaceProject]);

  const workspaceProjectId = useMemo(
    () => resolveWorkspaceProjectId(projectId),
    [projectId],
  );

  const { files: indexedMentionFiles } = useProjectFileIndex(
    mentionOpen && projectId !== NO_PROJECT_ID ? workspaceProjectId : null,
    mentionQuery,
  );

  const mentionFiles = useMemo(
    () => filterMentionableFiles(indexedMentionFiles, mentionQuery),
    [indexedMentionFiles, mentionQuery],
  );

  const syncMention = useCallback((value: string, cursor: number) => {
    const hit = detectMentionQuery(value, cursor);
    if (hit) {
      setMentionOpen(true);
      setMentionQuery(hit.query);
      setMentionStart(hit.start);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  }, []);

  const insertMention = (file: WorkspaceFileNode) => {
    const label = file.relativePath ?? file.name;
    const before = text.slice(0, mentionStart);
    const after = text.slice(textareaRef.current?.selectionStart ?? text.length);
    const next = `${before}@${label} ${after}`;
    setText(next);
    setMentionOpen(false);
    const pos = before.length + label.length + 2;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend?.({
      text: trimmed,
      mode,
      executionSource,
      agentId,
      agentModel,
      projectId,
    });
    setText("");
    setMentionOpen(false);
    if (settings.rememberLastChatMode) {
      updateSettings({ defaultChatMode: mode });
    }
  };

  const handleProjectSelect = (project: ResearchProject | null) => {
    const nextId = project?.id ?? NO_PROJECT_ID;
    if (nextId === projectId) return;

    const started = sessionId ? isSessionStarted(sessionId) : false;

    if (sessionId && started) {
      const newId = String(Date.now());
      setSessionProjectId(newId, nextId);
      setSwitchHint(
        project
          ? `已选择「${project.name}」，正在新建对话…`
          : "已切换为不使用项目，正在新建对话…",
      );
      window.setTimeout(() => {
        router.push(`/chat/${newId}`);
      }, 480);
      return;
    }

    if (sessionId) {
      setSessionProjectId(sessionId, nextId);
    }
    setProjectId(nextId);
    setSwitchHint(
      project
        ? `将在「${project.name}」中开始对话`
        : "未绑定本地项目，将使用沙箱工作区",
    );
    window.setTimeout(() => setSwitchHint(null), 3200);
  };

  const handleCreateLocalProject = (project: ResearchProject) => {
    setSwitchHint(`已绑定「${project.name}」：${project.pathSummary}`);
    window.setTimeout(() => setSwitchHint(null), 4000);
  };

  const defaultPlaceholder =
    "可向助手询问任何事。输入 @ 提及当前项目内文件";

  const hasText = Boolean(text.trim());
  const showStop = generating && !hasText && Boolean(onStop);
  const canSend = hasText && !disabled;

  return (
    <div
      className={`chat-composer-stack w-full max-w-[var(--chat-message-max)] ${showProjectPicker ? "chat-composer-stack--with-project" : ""}`}
    >
      <div className={showProjectPicker ? "chat-composer-layer" : undefined}>
      <div className="chat-composer rounded-[var(--radius-2xl)] p-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              syncMention(e.target.value, e.target.selectionStart);
            }}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={(e) => {
              const imeComposing =
                isComposingRef.current ||
                e.nativeEvent.isComposing ||
                e.keyCode === 229;
              if (imeComposing) return;

              if (mentionOpen && mentionFiles.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionFiles.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex(
                    (i) => (i - 1 + mentionFiles.length) % mentionFiles.length,
                  );
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  insertMention(mentionFiles[mentionIndex]!);
                  return;
                }
                if (e.key === "Escape") {
                  setMentionOpen(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onClick={(e) =>
              syncMention(
                e.currentTarget.value,
                e.currentTarget.selectionStart,
              )
            }
            disabled={disabled}
            rows={3}
            placeholder={
              generating
                ? "生成中可发送消息引导方向，Enter 发送（将中断当前输出）"
                : disabled
                  ? "正在生成回复…"
                  : (placeholder ?? defaultPlaceholder)
            }
            className="w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-relaxed text-[var(--fg)] outline-none placeholder:text-[var(--fg-tertiary)]"
          />
          {mentionOpen && (
            <div className="absolute bottom-full left-0 right-0 z-50 mb-2">
              <MentionMenu
                files={mentionFiles}
                activeIndex={mentionIndex}
                onSelect={insertMention}
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="relative shrink-0" ref={attachRef}>
              <button
                type="button"
                className="btn-icon"
                aria-label="更多"
                aria-expanded={attachOpen}
                onClick={() => setAttachOpen((o) => !o)}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
              </button>
              {attachOpen && (
                <ul className="control-picker-menu control-picker-menu--above absolute left-0 z-50 min-w-[10rem]">
                  <li>
                    <button
                      type="button"
                      className="control-picker-menu__item gap-2"
                      onClick={() => setAttachOpen(false)}
                    >
                      <Paperclip className="h-4 w-4" strokeWidth={1.75} />
                      上传附件
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setModeOpen((o) => !o)}
                className="control-picker control-picker--compact"
                aria-expanded={modeOpen}
              >
                <span>{currentMode.label}</span>
                <ChevronDown
                  className={`control-picker__chevron ${modeOpen ? "control-picker__chevron--open" : ""}`}
                  strokeWidth={1.75}
                />
              </button>
              {modeOpen && (
                <ul className="control-picker-menu control-picker-menu--above absolute right-0 min-w-[140px]">
                  {CHAT_MODES.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMode(m.id);
                          setModeOpen(false);
                        }}
                        className={`control-picker-menu__item flex-col items-start gap-0.5 ${
                          mode === m.id ? "control-picker-menu__item--selected" : ""
                        }`}
                      >
                        <span>{m.label}</span>
                        <span className="mt-0.5 block text-xs text-[var(--fg-tertiary)]">
                          {m.description}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {showStop ? (
              <button
                type="button"
                onClick={onStop}
                className="btn-send btn-send--stop"
                aria-label="停止"
              >
                <Square className="h-3 w-3 fill-current" strokeWidth={0} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className="btn-send"
                aria-label="发送"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showProjectPicker && (
        <ProjectWorkPicker
          projectId={projectId}
          onSelectProject={handleProjectSelect}
          onCreateLocalProject={handleCreateLocalProject}
        />
      )}
      </div>

      {showProjectPicker && (
        <p className="chat-composer-stack__hint">
          {switchHint ??
            (isUsingLocalProject(projectId)
              ? `${getResearchProject(projectId)?.pathSummary} · 发送后将归入该项目历史`
              : "未绑定本地项目 · 发送后将出现在侧栏「无项目」")}
        </p>
      )}
    </div>
  );
}

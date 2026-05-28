"use client";

import {
  ArrowUp,
  ChevronDown,
  FileText,
  Paperclip,
  Plus,
  Square,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
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
import type { ChatPendingAttachment } from "@/lib/chat";
import { formatAttachmentSize } from "@/lib/chat-attachments";

export type ChatComposerSendPayload = {
  text: string;
  attachments?: ChatPendingAttachment[];
  mode: ChatModeId;
  executionSource: ChatExecutionSource;
  agentId: AgentId;
  agentModel: string;
  projectId: string;
};

type ChatComposerProps = {
  sessionId?: string;
  onSend?: (payload: ChatComposerSendPayload) => void | Promise<void>;
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

const TEXT_ATTACHMENT_MAX_CHARS = 60_000;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "css",
  "csv",
  "html",
  "htm",
  "js",
  "json",
  "jsx",
  "log",
  "md",
  "py",
  "sql",
  "svg",
  "text",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);
const IMAGE_ATTACHMENT_EXTENSIONS = new Set([
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

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

function attachmentExtension(file: File): string | undefined {
  return file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : undefined;
}

function shouldReadTextAttachment(file: File): boolean {
  const extension = attachmentExtension(file);
  return (
    file.type.startsWith("text/") ||
    file.type === "application/json" ||
    file.type === "application/xml" ||
    (!!extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension))
  );
}

function isImageAttachment(file: File): boolean {
  const extension = attachmentExtension(file);
  return (
    file.type.startsWith("image/") ||
    (!!extension && IMAGE_ATTACHMENT_EXTENSIONS.has(extension))
  );
}



async function attachmentFromFile(file: File): Promise<ChatPendingAttachment> {
  const extension = file.name.includes(".")
    ? file.name.split(".").pop()?.toLowerCase()
    : undefined;
  const attachment: ChatPendingAttachment = {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || undefined,
    type: file.type || undefined,
    extension,
    lastModified: file.lastModified,
    isImage: isImageAttachment(file),
    file,
  };
  if (!shouldReadTextAttachment(file)) return attachment;
  try {
    const text = await file.text();
    attachment.textContent = text.slice(0, TEXT_ATTACHMENT_MAX_CHARS);
    attachment.truncated = text.length > TEXT_ATTACHMENT_MAX_CHARS;
  } catch {
    attachment.truncated = true;
  }
  return attachment;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";

  if (ext === "csv" || ext === "xlsx" || ext === "xls") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eaf7f0]">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="#107C41" fillOpacity="0.1" stroke="#107C41" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#107C41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="6" y="10" width="7" height="7" rx="1" fill="#107C41"/>
          <path d="M8 12L11 15M11 12L8 15" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  if (ext === "html" || ext === "htm" || ext === "js" || ext === "ts" || ext === "tsx" || ext === "json" || ext === "py") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fdf5ea]">
        <span className="text-xs font-mono font-bold text-[#d97706]">&lt;/&gt;</span>
      </div>
    );
  }

  if (ext === "pdf") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fdf2f2]">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 2C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2H6Z" fill="#E11D48" fillOpacity="0.1" stroke="#E11D48" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M14 2V8H20" stroke="#E11D48" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <rect x="6" y="11" width="10" height="6" rx="1" fill="#E11D48"/>
          <text x="7.5" y="15.5" fill="white" fontSize="4.5" fontWeight="bold" fontFamily="system-ui, sans-serif">PDF</text>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
      <FileText className="h-5 w-5" strokeWidth={1.75} />
    </div>
  );
}

function ImagePreview({
  file,
  onRemove,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFailed(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="relative group shrink-0 w-[84px] h-[84px]">
      {failed || !previewUrl ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border border-neutral-200/60 bg-neutral-100 px-2 text-center text-neutral-500">
          <FileText className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          <span className="line-clamp-2 max-w-full break-all text-[10px] leading-tight">
            {file.name}
          </span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={file.name}
          className="h-full w-full rounded-xl border border-neutral-200/60 bg-[var(--surface-elevated)] object-cover"
          onError={() => setFailed(true)}
        />
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute top-1.5 right-1.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
        aria-label={`移除图片 ${file.name}`}
      >
        <X className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
    </div>
  );
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  /** 中文等 IME 组字中；此期间 Enter 用于选字，不得触发发送 */
  const isComposingRef = useRef(false);

  const [text, setText] = useState("");
  const [mode, setMode] = useState<ChatModeId>(settings.defaultChatMode);
  const [modeOpen, setModeOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [internalProjectId, setInternalProjectId] = useState(() =>
    sessionId ? getSessionProjectId(sessionId) : NO_PROJECT_ID,
  );
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [switchHint, setSwitchHint] = useState<string | null>(null);
  const [selectedAttachments, setSelectedAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const projectId = controlledProjectId ?? internalProjectId;
  const setProjectId = onProjectIdChange ?? setInternalProjectId;
  const currentMode = CHAT_MODES.find((m) => m.id === mode)!;

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

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && selectedAttachments.length === 0) || disabled || sending) return;
    setSending(true);
    const textToSend = text;
    const attachmentsToSend = selectedAttachments;
    setText("");
    setSelectedAttachments([]);
    setMentionOpen(false);
    try {
      const attachments = await Promise.all(
        attachmentsToSend.map(attachmentFromFile),
      );
      await onSend?.({
        text: trimmed,
        attachments,
        mode,
        executionSource,
        agentId,
        agentModel,
        projectId,
      });
      if (settings.rememberLastChatMode) {
        updateSettings({ defaultChatMode: mode });
      }
    } catch {
      setText(textToSend);
      setSelectedAttachments(attachmentsToSend);
    } finally {
      setSending(false);
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

  const handleAttachClick = () => {
    setAttachOpen(false);
    fileInputRef.current?.click();
  };

  const removeAttachment = (index: number) => {
    setSelectedAttachments((files) => files.filter((_, i) => i !== index));
  };

  const defaultPlaceholder =
    "可向助手询问任何事。输入 @ 提及当前项目内文件";

  const hasText = Boolean(text.trim());
  const hasAttachments = selectedAttachments.length > 0;
  const locked = disabled || sending;
  const showStop = generating && !hasText && !sending && Boolean(onStop);
  const canSend = (hasText || hasAttachments) && !locked;

  return (
    <div
      className={`chat-composer-stack w-full max-w-[var(--chat-message-max)] ${showProjectPicker ? "chat-composer-stack--with-project" : ""}`}
    >
      <div className={showProjectPicker ? "chat-composer-layer" : undefined}>
      <div className="chat-composer rounded-[var(--radius-2xl)] p-3">
        {selectedAttachments.length > 0 && (
          <ul className="mb-3 flex max-h-32 flex-wrap items-center gap-3 overflow-y-auto pr-1">
            {selectedAttachments.map((file, index) => {
              const isImage = isImageAttachment(file);
              if (isImage) {
                return (
                  <ImagePreview
                    key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                    file={file}
                    disabled={sending}
                    onRemove={() => removeAttachment(index)}
                  />
                );
              }
              return (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                  className="relative flex items-center h-[72px] min-w-[180px] max-w-[240px] gap-3 rounded-xl border border-[var(--composer-border)] bg-[var(--surface-elevated)] p-2.5 pr-8 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.04)]"
                >
                  <FileIcon name={file.name} />
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="truncate text-[13px] font-semibold text-[var(--fg)]" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[11px] font-normal text-[var(--fg-tertiary)] uppercase mt-0.5">
                      {file.name.split(".").pop()?.toUpperCase() || "FILE"} ·{" "}
                      {formatAttachmentSize(file.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                    aria-label={`移除附件 ${file.name}`}
                    disabled={sending}
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={3} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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
                void handleSend();
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
                : locked
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
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
                disabled={locked}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setSelectedAttachments((prev) => {
                    const filteredNew = files.filter(
                      (f) =>
                        !prev.some(
                          (p) =>
                            p.name === f.name &&
                            p.size === f.size &&
                            p.lastModified === f.lastModified,
                        ),
                    );
                    return [...prev, ...filteredNew];
                  });
                  e.currentTarget.value = "";
                }}
              />
              <button
                type="button"
                className="btn-icon chat-composer__more-btn"
                aria-label="更多"
                aria-expanded={attachOpen}
                disabled={locked}
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
                      onClick={handleAttachClick}
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

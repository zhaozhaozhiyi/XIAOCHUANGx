"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { toolStatusTextClass } from "@/lib/activity-status-tone";
import { toolDisplayName } from "@/lib/tool-family";
import {
  ChevronDown,
  ChevronRight,
  FileSearch,
  FolderOpen,
  Globe,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";
import type { PartPresentation } from "@/components/chat/parts/PartRenderer";
import { TimelineCollapsible } from "@/components/chat/parts/TimelineCollapsible";
import { useMemo, useState } from "react";

type ToolLikePart =
  | Extract<ChatPart, { kind: "tool" }>
  | Extract<ChatPart, { kind: "command" }>;

function renderToolIcon(tool: string) {
  const name = tool.toLowerCase();
  if (name === "bash" || name === "run_terminal" || name === "shell") {
    return <Terminal className="h-3.5 w-3.5" aria-hidden />;
  }
  if (
    name === "grep" ||
    name === "search" ||
    name === "web_search" ||
    name === "choice_query"
  ) {
    return <Search className="h-3.5 w-3.5" aria-hidden />;
  }
  if (name === "web_extract" || name === "fetch") {
    return <Globe className="h-3.5 w-3.5" aria-hidden />;
  }
  if (name === "list_dir" || name === "glob") {
    return <FolderOpen className="h-3.5 w-3.5" aria-hidden />;
  }
  if (name.includes("read") || name.includes("file")) {
    return <FileSearch className="h-3.5 w-3.5" aria-hidden />;
  }
  return <Wrench className="h-3.5 w-3.5" aria-hidden />;
}

function statusLabel(part: ToolLikePart): string | undefined {
  if (part.kind === "command") {
    return part.streaming ? "running" : "success";
  }
  return part.status;
}

function previewText(part: ToolLikePart): string | undefined {
  if (part.kind === "command") return part.command;
  return part.message;
}

function formatPayload(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function DetailBlock({ label, value }: { label: string; value: unknown }) {
  const text = formatPayload(value);
  if (!text) return null;
  return (
    <div className="min-w-0">
      <div className="mb-1 font-mono text-[10px] uppercase text-[var(--fg-tertiary)]">
        {label}
      </div>
      <pre className="max-h-56 overflow-auto rounded-[var(--radius-sm)] bg-[var(--surface-elevated)] px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--fg-secondary)]">
        {text}
      </pre>
    </div>
  );
}

export function ToolCardRow({
  part,
  presentation = "default",
}: {
  part: ToolLikePart;
  presentation?: PartPresentation;
}) {
  const toolKey = part.kind === "command" ? "Bash" : part.tool;
  const status = statusLabel(part);
  const running =
    status === "running" || !!(part as { streaming?: boolean }).streaming;
  const preview = previewText(part);
  const input = part.kind === "tool" ? part.input : undefined;
  const output = part.kind === "tool" ? part.output : undefined;
  const hasDetails =
    part.kind === "command" ||
    formatPayload(input).length > 0 ||
    formatPayload(output).length > 0;
  const [open, setOpen] = useState(false);
  const displayOpen = running || open;
  const commandPayload = useMemo(
    () =>
      part.kind === "command"
        ? {
            command: part.command,
            exitCode: part.exitCode ?? undefined,
            stdoutPreview: part.stdoutPreview,
            stderrPreview: part.stderrPreview,
          }
        : null,
    [part],
  );

  if (presentation === "timeline") {
    const previewText = preview ?? toolDisplayName(toolKey);
    return (
      <div
        className="chat-timeline-tool min-w-0 text-sm"
        data-tool={toolKey}
        data-status={status ?? "unknown"}
      >
        <TimelineCollapsible
          text={previewText}
          streaming={running}
          streamingLabel="运行中…"
          completeLabel="结束"
        />
        {hasDetails && !running ? (
          <button
            type="button"
            className="mt-1.5 text-xs text-[var(--fg-tertiary)] transition-colors hover:text-[var(--fg-secondary)]"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? "收起详情" : "查看详情"}
          </button>
        ) : null}
        {hasDetails && displayOpen && !running ? (
          <div className="mt-2 flex flex-col gap-2">
            {part.kind === "command" ? (
              <DetailBlock label="command" value={commandPayload} />
            ) : (
              <>
                <DetailBlock label="input" value={input} />
                <DetailBlock label="output" value={output} />
              </>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="chat-tool-card rounded-[var(--radius-md)] border border-[var(--border)]/80 bg-[var(--surface)]/85 text-sm"
      data-tool={toolKey}
      data-status={status ?? "unknown"}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-start gap-2.5 px-3 py-2.5 text-left"
        onClick={() => {
          if (!hasDetails || running) return;
          setOpen((value) => !value);
        }}
        aria-expanded={displayOpen}
      >
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--fg-tertiary)]">
          {running ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-[var(--accent)]"
              aria-hidden
            />
          ) : (
            renderToolIcon(toolKey)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-[var(--fg)]">
              {toolDisplayName(toolKey)}
            </span>
            {status ? (
              <span className={`text-[11px] ${toolStatusTextClass(status)}`}>
                {running ? "进行中" : status === "error" ? "失败" : "完成"}
              </span>
            ) : null}
            {hasDetails ? (
              <span className="ml-auto text-[var(--fg-tertiary)]">
                {displayOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                )}
              </span>
            ) : null}
          </div>
          {preview ? (
            <p className="mt-0.5 whitespace-pre-wrap break-words font-mono text-xs text-[var(--fg-secondary)]">
              {preview}
            </p>
          ) : null}
        </div>
      </button>
      {hasDetails && displayOpen ? (
        <div className="flex flex-col gap-3 border-t border-[var(--border)]/70 px-3 py-3">
          {part.kind === "command" ? (
            <DetailBlock label="command" value={commandPayload} />
          ) : (
            <>
              <DetailBlock label="input" value={input} />
              <DetailBlock label="output" value={output} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

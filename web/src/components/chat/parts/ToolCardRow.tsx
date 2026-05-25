"use client";

import type { ChatPart } from "@/lib/chat-parts";
import { toolStatusTextClass } from "@/lib/activity-status-tone";
import { toolDisplayName } from "@/lib/tool-family";
import {
  FileSearch,
  FolderOpen,
  Globe,
  Loader2,
  Search,
  Terminal,
  Wrench,
} from "lucide-react";

type ToolLikePart =
  | Extract<ChatPart, { kind: "tool" }>
  | Extract<ChatPart, { kind: "command" }>;

function toolIcon(tool: string) {
  const name = tool.toLowerCase();
  if (name === "bash" || name === "run_terminal" || name === "shell") {
    return Terminal;
  }
  if (
    name === "grep" ||
    name === "search" ||
    name === "web_search" ||
    name === "choice_query"
  ) {
    return Search;
  }
  if (name === "web_extract" || name === "fetch") {
    return Globe;
  }
  if (name === "list_dir" || name === "glob") {
    return FolderOpen;
  }
  if (name.includes("read") || name.includes("file")) {
    return FileSearch;
  }
  return Wrench;
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

export function ToolCardRow({ part }: { part: ToolLikePart }) {
  const toolKey = part.kind === "command" ? "Bash" : part.tool;
  const Icon = toolIcon(toolKey);
  const status = statusLabel(part);
  const running =
    status === "running" || !!(part as { streaming?: boolean }).streaming;
  const preview = previewText(part);

  return (
    <div
      className="chat-tool-card rounded-[var(--radius-md)] border border-[var(--border)]/80 bg-[var(--surface)]/85 text-sm"
      data-tool={toolKey}
      data-status={status ?? "unknown"}
    >
      <div className="flex min-w-0 items-start gap-2.5 px-3 py-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--fg-tertiary)]">
          {running ? (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-[var(--accent)]"
              aria-hidden
            />
          ) : (
            <Icon className="h-3.5 w-3.5" aria-hidden />
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
          </div>
          {preview ? (
            <p className="mt-0.5 line-clamp-3 break-all font-mono text-xs text-[var(--fg-secondary)]">
              {preview}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

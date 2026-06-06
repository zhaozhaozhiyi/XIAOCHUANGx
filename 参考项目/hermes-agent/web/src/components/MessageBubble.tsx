/**
 * Message bubble component for chat messages
 */

import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { Check, Copy, Edit, RotateCcw, User, Bot, Wrench } from "lucide-react";
import { useState, useCallback } from "react";
import type { ChatMessage, ToolCallData } from "@/types/chat";
import { Markdown } from "@/components/Markdown";

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
}

export function MessageBubble({
  message,
  onCopy,
  onEdit,
  onRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  }, [message.content, onCopy]);

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-3 chat-message-enter",
        isUser ? "flex-row-reverse bubble-enter-user" : "flex-row bubble-enter-assistant"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-blue-500" : "bg-emerald-500"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Role label */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">
            {isUser ? "你" : isAssistant ? "助手" : "系统"}
          </span>
          <span>•</span>
          <span>{formatTime(message.timestamp)}</span>
          {message.metadata?.model && (
            <>
              <span>•</span>
              <span className="text-muted-foreground/60">
                {message.metadata.model.split("/").pop()}
              </span>
            </>
          )}
        </div>

        {/* Bubble */}
        <div
          className={cn(
            "relative max-w-[85%] rounded-2xl px-4 py-2.5",
            isUser
              ? "bg-blue-500 text-white"
              : "bg-muted/30 text-foreground",
            message.isStreaming && "animate-pulse"
          )}
        >
          {/* Content */}
          <div
            className={cn(
              "prose prose-sm max-w-none",
              isUser ? "prose-invert" : ""
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <Markdown content={message.content} />
            )}
          </div>

          {/* Streaming indicator */}
          {message.isStreaming && (
            <div className="mt-2 flex items-center gap-1">
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
              <div className="typing-dot h-1.5 w-1.5 rounded-full bg-current" />
            </div>
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex max-w-[85%] flex-col gap-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallBubble key={toolCall.tool_id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Actions */}
        {!message.isStreaming && (
          <div
            className={cn(
              "flex gap-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "flex-row-reverse" : "flex-row"
            )}
          >
            <Button
              ghost
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              title="复制"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
            {isUser && onEdit && (
              <Button
                ghost
                size="icon"
                className="h-7 w-7"
                onClick={onEdit}
                title="编辑"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAssistant && onRegenerate && (
              <Button
                ghost
                size="icon"
                className="h-7 w-7"
                onClick={onRegenerate}
                title="重新生成"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolCallBubbleProps {
  toolCall: ToolCallData;
}

function ToolCallBubble({ toolCall }: ToolCallBubbleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border bg-muted/20 px-3 py-2 text-xs",
        toolCall.status === "running" && "border-blue-500/50",
        toolCall.status === "done" && "border-green-500/50",
        toolCall.status === "error" && "border-red-500/50"
      )}
    >
      <div className="flex items-start gap-2">
        <Wrench
          className={cn(
            "mt-0.5 h-3.5 w-3.5 shrink-0",
            toolCall.status === "running" && "animate-spin text-blue-500",
            toolCall.status === "done" && "text-green-500",
            toolCall.status === "error" && "text-red-500"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{toolCall.name}</span>
            <span className="text-muted-foreground">
              {formatDuration(toolCall.startedAt, toolCall.completedAt)}
            </span>
          </div>
          {toolCall.context && (
            <div className="mt-1 text-muted-foreground">{toolCall.context}</div>
          )}
          {toolCall.preview && toolCall.status === "running" && (
            <div className="mt-1 truncate text-muted-foreground">
              {toolCall.preview}
            </div>
          )}
          {expanded && toolCall.summary && (
            <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
              {toolCall.summary}
            </div>
          )}
          {toolCall.error && (
            <div className="mt-1 text-red-500">{toolCall.error}</div>
          )}
        </div>
        {toolCall.summary && (
          <Button
            ghost
            size="sm"
            className="h-5 px-1.5 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "收起" : "展开"}
          </Button>
        )}
      </div>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: number, end?: number): string {
  const duration = (end ?? Date.now()) - start;
  const seconds = Math.floor(duration / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

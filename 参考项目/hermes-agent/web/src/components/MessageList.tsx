/**
 * Message list component with auto-scroll and history loading
 */

import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/MessageBubble";
import { Bot, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  onCopyMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  onCopyMessage,
  onEditMessage,
  onRegenerateMessage,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, autoScroll]);

  // Detect if user has scrolled up
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isAtBottom);
  }, []);

  // Scroll to bottom button
  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
  }, []);

  const isEmpty = messages.length === 0;

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto chat-scroll"
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-1 py-4">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onCopy={() => onCopyMessage?.(message.id)}
              onEdit={() => onEditMessage?.(message.id)}
              onRegenerate={() => onRegenerateMessage?.(message.id)}
            />
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>思考中...</span>
        </div>
      )}

      {/* Scroll to bottom */}
      {!autoScroll && (
        <button
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-24 left-1/2 z-10 -translate-x-1/2",
            "flex h-8 w-8 items-center justify-center rounded-full",
            "border bg-background shadow-lg scroll-to-bottom-btn",
            "transition-all hover:scale-110"
          )}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    { icon: "📊", text: "上周螺纹钢社会库存环比变化" },
    { icon: "📈", text: "对比三家机构对原油的多空观点" },
    { icon: "📝", text: "生成一份螺纹钢周报大纲" },
    { icon: "🔍", text: "分析聚乙烯开工率数据趋势" },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          开始你的研究问题
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          接入 Choice 终端数据与多信源分析，获取专业研究报告
        </p>
      </div>

      {/* Quick suggestions */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={index}
            icon={suggestion.icon}
            text={suggestion.text}
          />
        ))}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  icon: string;
  text: string;
}

function SuggestionCard({ icon, text }: SuggestionCardProps) {
  return (
    <button
      className={cn(
        "suggestion-card flex items-start gap-3 rounded-xl border bg-card p-4 text-left",
        "transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5 hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      )}
      onClick={() => {
        // Dispatch a custom event that ChatInput can listen to
        const event = new CustomEvent("chat-suggestion", { detail: text });
        window.dispatchEvent(event);
      }}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm text-foreground">{text}</span>
    </button>
  );
}

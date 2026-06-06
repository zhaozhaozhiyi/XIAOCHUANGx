/**
 * Chat input component with multiline support and keyboard shortcuts
 */

import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { Send, Paperclip, X, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ChatInputProps {
  onSend: (message: string, attachments?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "输入问题，接入 Choice 终端数据与多信源分析…",
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const maxHeight = 200;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [input]);

  // Listen for suggestion clicks from EmptyState
  useEffect(() => {
    const handleSuggestion = (e: CustomEvent<string>) => {
      setInput(e.detail);
      textareaRef.current?.focus();
    };

    window.addEventListener("chat-suggestion", handleSuggestion as EventListener);
    return () => {
      window.removeEventListener(
        "chat-suggestion",
        handleSuggestion as EventListener
      );
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmedInput = input.trim();
    if (!trimmedInput || disabled) return;

    onSend(trimmedInput, attachments);
    setInput("");
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, attachments, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Send on Enter (without Shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      setAttachments((prev) => [...prev, ...files]);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    []
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSend = input.trim().length > 0 && !disabled;

  return (
    <div className="border-t bg-background/95 p-4 backdrop-blur-sm">
      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5",
                "text-xs text-muted-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[150px] truncate">{file.name}</span>
              <button
                onClick={() => removeAttachment(index)}
                className="ml-1 rounded hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-3">
        {/* Attachment button */}
        <Button
          ghost
          size="icon"
          className="shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="添加附件"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json"
        />

        {/* Textarea */}
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            rows={1}
            className={cn(
              "w-full resize-none rounded-2xl border bg-background px-4 py-3",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "min-h-[44px] max-h-[200px]"
            )}
          />

          {/* Character count */}
          {input.length > 0 && (
            <div className="absolute bottom-1 right-3 text-xs text-muted-foreground/50">
              {input.length}
            </div>
          )}
        </div>

        {/* Send button */}
        <Button
          solid
          size="icon"
          className={cn(
            "shrink-0 rounded-xl",
            canSend
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-muted cursor-not-allowed opacity-50"
          )}
          onClick={handleSend}
          disabled={!canSend}
          title="发送 (Enter)"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Keyboard hints */}
      <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground/60">
        <span>
          <kbd className="rounded bg-muted/50 px-1.5 py-0.5">Enter</kbd> 发送
        </span>
        <span>
          <kbd className="rounded bg-muted/50 px-1.5 py-0.5">Shift + Enter</kbd>{" "}
          换行
        </span>
      </div>
    </div>
  );
}

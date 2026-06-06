/**
 * ModernChatPage - Modern chat interface using GatewayClient
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatProvider, useChat } from "@/contexts/ChatContext";
import { MessageList } from "@/components/MessageList";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";
import { PanelRight } from "lucide-react";
import { usePageHeader } from "@/contexts/usePageHeader";
import { useI18n } from "@/i18n";
import { GatewayClient, type ConnectionState } from "@/lib/gatewayClient";

interface ModernChatPageProps {
  isActive?: boolean;
}

export default function ModernChatPage({ isActive = true }: ModernChatPageProps) {
  return (
    <ChatProvider>
      <ModernChatPageContent isActive={isActive} />
    </ChatProvider>
  );
}

function ModernChatPageContent({ isActive = true }: ModernChatPageProps) {
  const {
    currentSession,
    addMessage,
    updateMessage,
    appendContent,
    setStreaming,
    addToolCall,
    updateToolCall,
    createSession,
  } = useChat();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gw = useMemo(() => new GatewayClient(), [version]);

  const { setEnd } = usePageHeader();
  const { t } = useI18n();

  // Setup gateway connection and event handlers
  useEffect(() => {
    let cancelled = false;

    const offState = gw.onState((state) => {
      console.log("[chat] Gateway state:", state);
    });

    const offSessionInfo = gw.on("session.info", (ev) => {
      if (ev.session_id) {
        setSessionId(ev.session_id);
      }
    });

    const offMessageStart = gw.on("message.start", (ev) => {
      if (cancelled) return;
      
      const messageId = addMessage({
        role: "assistant",
        content: "",
        isStreaming: true,
        metadata: ev.payload,
      });
      setCurrentMessageId(messageId);
      setIsLoading(false);
    });

    const offMessageDelta = gw.on("message.delta", (ev) => {
      if (cancelled || !currentMessageId) return;
      
      const text = ev.payload?.text;
      if (text) {
        appendContent(currentMessageId, text);
      }
    });

    const offMessageComplete = gw.on("message.complete", (ev) => {
      if (cancelled) return;
      
      if (currentMessageId) {
        setStreaming(currentMessageId, false);
        if (ev.payload?.finish_reason) {
          updateMessage(currentMessageId, {
            metadata: {
              finishReason: ev.payload.finish_reason,
            },
          });
        }
        setCurrentMessageId(null);
      }
    });

    const offToolStart = gw.on("tool.start", (ev) => {
      if (cancelled || !currentMessageId) return;
      
      const p = ev.payload;
      if (p?.tool_id) {
        addToolCall(currentMessageId, {
          tool_id: p.tool_id,
          name: p.name ?? "tool",
          context: p.context,
          status: "running",
          startedAt: Date.now(),
        });
      }
    });

    const offToolProgress = gw.on("tool.progress", (ev) => {
      if (cancelled || !currentMessageId) return;
      
      const p = ev.payload;
      if (p?.name && p.preview) {
        // Find tool by name
        const tools = currentSession?.messages.find(m => m.id === currentMessageId)?.toolCalls;
        const tool = tools?.find(t => t.name === p.name);
        if (tool) {
          updateToolCall(currentMessageId, tool.tool_id, {
            preview: p.preview,
          });
        }
      }
    });

    const offToolComplete = gw.on("tool.complete", (ev) => {
      if (cancelled || !currentMessageId) return;
      
      const p = ev.payload;
      if (p?.tool_id) {
        updateToolCall(currentMessageId, p.tool_id, {
          status: p.error ? "error" : "done",
          summary: p.summary,
          error: p.error,
          completedAt: Date.now(),
        });
      }
    });

    const offError = gw.on("error", (ev) => {
      if (cancelled) return;
      
      const message = ev.payload?.message ?? "An error occurred";
      setError(message);
      setIsLoading(false);
      if (currentMessageId) {
        setStreaming(currentMessageId, false);
        setCurrentMessageId(null);
      }
    });

    // Connect and create session
    gw.connect()
      .then(() => {
        if (cancelled) return;
        return gw.request<{ session_id: string }>("session.create", {});
      })
      .then((created) => {
        if (cancelled || !created?.session_id) return;
        setSessionId(created.session_id);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message);
        }
      });

    return () => {
      cancelled = true;
      offState();
      offSessionInfo();
      offMessageStart();
      offMessageDelta();
      offMessageComplete();
      offToolStart();
      offToolProgress();
      offToolComplete();
      offError();
      gw.close();
    };
  }, [gw, version]);

  // Send message handler
  const handleSendMessage = useCallback((content: string) => {
    if (!sessionId) {
      setError("Session not ready. Please wait...");
      return;
    }

    // Add user message
    addMessage({
      role: "user",
      content,
    });

    // Send to gateway
    gw.request("prompt.submit", {
      session_id: sessionId,
      text: content,
    }).catch((err) => {
      console.error("[chat] Failed to send message:", err);
      setError(err.message);
    });

    setIsLoading(true);
    setError(null);
  }, [sessionId, gw, addMessage]);

  // Reconnect handler
  const handleReconnect = useCallback(() => {
    setError(null);
    setVersion(v => v + 1);
  }, []);

  // Header button for mobile sidebar toggle
  useEffect(() => {
    if (!isActive) {
      setEnd(null);
      return;
    }

    setEnd(
      <Button
        ghost
        onClick={() => setShowSidebar(!showSidebar)}
        aria-expanded={showSidebar}
        className={cn(
          "shrink-0 rounded border border-current/20",
          "px-2 py-1 text-[0.65rem] font-medium tracking-wide normal-case",
          "text-midground/80 hover:text-midground hover:bg-midground/5"
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          <PanelRight className="h-3 w-3 shrink-0" />
          {t.app.modelToolsSheetTitle}
        </span>
      </Button>
    );

    return () => setEnd(null);
  }, [isActive, showSidebar, t.app.modelToolsSheetTitle, setEnd]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden normal-case">
      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-2 border-b border-warning/50 bg-warning/10 px-4 py-2 text-xs text-warning">
          <span>{error}</span>
          <Button
            size="sm"
            onClick={handleReconnect}
            className="shrink-0"
          >
            重连
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Chat area */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Message list */}
          <MessageList
            messages={currentSession?.messages ?? []}
            isLoading={isLoading}
          />

          {/* Input area */}
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading || gw.state !== "open"}
          />
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="hidden lg:block lg:w-80 lg:border-l">
            <ChatSidebar channel="default" />
          </div>
        )}
      </div>
    </div>
  );
}

// Extend Window interface
declare global {
  interface Window {
    __HERMES_SESSION_TOKEN__?: string;
  }
}

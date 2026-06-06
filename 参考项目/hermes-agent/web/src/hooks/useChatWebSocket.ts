/**
 * Chat WebSocket adapter - bridges PTY WebSocket to modern chat UI
 * 
 * This adapter connects to the existing PTY WebSocket and parses
 * ANSI output to extract structured message data for the modern UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types/chat";

interface UseChatWebSocketOptions {
  onMessageStart?: (metadata?: any) => string;
  onMessageChunk?: (messageId: string, content: string) => void;
  onMessageComplete?: (messageId: string) => void;
  onToolStart?: (messageId: string, toolData: any) => void;
  onToolProgress?: (messageId: string, toolId: string, preview: string) => void;
  onToolComplete?: (messageId: string, toolId: string, result: any) => void;
  onError?: (error: string) => void;
}

export function useChatWebSocket(options: UseChatWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef<string>("");
  const currentMessageIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    const token = window.__HERMES_SESSION_TOKEN__;
    if (!token) {
      setError("Session token unavailable");
      return;
    }

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/api/pty?token=${token}`;
    
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log("[chat-ws] Connected");
    };

    ws.onmessage = (event) => {
      const data = typeof event.data === "string" 
        ? event.data 
        : new TextDecoder().decode(event.data as ArrayBuffer);
      
      parsePTYOutput(data, options, bufferRef, currentMessageIdRef);
    };

    ws.onerror = (err) => {
      console.error("[chat-ws] Error:", err);
      setError("Connection error");
      options.onError?.("Connection error");
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      console.log("[chat-ws] Closed:", event.code);
      
      if (event.code === 4401) {
        setError("Auth failed");
      } else if (event.code === 4403) {
        setError("Access denied");
      }
    };
  }, [options]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("[chat-ws] Not connected");
      return false;
    }

    // Send as PTY input
    ws.send(content + "\r");
    return true;
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
    send,
  };
}

/**
 * Parse PTY output to extract structured message data
 * 
 * This is a simplified parser that looks for common patterns in the output.
 * A more robust solution would use a proper ANSI parser.
 */
function parsePTYOutput(
  data: string,
  options: UseChatWebSocketOptions,
  bufferRef: React.MutableRefObject<string>,
  currentMessageIdRef: React.MutableRefObject<string | null>
) {
  // Accumulate data in buffer
  bufferRef.current += data;
  
  // Look for message markers
  // This is a simplified version - in production, you'd use a proper ANSI parser
  
  // Example patterns to detect:
  // - User input echo
  // - Assistant response start
  // - Tool call markers
  // - Streaming content
  
  // For now, just pass through as plain text
  // In a real implementation, you'd parse ANSI codes and extract structured data
  
  const messageId = currentMessageIdRef.current;
  
  if (messageId) {
    // Append to current message
    options.onMessageChunk?.(messageId, cleanANSI(data));
  }
}

/**
 * Remove ANSI escape codes from text
 */
function cleanANSI(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

/**
 * Extract message type from ANSI output
 */
function detectMessageType(text: string): "user" | "assistant" | "tool" | "system" | null {
  // Look for common patterns
  if (text.includes("❯") || text.includes(">")) {
    return "user";
  }
  if (text.includes("✓") || text.includes("✔")) {
    return "assistant";
  }
  if (text.includes("⚙") || text.includes("🔧")) {
    return "tool";
  }
  return null;
}

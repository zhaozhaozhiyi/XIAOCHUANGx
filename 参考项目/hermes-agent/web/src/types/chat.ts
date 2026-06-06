/**
 * Chat message types for modern chat UI
 */

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface ToolCallData {
  tool_id: string;
  name: string;
  context?: string;
  status: "running" | "done" | "error";
  preview?: string;
  summary?: string;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  toolCalls?: ToolCallData[];
  metadata?: {
    model?: string;
    provider?: string;
    tokens?: number;
    finishReason?: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  provider?: string;
}

export interface ChatState {
  sessions: ChatSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

export type ChatAction =
  | { type: "CREATE_SESSION"; payload: ChatSession }
  | { type: "DELETE_SESSION"; payload: string }
  | { type: "SELECT_SESSION"; payload: string }
  | { type: "ADD_MESSAGE"; payload: { sessionId: string; message: ChatMessage } }
  | { type: "UPDATE_MESSAGE"; payload: { sessionId: string; messageId: string; updates: Partial<ChatMessage> } }
  | { type: "SET_STREAMING"; payload: { sessionId: string; messageId: string; isStreaming: boolean } }
  | { type: "APPEND_CONTENT"; payload: { sessionId: string; messageId: string; content: string } }
  | { type: "ADD_TOOL_CALL"; payload: { sessionId: string; messageId: string; toolCall: ToolCallData } }
  | { type: "UPDATE_TOOL_CALL"; payload: { sessionId: string; messageId: string; toolId: string; updates: Partial<ToolCallData> } }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_LOADING"; payload: boolean };

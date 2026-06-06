/**
 * Chat context for managing chat state across the application
 */

import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import type { ChatState, ChatAction, ChatMessage, ChatSession, ToolCallData } from "@/types/chat";

const initialState: ChatState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "CREATE_SESSION":
      return {
        ...state,
        sessions: [...state.sessions, action.payload],
        currentSessionId: action.payload.id,
      };

    case "DELETE_SESSION":
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.payload),
        currentSessionId:
          state.currentSessionId === action.payload
            ? state.sessions[0]?.id ?? null
            : state.currentSessionId,
      };

    case "SELECT_SESSION":
      return {
        ...state,
        currentSessionId: action.payload,
      };

    case "ADD_MESSAGE": {
      const { sessionId, message } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...session.messages, message],
                updatedAt: Date.now(),
              }
            : session
        ),
      };
    }

    case "UPDATE_MESSAGE": {
      const { sessionId, messageId, updates } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, ...updates } : msg
                ),
                updatedAt: Date.now(),
              }
            : session
        ),
      };
    }

    case "SET_STREAMING": {
      const { sessionId, messageId, isStreaming } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId ? { ...msg, isStreaming } : msg
                ),
              }
            : session
        ),
      };
    }

    case "APPEND_CONTENT": {
      const { sessionId, messageId, content } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, content: msg.content + content }
                    : msg
                ),
              }
            : session
        ),
      };
    }

    case "ADD_TOOL_CALL": {
      const { sessionId, messageId, toolCall } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, toolCalls: [...(msg.toolCalls ?? []), toolCall] }
                    : msg
                ),
              }
            : session
        ),
      };
    }

    case "UPDATE_TOOL_CALL": {
      const { sessionId, messageId, toolId, updates } = action.payload;
      return {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === messageId
                    ? {
                        ...msg,
                        toolCalls: msg.toolCalls?.map((tc) =>
                          tc.tool_id === toolId ? { ...tc, ...updates } : tc
                        ),
                      }
                    : msg
                ),
              }
            : session
        ),
      };
    }

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  currentSession: ChatSession | null;
  createSession: (title?: string) => ChatSession;
  deleteSession: (sessionId: string) => void;
  selectSession: (sessionId: string) => void;
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => void;
  appendContent: (messageId: string, content: string) => void;
  setStreaming: (messageId: string, isStreaming: boolean) => void;
  addToolCall: (messageId: string, toolCall: ToolCallData) => void;
  updateToolCall: (messageId: string, toolId: string, updates: Partial<ToolCallData>) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const messageCounterRef = useRef(0);

  const currentSession = state.sessions.find((s) => s.id === state.currentSessionId) ?? null;

  const generateId = useCallback(() => {
    return `msg-${Date.now()}-${++messageCounterRef.current}`;
  }, []);

  const createSession = useCallback((title?: string): ChatSession => {
    const session: ChatSession = {
      id: `session-${Date.now()}`,
      title: title ?? "新对话",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "CREATE_SESSION", payload: session });
    return session;
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    dispatch({ type: "DELETE_SESSION", payload: sessionId });
  }, []);

  const selectSession = useCallback((sessionId: string) => {
    dispatch({ type: "SELECT_SESSION", payload: sessionId });
  }, []);

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">): string => {
      if (!state.currentSessionId) {
        const session = createSession();
        const fullMessage: ChatMessage = {
          ...message,
          id: generateId(),
          timestamp: Date.now(),
        };
        dispatch({
          type: "ADD_MESSAGE",
          payload: { sessionId: session.id, message: fullMessage },
        });
        return fullMessage.id;
      }

      const fullMessage: ChatMessage = {
        ...message,
        id: generateId(),
        timestamp: Date.now(),
      };
      dispatch({
        type: "ADD_MESSAGE",
        payload: { sessionId: state.currentSessionId, message: fullMessage },
      });
      return fullMessage.id;
    },
    [state.currentSessionId, createSession, generateId]
  );

  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ChatMessage>) => {
      if (!state.currentSessionId) return;
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: { sessionId: state.currentSessionId, messageId, updates },
      });
    },
    [state.currentSessionId]
  );

  const appendContent = useCallback(
    (messageId: string, content: string) => {
      if (!state.currentSessionId) return;
      dispatch({
        type: "APPEND_CONTENT",
        payload: { sessionId: state.currentSessionId, messageId, content },
      });
    },
    [state.currentSessionId]
  );

  const setStreaming = useCallback(
    (messageId: string, isStreaming: boolean) => {
      if (!state.currentSessionId) return;
      dispatch({
        type: "SET_STREAMING",
        payload: { sessionId: state.currentSessionId, messageId, isStreaming },
      });
    },
    [state.currentSessionId]
  );

  const addToolCall = useCallback(
    (messageId: string, toolCall: ToolCallData) => {
      if (!state.currentSessionId) return;
      dispatch({
        type: "ADD_TOOL_CALL",
        payload: { sessionId: state.currentSessionId, messageId, toolCall },
      });
    },
    [state.currentSessionId]
  );

  const updateToolCall = useCallback(
    (messageId: string, toolId: string, updates: Partial<ToolCallData>) => {
      if (!state.currentSessionId) return;
      dispatch({
        type: "UPDATE_TOOL_CALL",
        payload: { sessionId: state.currentSessionId, messageId, toolId, updates },
      });
    },
    [state.currentSessionId]
  );

  const value: ChatContextValue = {
    state,
    dispatch,
    currentSession,
    createSession,
    deleteSession,
    selectSession,
    addMessage,
    updateMessage,
    appendContent,
    setStreaming,
    addToolCall,
    updateToolCall,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

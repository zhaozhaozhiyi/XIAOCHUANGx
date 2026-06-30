import type { ChatMessage } from "@/lib/chat";
import { messageContentForApi } from "@/lib/chat-history-context";
import type { ChatSendContext } from "@/lib/chat-send";
import { consumeChatSse, type ChatStreamCallbacks } from "@/lib/chat-stream";
import type { HermesHistoryMessage } from "@/lib/hermes/types";
import { workspaceErrorMessage } from "@/lib/workspace-errors";

export type StreamChatCallbacks = ChatStreamCallbacks & {
  onProjectEnsured?: (project: {
    id: string;
    name: string;
    pathSummary: string;
  }) => void;
};

export type StreamChatResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

function decodeHeaderValue(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function historyFromMessages(
  messages: ChatMessage[],
  currentAgentId: string,
): HermesHistoryMessage[] {
  return messages
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        m.status !== "loading" &&
        m.status !== "error" &&
        messageContentForApi(m).trim().length > 0,
    )
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: messageContentForApi(m),
      attachments: m.attachments,
      ...(m.role === "assistant"
        ? { agentId: m.agentId ?? currentAgentId }
        : {}),
    }));
}

export async function streamChatCompletion(
  params: {
    sessionId: string;
    context: ChatSendContext;
    messages: ChatMessage[];
    useClientHistory?: boolean;
    signal?: AbortSignal;
  } & StreamChatCallbacks,
): Promise<StreamChatResult> {
  const history = historyFromMessages(params.messages, params.context.agentId);
  const { mode, agentId, agentModel, projectId } = params.context;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: params.sessionId,
      mode,
      executionSource: params.context.executionSource,
      agentId,
      agentModel,
      apiProvider:
        params.context.executionSource === "api"
          ? params.context.apiProvider
          : undefined,
      projectId,
      surfaceModuleId: params.context.surfaceModuleId,
      writingTemplateId: params.context.writingTemplateId,
      pptTemplateId: params.context.pptTemplateId,
      messages: history,
      useClientHistory: params.useClientHistory,
    }),
    signal: params.signal,
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const json = (await res.json()) as { message?: string; error?: string };
      message = json.message ?? json.error ?? message;
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: workspaceErrorMessage(message) ?? message,
      status: res.status,
    };
  }

  if (!res.body) {
    return { ok: false, error: "空响应体" };
  }

  const execution = res.headers.get("X-JLC-Execution");
  const format = execution === "companion" ? "companion" : "openai";
  const companionRunId = res.headers.get("X-JLC-Run-Id");
  if (format === "companion" && companionRunId) {
    params.onRunStarted?.({ runId: companionRunId });
  }

  const ensuredProjectId = res.headers.get("X-JLC-Project-Id");
  if (ensuredProjectId) {
    params.onProjectEnsured?.({
      id: ensuredProjectId,
      name:
        decodeHeaderValue(res.headers.get("X-JLC-Project-Name")) ??
        ensuredProjectId,
      pathSummary: decodeHeaderValue(res.headers.get("X-JLC-Project-Path")) ?? "",
    });
  }

  return consumeChatSse(res.body, params, { format });
}

export { fetchRuntimeHealth } from "@/lib/runtime-health";

/** @deprecated 使用 fetchRuntimeHealth */
export async function fetchHermesHealth(): Promise<{
  ok: boolean;
  mode?: string;
  error?: string;
}> {
  const { fetchRuntimeHealth } = await import("@/lib/runtime-health");
  const h = await fetchRuntimeHealth();
  return {
    ok: h.ok,
    mode: h.mode ?? h.execution,
    error: h.error,
  };
}

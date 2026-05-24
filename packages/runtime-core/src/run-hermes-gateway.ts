import { hermesGatewayEventToProgress } from "./map-tool-progress.js";
import type { RunAgentCallbacks, RunAgentResult } from "./types.js";

export type RunHermesGatewayInput = {
  baseUrl: string;
  apiKey?: string;
  model: string;
  sessionKey: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
};

function parseOpenAiDelta(data: string): string | null {
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return json.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

export async function probeHermesGateway(
  baseUrl: string,
  timeoutMs = 2000,
): Promise<boolean> {
  const url = `${baseUrl.replace(/\/$/, "")}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Stream Hermes API Server `/v1/chat/completions` (SSE + hermes.tool.progress). */
export async function runHermesGateway(
  input: RunHermesGatewayInput,
  callbacks: RunAgentCallbacks,
  options?: { signal?: AbortSignal },
): Promise<RunAgentResult> {
  const url = `${input.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hermes-Session-Key": input.sessionKey,
  };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
  }

  let textEmitted = false;
  const labelByCallId = new Map<string, string>();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        stream: true,
      }),
      signal: options?.signal,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Hermes Gateway unreachable";
    callbacks.onError?.(message, "hermes_unreachable");
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: true,
      stderrTail: message,
    };
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 500);
    callbacks.onError?.(
      detail || `Hermes Gateway HTTP ${res.status}`,
      "hermes_http_error",
    );
    return {
      exitCode: res.status,
      signal: null,
      cancelled: false,
      emptyOutput: true,
      stderrTail: detail,
    };
  }

  if (!res.body) {
    callbacks.onError?.("Hermes Gateway empty body", "hermes_empty");
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: true,
    };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let cancelled = false;

  options?.signal?.addEventListener(
    "abort",
    () => {
      cancelled = true;
      reader.cancel().catch(() => {});
    },
    { once: true },
  );

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          return {
            exitCode: 0,
            signal: null,
            cancelled,
            emptyOutput: !textEmitted,
          };
        }

        if (eventName === "hermes.tool.progress") {
          try {
            const json = JSON.parse(data) as unknown;
            const progress = hermesGatewayEventToProgress(json, labelByCallId);
            if (progress) {
              callbacks.onToolProgress?.(progress);
            }
          } catch {
            /* ignore */
          }
          eventName = "message";
          continue;
        }

        const content = parseOpenAiDelta(data);
        if (content) {
          textEmitted = true;
          callbacks.onText(content);
        }
        eventName = "message";
      }
    }

    return {
      exitCode: 0,
      signal: null,
      cancelled,
      emptyOutput: !textEmitted,
    };
  } catch (err) {
    if (cancelled || options?.signal?.aborted) {
      return {
        exitCode: null,
        signal: "SIGTERM",
        cancelled: true,
        emptyOutput: !textEmitted,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    callbacks.onError?.(message, "hermes_stream_error");
    return {
      exitCode: 1,
      signal: null,
      cancelled: false,
      emptyOutput: !textEmitted,
      stderrTail: message,
    };
  } finally {
    reader.releaseLock();
  }
}

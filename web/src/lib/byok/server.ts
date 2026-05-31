import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { buildChatCompletionMessages } from "@/lib/hermes/openai";
import type { HermesHistoryMessage } from "@/lib/hermes/types";
import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";
import {
  providerDisplayName,
  trimApiProviderConfig,
  type ApiProviderConfig,
  type ApiProviderModelOption,
} from "@/lib/byok/shared";

const OPENAI_CHAT_PATH = "/chat/completions";
const OPENAI_MODELS_PATH = "/models";
const ANTHROPIC_MESSAGES_PATH = "/messages";
const ANTHROPIC_MODELS_PATH = "/models";

function normalizeBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Base URL 格式无效");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅支持 http / https Provider 地址");
  }
  return url;
}

function isLoopbackHostname(hostname: string): boolean {
  const lowered = hostname.toLowerCase();
  return lowered === "localhost" || lowered === "::1" || lowered === "127.0.0.1";
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return false;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const lowered = ip.toLowerCase();
  if (lowered === "::1") return false;
  return (
    lowered.startsWith("fc") ||
    lowered.startsWith("fd") ||
    lowered.startsWith("fe8") ||
    lowered.startsWith("fe9") ||
    lowered.startsWith("fea") ||
    lowered.startsWith("feb") ||
    lowered.startsWith("ff") ||
    lowered === "::"
  );
}

function isDisallowedIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return isPrivateIpv4(ip);
  if (family === 6) return isPrivateIpv6(ip);
  return true;
}

async function assertSafeProviderUrl(baseUrl: string): Promise<void> {
  const url = normalizeBaseUrl(baseUrl);
  if (isLoopbackHostname(url.hostname)) return;
  if (isIP(url.hostname) > 0) {
    if (isDisallowedIp(url.hostname)) {
      throw new Error("禁止访问私有网络 Provider 地址");
    }
    return;
  }

  const resolved = await lookup(url.hostname, { all: true });
  if (!resolved.length) {
    throw new Error("Provider 地址解析失败");
  }
  if (resolved.some((record) => isDisallowedIp(record.address))) {
    throw new Error("禁止访问私有网络 Provider 地址");
  }
}

function resolveProviderEndpoint(
  config: ApiProviderConfig,
  kind: "chat" | "models",
): string {
  const trimmed = config.baseUrl.replace(/\/$/, "");
  const path =
    config.protocol === "anthropic"
      ? kind === "chat"
        ? ANTHROPIC_MESSAGES_PATH
        : ANTHROPIC_MODELS_PATH
      : kind === "chat"
        ? OPENAI_CHAT_PATH
        : OPENAI_MODELS_PATH;
  return trimmed.endsWith(path) ? trimmed : `${trimmed}${path}`;
}

function buildProviderHeaders(config: ApiProviderConfig): Record<string, string> {
  if (config.protocol === "anthropic") {
    return {
      "Content-Type": "application/json",
      "anthropic-version": config.anthropicVersion || "2023-06-01",
      ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
    };
  }
  return {
    "Content-Type": "application/json",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

function buildAnthropicBody(
  history: HermesHistoryMessage[],
  mode: ChatModeId,
  agentId: AgentId,
  agentModel: string,
  config: ApiProviderConfig,
) {
  const messages = buildChatCompletionMessages(history, mode, agentId, agentModel);
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    model: config.model,
    max_tokens: 4096,
    stream: true,
    ...(system ? { system } : {}),
    messages: messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role,
        content: message.content,
      })),
  };
}

function anthropicToOpenAiStream(
  body: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = body.getReader();
      let buffer = "";
      let eventName = "message";
      let finished = false;

      const emitDone = () => {
        if (finished) return;
        finished = true;
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      };

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
            if (!data) continue;

            if (eventName === "message_stop") {
              emitDone();
              continue;
            }

            if (eventName !== "content_block_delta") continue;

            try {
              const json = JSON.parse(data) as {
                delta?: { type?: string; text?: string };
              };
              if (json.delta?.type !== "text_delta" || !json.delta.text) {
                continue;
              }
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    choices: [{ index: 0, delta: { content: json.delta.text } }],
                  })}\n\n`,
                ),
              );
            } catch {
              continue;
            }
          }
        }

        emitDone();
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function parseModelOptions(data: unknown): ApiProviderModelOption[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((record) => {
      if (!record || typeof record !== "object") return null;
      const model = record as Record<string, unknown>;
      const id = typeof model.id === "string" ? model.id.trim() : "";
      if (!id) return null;
      const label =
        typeof model.display_name === "string"
          ? model.display_name.trim()
          : typeof model.name === "string"
            ? model.name.trim()
            : id;
      return { id, label };
    })
    .filter((item): item is ApiProviderModelOption => !!item);
}

export async function listApiProviderModels(
  rawConfig: ApiProviderConfig,
): Promise<ApiProviderModelOption[]> {
  const config = trimApiProviderConfig(rawConfig);
  await assertSafeProviderUrl(config.baseUrl);

  const response = await fetch(resolveProviderEndpoint(config, "models"), {
    method: "GET",
    headers: buildProviderHeaders(config),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail.slice(0, 240) || `模型列表请求失败 (${response.status})`,
    );
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    models?: unknown;
  };
  return parseModelOptions(payload.data ?? payload.models);
}

export async function probeApiProvider(rawConfig: ApiProviderConfig): Promise<{
  provider: string;
  models: ApiProviderModelOption[];
}> {
  const config = trimApiProviderConfig(rawConfig);
  const models = await listApiProviderModels(config);
  return {
    provider: providerDisplayName(config),
    models,
  };
}

export async function streamApiProviderChat(input: {
  config: ApiProviderConfig;
  history: HermesHistoryMessage[];
  mode: ChatModeId;
  agentId: AgentId;
  agentModel: string;
  signal?: AbortSignal;
}): Promise<Response> {
  const config = trimApiProviderConfig(input.config);

  // 验证配置
  if (!config.baseUrl.trim()) {
    throw new Error("Provider Base URL 为空");
  }
  if (!config.model.trim()) {
    throw new Error("Provider Model ID 为空");
  }

  // 检查 URL 安全性
  try {
    await assertSafeProviderUrl(config.baseUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "URL 安全检查失败";
    console.error("[BYOK] URL security check failed:", {
      baseUrl: config.baseUrl,
      error: message,
    });
    throw new Error(`Provider URL 验证失败: ${message}`);
  }

  const body =
    config.protocol === "anthropic"
      ? buildAnthropicBody(
          input.history,
          input.mode,
          input.agentId,
          input.agentModel,
          config,
        )
      : {
          model: config.model,
          messages: buildChatCompletionMessages(
            input.history,
            input.mode,
            input.agentId,
            input.agentModel,
          ),
          stream: true,
        };

  const endpoint = resolveProviderEndpoint(config, "chat");

  console.log("[BYOK] Requesting provider:", {
    endpoint,
    model: config.model,
    protocol: config.protocol,
    hasApiKey: !!config.apiKey,
  });

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: buildProviderHeaders(config),
      body: JSON.stringify(body),
      signal: input.signal,
    });
  } catch (fetchError) {
    const errorMsg = fetchError instanceof Error ? fetchError.message : "Unknown fetch error";
    console.error("[BYOK] Fetch failed:", {
      endpoint,
      error: errorMsg,
      errorType: fetchError instanceof Error ? fetchError.constructor.name : typeof fetchError,
    });

    // 提供更具体的错误信息
    if (errorMsg.includes("ENOTFOUND")) {
      throw new Error(`无法解析 Provider 域名: ${new URL(config.baseUrl).hostname}`);
    }
    if (errorMsg.includes("ECONNREFUSED")) {
      throw new Error(`无法连接到 Provider 地址: ${config.baseUrl}`);
    }
    if (errorMsg.includes("ETIMEDOUT") || errorMsg.includes("timeout")) {
      throw new Error(`连接 Provider 超时: ${config.baseUrl}`);
    }
    if (errorMsg.includes("UNABLE_TO_VERIFY_LEAF_SIGNATURE") || errorMsg.includes("CERT")) {
      throw new Error(`Provider SSL 证书验证失败: ${config.baseUrl}`);
    }

    throw new Error(`网络请求失败: ${errorMsg}`);
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "provider_error",
        status: upstream.status,
        message: detail.slice(0, 500) || upstream.statusText,
      },
      { status: 502 },
    );
  }

  if (!upstream.body) {
    return Response.json(
      { error: "provider_error", message: "Empty response body from provider" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-JLC-Execution": "api",
    "X-JLC-Provider": providerDisplayName(config),
  });

  return new Response(
    config.protocol === "anthropic"
      ? anthropicToOpenAiStream(upstream.body)
      : upstream.body,
    { status: 200, headers: responseHeaders },
  );
}

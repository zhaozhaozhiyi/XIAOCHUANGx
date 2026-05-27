import { getMockActivityEvents, getMockReply } from "@/lib/chat";
import { buildDeliverablesPart } from "@/lib/mock-deliverables";
import { encodeMockActivitySse } from "@/lib/mock-activity-sse";
import {
  DEFAULT_API_PROVIDER_CONFIG,
  hasUsableApiProviderConfig,
  trimApiProviderConfig,
} from "@/lib/byok/shared";
import { streamApiProviderChat } from "@/lib/byok/server";
import {
  buildCreateRunRequest,
  companionRunResponse,
} from "@/lib/companion/run";
import { chatExecutionMode } from "@/lib/companion/config";
import { assertAgentAvailableServer } from "@/lib/agents-server";
import {
  assertAgentAvailable,
  gatewaySessionKey,
  isValidAgentId,
  resolveUpstreamModel,
} from "@/lib/hermes/agent";
import {
  gatewaySessionId,
  hermesChatCompletionsUrl,
  hermesConfig,
} from "@/lib/hermes/config";
import { buildChatCompletionMessages } from "@/lib/hermes/openai";
import type { ChatModeId } from "@/lib/navigation";
import { normalizeChatMode } from "@/lib/navigation";
import type { ChatCompletionRequestBody } from "@/lib/hermes/types";


export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mockSseStream(
  text: string,
  mode: ChatModeId,
  lastUser: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const parts = text.match(/[\s\S]{1,48}/g) ?? [text];
  const activity = getMockActivityEvents(mode, lastUser);

  return new ReadableStream({
    async start(controller) {
      for (const ev of activity) {
        for (const chunk of encodeMockActivitySse(encoder, ev, "hermes")) {
          controller.enqueue(chunk);
        }
        await new Promise((r) => setTimeout(r, 60));
      }
      const deliverablesPart = buildDeliverablesPart(mode, lastUser);
      if (deliverablesPart) {
        controller.enqueue(
          encoder.encode(
            `event: part.append\ndata: ${JSON.stringify({ part: deliverablesPart })}\n\n`,
          ),
        );
        await new Promise((r) => setTimeout(r, 50));
      }
      for (const part of parts) {
        const payload = JSON.stringify({
          choices: [{ index: 0, delta: { content: part } }],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        await new Promise((r) => setTimeout(r, 40));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

function parseBody(body: unknown): ChatCompletionRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.sessionId !== "string" || !b.sessionId.trim()) return null;
  const mode = typeof b.mode === "string" ? normalizeChatMode(b.mode) : null;
  if (!mode) return null;
  const executionSource = b.executionSource === "api" ? "api" : "cli";
  if (typeof b.agentId !== "string" || !isValidAgentId(b.agentId)) return null;
  if (typeof b.agentModel !== "string" || !b.agentModel.trim()) return null;
  if (!Array.isArray(b.messages)) return null;

  const messages = b.messages
    .filter(
      (m): m is { role: string; content: string } =>
        !!m &&
        typeof m === "object" &&
        (m as { role: string }).role in { user: 1, assistant: 1 } &&
        typeof (m as { content: string }).content === "string",
    )
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const projectId =
    typeof b.projectId === "string" ? b.projectId.trim() : undefined;
  const apiProvider =
    b.apiProvider && typeof b.apiProvider === "object"
      ? (b.apiProvider as ChatCompletionRequestBody["apiProvider"])
      : undefined;

  return {
    sessionId: b.sessionId.trim(),
    mode,
    executionSource,
    agentId: b.agentId,
    agentModel: b.agentModel.trim(),
    apiProvider,
    messages,
    projectId,
    useClientHistory: b.useClientHistory === true,
  };
}

function findLastUserMessageIndex(
  messages: ChatCompletionRequestBody["messages"],
): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return i;
  }
  return -1;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return Response.json(
      {
        error:
          "sessionId, mode, agentId, agentModel, and messages are required",
      },
      { status: 400 },
    );
  }

  const { sessionId, mode, agentId, agentModel, messages, useClientHistory } =
    parsed;
  const executionSource = parsed.executionSource ?? "cli";
  const lastUserIndex = findLastUserMessageIndex(messages);
  const lastUser = lastUserIndex >= 0 ? messages[lastUserIndex] : undefined;

  if (executionSource === "api") {
    const providerConfig = trimApiProviderConfig({
      ...DEFAULT_API_PROVIDER_CONFIG,
      ...(parsed.apiProvider ?? {}),
      enabled: process.env.JLC_BYOK_ENABLED === "true",
      protocol:
        process.env.JLC_BYOK_PROTOCOL === "anthropic" ? "anthropic" : "openai",
      baseUrl:
        process.env.JLC_BYOK_BASE_URL ?? DEFAULT_API_PROVIDER_CONFIG.baseUrl,
      apiKey: process.env.JLC_BYOK_API_KEY ?? "",
      model: process.env.JLC_BYOK_MODEL ?? "",
      providerLabel:
        process.env.JLC_BYOK_PROVIDER_LABEL ??
        DEFAULT_API_PROVIDER_CONFIG.providerLabel,
      anthropicVersion:
        process.env.JLC_BYOK_ANTHROPIC_VERSION ??
        DEFAULT_API_PROVIDER_CONFIG.anthropicVersion,
    });

    if (!hasUsableApiProviderConfig(providerConfig)) {
      return Response.json(
        {
          error: "provider_unavailable",
          message: "当前未配置可用的模型 API Provider",
        },
        { status: 422 },
      );
    }

    try {
      return await streamApiProviderChat({
        config: providerConfig,
        history: messages,
        mode,
        agentId,
        agentModel,
        signal: request.signal,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reach provider";
      return Response.json(
        {
          error: "provider_unreachable",
          message,
        },
        { status: 502 },
      );
    }
  }

  const agentError =
    chatExecutionMode() === "companion"
      ? await assertAgentAvailableServer(agentId)
      : assertAgentAvailable(agentId);
  if (agentError) {
    return Response.json(
      { error: "agent_unavailable", message: agentError },
      { status: 422 },
    );
  }

  if (chatExecutionMode() === "companion") {
    const runReq = await buildCreateRunRequest(parsed);
    return companionRunResponse(runReq, request.signal);
  }

  if (hermesConfig.useMock) {
    const reply = getMockReply(lastUser?.content ?? "", mode, agentId);
    return new Response(
      mockSseStream(reply, mode, lastUser?.content ?? ""),
      {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Hermes-Client": "mock",
        "X-JLC-Agent-Id": agentId,
      },
    },
    );
  }

  const openaiMessages = buildChatCompletionMessages(
    messages,
    mode,
    agentId,
    agentModel,
  );
  const hermesSessionId = gatewaySessionId(sessionId);
  const upstreamModel = resolveUpstreamModel(agentId, agentModel);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Hermes-Session-Key": gatewaySessionKey(sessionId, agentId),
  };
  if (!useClientHistory) {
    headers["X-Hermes-Session-Id"] = hermesSessionId;
  }
  if (hermesConfig.apiKey) {
    headers.Authorization = `Bearer ${hermesConfig.apiKey}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(hermesChatCompletionsUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: upstreamModel,
        messages: openaiMessages,
        stream: true,
      }),
      signal: request.signal,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach Hermes API Server";
    return Response.json(
      {
        error: "hermes_unreachable",
        message: `${message}. Start \`hermes gateway\` with API_SERVER_ENABLED=true, or set HERMES_USE_MOCK=true.`,
        baseUrl: hermesConfig.baseUrl,
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "hermes_error",
        status: upstream.status,
        message: detail.slice(0, 500) || upstream.statusText,
      },
      { status: 502 },
    );
  }

  if (!upstream.body) {
    return Response.json(
      { error: "hermes_error", message: "Empty response body from Hermes" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-Hermes-Client": "proxy",
    "X-Hermes-Session-Id": hermesSessionId,
    "X-JLC-Agent-Id": agentId,
  });

  const sessionKey = upstream.headers.get("X-Hermes-Session-Key");
  if (sessionKey) {
    responseHeaders.set("X-Hermes-Session-Key", sessionKey);
  }

  return new Response(upstream.body, { status: 200, headers: responseHeaders });
}

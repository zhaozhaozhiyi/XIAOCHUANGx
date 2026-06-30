import { listApiProviderModels } from "@/lib/byok/server";
import {
  redactSensitiveText,
  toUserFacingProviderError,
  type ApiProviderConfig,
} from "@/lib/byok/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(body: unknown): ApiProviderConfig | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.enabled !== "boolean" ||
    (b.protocol !== "openai" && b.protocol !== "anthropic") ||
    typeof b.baseUrl !== "string" ||
    typeof b.apiKey !== "string" ||
    typeof b.model !== "string" ||
    typeof b.providerLabel !== "string" ||
    typeof b.anthropicVersion !== "string"
  ) {
    return null;
  }
  return {
    enabled: b.enabled,
    protocol: b.protocol,
    baseUrl: b.baseUrl,
    apiKey: b.apiKey,
    model: b.model,
    providerLabel: b.providerLabel,
    anthropicVersion: b.anthropicVersion,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const config = parseBody(body);
  if (!config) {
    return Response.json({ error: "invalid_config" }, { status: 400 });
  }

  try {
    const models = await listApiProviderModels(config);
    return Response.json({ ok: true, models });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: toUserFacingProviderError({
          detail: redactSensitiveText(
            error instanceof Error ? error.message : "models_failed",
          ),
          fallback: "模型拉取失败，请检查 Provider 地址、API Key 与模型权限。",
        }),
      },
      { status: 502 },
    );
  }
}

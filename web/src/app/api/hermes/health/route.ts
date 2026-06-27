import {
  hermesConfig,
  hermesHealthUrl,
} from "@/lib/hermes/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (hermesConfig.useMock) {
    return Response.json({
      ok: true,
      mode: "mock",
      baseUrl: hermesConfig.baseUrl,
      model: hermesConfig.model,
    });
  }

  try {
    const res = await fetch(hermesHealthUrl(), {
      method: "GET",
      headers: hermesConfig.apiKey
        ? { Authorization: `Bearer ${hermesConfig.apiKey}` }
        : {},
      signal: AbortSignal.timeout(5000),
    });

    const text = await res.text().catch(() => "");
    return Response.json({
      ok: res.ok,
      mode: "hermes",
      status: res.status,
      baseUrl: hermesConfig.baseUrl,
      model: hermesConfig.model,
      body: text.slice(0, 200),
    });
  } catch (err) {
    return Response.json({
      ok: false,
      mode: "hermes",
      baseUrl: hermesConfig.baseUrl,
      model: hermesConfig.model,
      error: err instanceof Error ? err.message : "unreachable",
    });
  }
}

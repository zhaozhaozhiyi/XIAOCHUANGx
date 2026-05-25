import {
  chatExecutionMode,
  companionConfig,
  companionRunCancelUrl,
} from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (chatExecutionMode() !== "companion") {
    return Response.json(
      { error: "not_companion", message: "仅 Companion 执行模式支持取消 Run" },
      { status: 400 },
    );
  }

  let runId: string | undefined;
  try {
    const body = (await req.json()) as { runId?: string };
    runId = typeof body.runId === "string" ? body.runId.trim() : undefined;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!runId) {
    return Response.json({ error: "missing_run_id" }, { status: 400 });
  }

  if (companionConfig.useMock) {
    return Response.json({ ok: true, runId, mode: "mock" });
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }

  try {
    const res = await fetch(companionRunCancelUrl(runId), {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };
    if (!res.ok) {
      return Response.json(
        {
          error: payload.error ?? "cancel_failed",
          status: res.status,
        },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    return Response.json({ ok: true, runId });
  } catch (err) {
    return Response.json(
      {
        error: "companion_unreachable",
        message: err instanceof Error ? err.message : "unreachable",
      },
      { status: 502 },
    );
  }
}

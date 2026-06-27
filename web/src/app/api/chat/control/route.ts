import {
  chatExecutionMode,
  companionConfig,
  companionRunControlUrl,
} from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (chatExecutionMode() !== "companion") {
    return Response.json(
      { error: "not_companion", message: "仅 Companion 执行模式支持 Run 控制" },
      { status: 400 },
    );
  }

  let runId: string | undefined;
  let action: string | undefined;
  let text = "";
  let attachments: Array<{ fileId: string }> = [];

  try {
    const body = (await req.json()) as {
      runId?: string;
      action?: string;
      text?: string;
      attachments?: Array<{ fileId: string }>;
    };
    runId = typeof body.runId === "string" ? body.runId.trim() : undefined;
    action = typeof body.action === "string" ? body.action.trim() : undefined;
    text = typeof body.text === "string" ? body.text : "";
    attachments = Array.isArray(body.attachments) ? body.attachments : [];
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!runId) {
    return Response.json({ error: "missing_run_id" }, { status: 400 });
  }
  if (!action) {
    return Response.json({ error: "missing_action" }, { status: 400 });
  }

  if (companionConfig.useMock) {
    if (action === "interrupt") {
      return Response.json({ ok: true, runId, action, mode: "mock" });
    }
    return Response.json(
      { error: "not_implemented", code: `${action}_not_implemented` },
      { status: 501 },
    );
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }

  try {
    const res = await fetch(companionRunControlUrl(runId), {
      method: "POST",
      headers,
      body: JSON.stringify({ action, text, attachments }),
      signal: AbortSignal.timeout(5000),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      code?: string;
      message?: string;
    };
    if (!res.ok) {
      return Response.json(
        {
          error: payload.error ?? "control_failed",
          code: payload.code,
          message: payload.message,
          status: res.status,
        },
        { status: res.status === 404 || res.status === 501 ? res.status : 502 },
      );
    }
    return Response.json({ ok: true, runId, action });
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

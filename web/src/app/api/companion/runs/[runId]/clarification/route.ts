import {
  companionConfig,
  companionRunClarificationUrl,
} from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }

  const upstream = await fetch(companionRunClarificationUrl(runId), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }).catch((err) => {
    const message =
      err instanceof Error ? err.message : "Failed to reach Companion";
    return Response.json(
      { error: "companion_unreachable", message },
      { status: 502 },
    );
  });

  if (upstream instanceof Response && upstream.status === 502) {
    return upstream;
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ?? "application/json",
    },
  });
}

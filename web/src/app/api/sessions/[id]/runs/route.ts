import {
  chatExecutionMode,
  companionConfig,
  companionSessionRunsUrl,
} from "@/lib/companion/config";
import { companionFetch } from "@/lib/companion/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json({
      sessionId: id,
      items: [],
      count: 0,
      source: "unavailable",
    });
  }

  try {
    const res = await companionFetch(companionSessionRunsUrl(id));
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: "companion_error", message: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const json = await res.json();
    return Response.json({ ...json, source: "companion" });
  } catch (err) {
    return Response.json(
      {
        error: "companion_unreachable",
        message: err instanceof Error ? err.message : "unreachable",
        items: [],
      },
      { status: 502 },
    );
  }
}

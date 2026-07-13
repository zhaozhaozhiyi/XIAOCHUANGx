import {
  chatExecutionMode,
  companionConfig,
  companionSessionSimulationRoundsUrl,
} from "@/lib/companion/config";
import { companionFetch } from "@/lib/companion/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json({
      sessionId,
      rounds: [],
      count: 0,
      source: "unavailable",
    });
  }

  try {
    const res = await companionFetch(companionSessionSimulationRoundsUrl(sessionId));
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      return Response.json(
        {
          error: payload.error ?? "companion_error",
          message: payload.message ?? "simulation rounds lookup failed",
        },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    return Response.json({ ...(await res.json()), source: "companion" });
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

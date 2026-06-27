import {
  chatExecutionMode,
  companionConfig,
  companionRunEventsUrl,
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
    return Response.json({ error: "run id required" }, { status: 400 });
  }

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json(
      { error: "runtime_unavailable", message: "companion unavailable" },
      { status: 503 },
    );
  }

  try {
    const res = await companionFetch(companionRunEventsUrl(id));
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      return Response.json(
        {
          error: payload.error ?? "companion_error",
          message: payload.message ?? "run events lookup failed",
        },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    return Response.json(await res.json());
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

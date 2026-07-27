import {
  chatExecutionMode,
  companionConfig,
  companionSessionsUrl,
} from "@/lib/companion/config";
import { companionFetch } from "@/lib/companion/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json({ items: [], count: 0, source: "unavailable" });
  }

  try {
    const response = await companionFetch(companionSessionsUrl());
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return Response.json(
        { error: "companion_error", message: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const body = (await response.json()) as { items?: unknown[]; count?: number };
    return Response.json({ ...body, source: "companion" });
  } catch (error) {
    return Response.json(
      {
        error: "companion_unreachable",
        message: error instanceof Error ? error.message : "unreachable",
        items: [],
      },
      { status: 502 },
    );
  }
}

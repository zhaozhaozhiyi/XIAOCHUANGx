import {
  chatExecutionMode,
  companionConfig,
  companionSessionMessagesUrl,
} from "@/lib/companion/config";
import { companionFetch } from "@/lib/companion/client";
import type { ChatMessage } from "@/lib/chat";

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
      messages: [] as ChatMessage[],
      updatedAt: null,
      source: "unavailable",
    });
  }

  try {
    const res = await companionFetch(companionSessionMessagesUrl(id));
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: "companion_error", message: detail.slice(0, 300) },
        { status: 502 },
      );
    }
    const json = (await res.json()) as {
      sessionId: string;
      messages: ChatMessage[];
      updatedAt: string | null;
      projectId?: string | null;
    };
    return Response.json({ ...json, source: "companion" });
  } catch (err) {
    return Response.json(
      {
        error: "companion_unreachable",
        message: err instanceof Error ? err.message : "unreachable",
        messages: [],
      },
      { status: 502 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id?.trim()) {
    return Response.json({ error: "session id required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  if (chatExecutionMode() !== "companion" || companionConfig.useMock) {
    return Response.json({ sessionId: id, ok: true, source: "skipped" });
  }

  try {
    const res = await companionFetch(companionSessionMessagesUrl(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return Response.json(
        { error: "companion_error", message: detail.slice(0, 300) },
        { status: 502 },
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

import { NextResponse } from "next/server";
import { ensureCompanionDefaultTaskProject } from "@/lib/companion/client";
import { chatExecutionMode } from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (chatExecutionMode() !== "companion") {
    return NextResponse.json(
      { error: "companion_required" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const moduleId = typeof b.moduleId === "string" ? b.moduleId.trim() : "";
  if (!moduleId) {
    return NextResponse.json({ error: "module_id_required" }, { status: 400 });
  }

  const taskTitle =
    typeof b.taskTitle === "string" ? b.taskTitle : undefined;
  const taskId = typeof b.taskId === "string" ? b.taskId : undefined;

  try {
    const project = await ensureCompanionDefaultTaskProject({
      moduleId,
      taskTitle,
      taskId,
    });
    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ensure_default_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

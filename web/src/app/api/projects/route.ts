import { NextResponse } from "next/server";
import { fetchCompanionProjects } from "@/lib/companion/client";
import { chatExecutionMode } from "@/lib/companion/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (chatExecutionMode() !== "companion") {
    return NextResponse.json({ projects: [], ok: true });
  }
  try {
    const { projects } = await fetchCompanionProjects();
    return NextResponse.json({ projects, ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fetch_failed";
    return NextResponse.json({ projects: [], ok: false, error: message });
  }
}

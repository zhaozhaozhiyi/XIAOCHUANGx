import { chatExecutionMode, companionConfig } from "@/lib/companion/config";
import { importCompanionFolder } from "@/lib/companion/client";
import { companionProjectErrorMessage } from "@/lib/companion/project-errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { name?: string; baseDir?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const name = body.name?.trim();
  const baseDir = body.baseDir?.trim();

  if (!baseDir) {
    return Response.json(
      { error: "baseDir_required", message: companionProjectErrorMessage("baseDir_required") },
      { status: 400 },
    );
  }

  if (chatExecutionMode() !== "companion") {
    return Response.json(
      { error: "companion_required", message: "请安装并启动本机 Companion" },
      { status: 503 },
    );
  }

  if (companionConfig.useMock) {
    const id = `proj-custom-${Date.now()}`;
    return Response.json({
      mode: "mock",
      project: {
        projectId: id,
        name: name || "新项目",
        workspaceKind: "local_bound",
        pathSummary: baseDir.startsWith("~/") ? baseDir : `~/${baseDir.replace(/^\//, "")}`,
      },
    });
  }

  try {
    const project = await importCompanionFolder({
      name: name || undefined,
      baseDir,
    });
    return Response.json({ mode: "live", project }, { status: 201 });
  } catch (err) {
    const code = err instanceof Error ? err.message : "import_failed";
    const unreachable =
      code.includes("fetch failed") ||
      code.includes("ECONNREFUSED") ||
      code.includes("TimeoutError") ||
      code.includes("AbortError");
    if (unreachable) {
      return Response.json(
        {
          error: "companion_unreachable",
          message: "无法连接本机 Companion，请先启动 Companion 服务",
        },
        { status: 502 },
      );
    }
    return Response.json(
      { error: code, message: companionProjectErrorMessage(code) },
      { status: 400 },
    );
  }
}

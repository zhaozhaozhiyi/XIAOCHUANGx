import { mkdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  buildDeliverablesFromDiff,
  composeAgentRunPayload,
  runAgent,
  snapshotWorkspace,
} from "@jlc/runtime-core";
import { ensureIndustrialDrawingPreviewFallback } from "../companion/src/runs/industrial-drawing-fallback.ts";

const repoRoot = process.cwd();
const smokeRoot = "/tmp/jlc-3d-real-smoke";
const cwd = join(smokeRoot, `run-${Date.now()}`);

const userText = [
  "直接写文件，不要长篇解释。在工业制图模块中画一个可预览的参数化安装支架：",
  "底板 120x80x8 mm，立板高 90 mm，厚 8 mm，四个 M8 安装孔，两个三角加强筋。",
  "立即创建 `工业制图/2026-06-26-安装支架/` 并真实写入 drawing.scad、drawing.parameters.json、README.md。",
  "不要手工计算 STL 三角面片，不要等待 OpenSCAD；写完三个文件后用一句话结束。",
].join("\n");

async function main(): Promise<void> {
  await rm(cwd, { recursive: true, force: true });
  await mkdir(cwd, { recursive: true });

  const composed = composeAgentRunPayload({
    mode: "fast",
    userText,
    messages: [{ role: "user", content: userText }],
    processSkill: "skill-industrial-drawing-base",
    platformNormSkill: "skill-platform-research-norms",
    contextNotes: [
      "当前模块为 3D / 工业制图，页面结构沿用写作和 PPT 的对话式工作流，但最终能力由工业制图 Skill 与工作区文件承载。",
      "本次 smoke 必须验证真实文件落盘；不要只在聊天正文里给出源码。",
      "这是自动化 smoke，请优先执行写文件，不要长时间推理，不要生成 STL 面片。",
    ],
    cwd,
  });

  const before = await snapshotWorkspace(cwd);
  let assistantText = "";
  const progress: Array<{ tool: string; status?: string; message?: string }> = [];

  const result = await runAgent(
    {
      agentId: "claude",
      agentModel: "default",
      cwd,
      mode: "fast",
      composedPrompt: composed.composedPrompt,
      processSkill: "skill-industrial-drawing-base",
      platformNormSkill: "skill-platform-research-norms",
    },
    {
      onText: (chunk) => {
        assistantText += chunk;
      },
      onNarration: (text) => {
        progress.push({ tool: "narration", message: text });
      },
      onToolProgress: (event) => {
        progress.push({
          tool: event.tool,
          status: event.status,
          message: event.message,
        });
      },
      onError: (message, code) => {
        progress.push({
          tool: "error",
          status: code,
          message,
        });
      },
    },
    {
    timeoutMs: 150_000,
    idleTimeoutMs: 45_000,
    },
  );

  let after = await snapshotWorkspace(cwd);
  const changedPaths = [...after.keys()].filter(
    (path) => !before.has(path) || (after.get(path) ?? 0) > (before.get(path) ?? 0),
  );
  const hasPreview = changedPaths.some((path) => /\.(?:stl|off)$/i.test(path));
  const sourcePaths = changedPaths.filter((path) => /\.scad$/i.test(path));
  const previewFallback =
    !hasPreview && sourcePaths.length > 0
      ? await ensureIndustrialDrawingPreviewFallback({
          cwd,
          cadSourcePaths: sourcePaths,
        })
      : null;
  if (previewFallback) {
    after = await snapshotWorkspace(cwd);
  }
  const deliverables = buildDeliverablesFromDiff(
    before,
    after,
    previewFallback?.relativePaths ?? [],
  );
  const paths = deliverables?.items.map((item) => item.path).sort() ?? [];
  const required = [
    "工业制图",
    "drawing.scad",
    "drawing.parameters.json",
    "README.md",
    "exports/preview.stl",
  ];

  const hasRequired = {
    scad: paths.some((path) => path.endsWith("/drawing.scad")),
    parameters: paths.some((path) => path.endsWith("/drawing.parameters.json")),
    readme: paths.some((path) => path.endsWith("/README.md")),
    previewStl: paths.some((path) => path.endsWith("/exports/preview.stl")),
  };

  let stlFacetCount = 0;
  const stlPath = paths.find((path) => path.endsWith("/exports/preview.stl"));
  if (stlPath) {
    const stl = await readFile(join(cwd, stlPath), "utf8");
    stlFacetCount = (stl.match(/facet normal/g) ?? []).length;
  }

  const ok =
    result.exitCode === 0 &&
    hasRequired.scad &&
    hasRequired.parameters &&
    hasRequired.readme &&
    hasRequired.previewStl &&
    stlFacetCount >= 12;

  console.log(
    JSON.stringify(
      {
        ok,
        repoRoot,
        cwd,
        exitCode: result.exitCode,
        emptyOutput: result.emptyOutput,
        paths,
        previewFallback,
        hasRequired,
        stlFacetCount,
        assistantTail: assistantText.trim().slice(-1000),
        progressTail: progress.slice(-20),
        required,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

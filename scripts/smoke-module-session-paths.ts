import {
  MODULE_CHAT_SURFACES,
  sessionHrefFromNewEntry,
} from "../web/src/lib/module-chat-config.ts";
import { buildCreateRunRequest } from "../web/src/lib/companion/run.ts";
import { NO_PROJECT_ID } from "../web/src/lib/research-projects.ts";
import { parseCreateRun } from "../companion/src/routes/runs.ts";

const cases = [
  ["chat", MODULE_CHAT_SURFACES.chat.newSessionHref, "/chat/123"],
  ["writing", MODULE_CHAT_SURFACES.writing.newSessionHref, "/writing/123"],
  ["ppt", MODULE_CHAT_SURFACES.ppt.newSessionHref, "/ppt/123"],
  ["3d", MODULE_CHAT_SURFACES["3d"].newSessionHref, "/3d/123"],
  ["video", MODULE_CHAT_SURFACES.video.newSessionHref, "/video/123"],
] as const;

async function main() {
  for (const [moduleId, href, expected] of cases) {
    const actual = sessionHrefFromNewEntry(href, "123");
    if (actual !== expected) {
      throw new Error(
        `Unexpected session path for ${moduleId}: expected ${expected}, got ${actual}`,
      );
    }
  }

  const lazyRun = await buildCreateRunRequest({
    sessionId: "3d-lazy-smoke",
    projectId: NO_PROJECT_ID,
    surfaceModuleId: "3d",
    mode: "deep",
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        role: "user",
        content: "画一个可参数化安装支架",
      },
    ],
  });

  if (lazyRun.request.workspaceProjectId !== "__lazy_default__") {
    throw new Error(
      `3D default workspace should be lazy, got ${lazyRun.request.workspaceProjectId}`,
    );
  }
  if (lazyRun.request.lazyDefaultWorkspace?.moduleId !== "3d") {
    throw new Error("3D lazyDefaultWorkspace metadata was not preserved");
  }
  if (lazyRun.ensuredProject) {
    throw new Error(
      "3D lazy run should not ensure a formal project before files exist",
    );
  }

  const parsedLazyRun = parseCreateRun(lazyRun.request);
  if (!parsedLazyRun) {
    throw new Error("Companion failed to parse 3D lazy run request");
  }
  if (parsedLazyRun.workspaceProjectId !== "__lazy_default__") {
    throw new Error(
      `Companion parsed workspaceProjectId incorrectly: ${parsedLazyRun.workspaceProjectId}`,
    );
  }
  if (parsedLazyRun.lazyDefaultWorkspace?.moduleId !== "3d") {
    throw new Error("Companion dropped lazyDefaultWorkspace metadata");
  }

  const videoRun = await buildCreateRunRequest({
    sessionId: "video-lazy-smoke",
    projectId: NO_PROJECT_ID,
    surfaceModuleId: "video",
    mode: "auto",
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        role: "user",
        content: "做一个 60s 小窗产品介绍视频，面向客户高层",
      },
    ],
  });

  if (videoRun.request.processSkill !== "skill-vp-base") {
    throw new Error(
      `Video default process skill should be skill-vp-base, got ${videoRun.request.processSkill}`,
    );
  }
  if (videoRun.request.workspaceProjectId !== "__lazy_default__") {
    throw new Error(
      `Video default workspace should be lazy, got ${videoRun.request.workspaceProjectId}`,
    );
  }
  if (videoRun.request.lazyDefaultWorkspace?.moduleId !== "video") {
    throw new Error("Video lazyDefaultWorkspace metadata was not preserved");
  }
  const parsedVideoRun = parseCreateRun(videoRun.request);
  if (!parsedVideoRun || parsedVideoRun.binding.moduleId !== "video") {
    throw new Error("Companion failed to parse video lazy run request");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        cases,
        lazy3d: {
          workspaceProjectId: lazyRun.request.workspaceProjectId,
          lazyDefaultWorkspace: lazyRun.request.lazyDefaultWorkspace,
          ensuredProject: Boolean(lazyRun.ensuredProject),
          companionParsed: true,
        },
        lazyVideo: {
          workspaceProjectId: videoRun.request.workspaceProjectId,
          lazyDefaultWorkspace: videoRun.request.lazyDefaultWorkspace,
          processSkill: videoRun.request.processSkill,
          companionParsed: true,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

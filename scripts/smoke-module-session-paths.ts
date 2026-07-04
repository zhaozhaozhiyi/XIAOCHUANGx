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
  ["simulation", MODULE_CHAT_SURFACES.simulation.newSessionHref, "/simulation/123"],
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

  const lazyByModule: Record<string, unknown> = {};
  for (const [moduleId] of cases) {
    const run = await buildCreateRunRequest({
      sessionId: `${moduleId}-lazy-smoke`,
      projectId: NO_PROJECT_ID,
      surfaceModuleId: moduleId,
      mode: moduleId === "chat" ? "deep" : "auto",
      agentId: "codex",
      agentModel: "default",
      messages: [
        {
          role: "user",
          content:
            moduleId === "video"
              ? "做一个 60s 小窗产品介绍视频，面向客户高层"
              : `${moduleId} 未选项目默认工作区烟测`,
        },
      ],
    });

    if (run.request.workspaceProjectId !== "__lazy_default__") {
      throw new Error(
        `${moduleId} default workspace should be lazy, got ${run.request.workspaceProjectId}`,
      );
    }
    if (run.request.lazyDefaultWorkspace?.moduleId !== moduleId) {
      throw new Error(
        `${moduleId} lazyDefaultWorkspace metadata was not preserved`,
      );
    }
    if (run.ensuredProject) {
      throw new Error(
        `${moduleId} lazy run should not ensure a formal project before files exist`,
      );
    }
    const parsedRun = parseCreateRun(run.request);
    if (!parsedRun || parsedRun.binding.moduleId !== moduleId) {
      throw new Error(`Companion failed to parse ${moduleId} lazy run request`);
    }
    if (parsedRun.workspaceProjectId !== "__lazy_default__") {
      throw new Error(
        `${moduleId} parsed workspaceProjectId incorrectly: ${parsedRun.workspaceProjectId}`,
      );
    }
    if (parsedRun.lazyDefaultWorkspace?.moduleId !== moduleId) {
      throw new Error(
        `${moduleId} companion dropped lazyDefaultWorkspace metadata`,
      );
    }
    lazyByModule[moduleId] = {
      workspaceProjectId: run.request.workspaceProjectId,
      lazyDefaultWorkspace: run.request.lazyDefaultWorkspace,
      processSkill: run.request.processSkill,
      timeoutProfile: run.request.timeoutProfile,
      companionParsed: true,
    };
  }

  const simulationPathRun = await buildCreateRunRequest({
    sessionId: "simulation-path-binding-smoke",
    projectId: NO_PROJECT_ID,
    surfaceModuleId: "simulation",
    mode: "deep",
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        role: "user",
        content:
          "我选择这条推演路径继续深挖：\n路径 ID：path_risk\n路径名称：风险路径",
      },
    ],
  });
  if (
    simulationPathRun.request.binding.moduleId !== "simulation" ||
    simulationPathRun.request.binding.scope !== "path" ||
    simulationPathRun.request.binding.targetId !== "path_risk"
  ) {
    throw new Error("simulation path intent was not preserved in binding");
  }

  const simulationVariableRun = await buildCreateRunRequest({
    sessionId: "simulation-variable-binding-smoke",
    projectId: NO_PROJECT_ID,
    surfaceModuleId: "simulation",
    mode: "deep",
    agentId: "codex",
    agentModel: "default",
    messages: [
      {
        role: "user",
        content:
          "请基于变量调整生成新一轮推演：\n变量 ID：var_demand\n变量名称：需求恢复速度\n新假设：偏弱",
      },
    ],
  });
  if (
    simulationVariableRun.request.binding.moduleId !== "simulation" ||
    simulationVariableRun.request.binding.scope !== "variable" ||
    simulationVariableRun.request.binding.targetId !== "var_demand" ||
    simulationVariableRun.request.binding.variableOverrides?.var_demand !== "偏弱"
  ) {
    throw new Error("simulation variable intent was not preserved in binding");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        cases,
        lazyByModule,
        simulationBinding: {
          path: simulationPathRun.request.binding,
          variable: simulationVariableRun.request.binding,
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

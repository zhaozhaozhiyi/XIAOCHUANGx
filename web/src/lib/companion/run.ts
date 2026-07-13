import { resolveChatOrchestration } from "@jlc/runtime-core/chat-orchestration";
import {
  type ChatSurfaceModuleId,
  INDUSTRIAL_DRAWING_BASE_SKILL,
  PPT_DEFAULT_SKILL,
  SIMULATION_BASE_SKILL,
  SIMULATION_WORLD_MODEL_SKILL,
  VIDEO_BASE_SKILL,
} from "@/lib/module-chat-config";
import { normalizeChatMode } from "@/lib/navigation";
import { resolveSkills, WRITING_BASE_SKILL } from "@/lib/module-registry";
import {
  chatExecutionMode,
  companionConfig,
  companionRunsUrl,
} from "@/lib/companion/config";
import { uploadCompanionProjectFile } from "@/lib/companion/client";
import { mockCompanionRunSse } from "@/lib/companion/mock";
import type { CreateRunRequest } from "@/lib/companion/types";
import type { ChatCompletionRequestBody } from "@/lib/hermes/types";
import { proxySseStream } from "@/lib/sse-proxy";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import {
  NO_PROJECT_ID,
  resolveWorkspaceProjectId,
  type ResearchProject,
} from "@/lib/research-projects";

export type BuildCreateRunResult = {
  request: CreateRunRequest;
  /** ensure-default-task-project 解析出的项目（含 pathSummary） */
  ensuredProject?: ResearchProject;
};

const LAZY_DEFAULT_WORKSPACE_ID = "__lazy_default__";

type ChatAttachmentForRun = {
  id?: string;
  name?: string;
  path?: string;
  size?: number;
  mimeType?: string;
  type?: string;
  contentBase64?: string;
  [key: string]: unknown;
};

type SimulationBindingPatch = Omit<
  Extract<CreateRunRequest["binding"], { moduleId: "simulation" }>,
  "moduleId"
>;

function isAttachmentForRun(value: unknown): value is ChatAttachmentForRun {
  return !!value && typeof value === "object";
}

function firstLineMatch(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1]?.trim();
}

function inferSimulationBindingPatch(text: string): SimulationBindingPatch {
  const pathId = firstLineMatch(text, /^路径 ID[：:]\s*(.+)$/m);
  if (pathId) {
    return {
      scope: "path",
      targetId: pathId,
    };
  }

  const variableId = firstLineMatch(text, /^变量 ID[：:]\s*(.+)$/m);
  if (variableId) {
    const nextValue = firstLineMatch(text, /^新假设[：:]\s*(.+)$/m);
    return {
      scope: "variable",
      targetId: variableId,
      ...(nextValue
        ? { variableOverrides: { [variableId]: nextValue } }
        : {}),
    };
  }

  if (/反事实|counterfactual/i.test(text)) {
    return {
      scope: "counterfactual",
    };
  }

  return {};
}

async function syncMessageAttachmentsToWorkspace(
  messages: ChatCompletionRequestBody["messages"],
  workspaceProjectId: string,
): Promise<ChatCompletionRequestBody["messages"]> {
  return Promise.all(
    messages.map(async (message, index) => {
      if (index !== messages.length - 1 || message.role !== "user") {
        return message;
      }
      const attachments = Array.isArray(message.attachments)
        ? message.attachments
        : [];
      if (attachments.length === 0) return message;

      const synced = await Promise.all(
        attachments.map(async (attachment) => {
          if (!isAttachmentForRun(attachment)) return attachment;
          const name =
            typeof attachment.name === "string" && attachment.name.trim()
              ? attachment.name
              : undefined;
          const contentBase64 =
            typeof attachment.contentBase64 === "string"
              ? attachment.contentBase64
              : undefined;
          if (!name || !contentBase64) return attachment;

          const uploaded = await uploadCompanionProjectFile({
            projectId: workspaceProjectId,
            name,
            bytes: Buffer.from(contentBase64, "base64"),
          });
          const rest = { ...attachment };
          delete rest.contentBase64;
          return {
            ...rest,
            path: uploaded.path,
            size: uploaded.size,
          };
        }),
      );

      return {
        ...message,
        attachments: synced,
      };
    }),
  );
}

export async function buildCreateRunRequest(
  parsed: ChatCompletionRequestBody & { projectId?: string },
): Promise<BuildCreateRunResult> {
  const uiProjectId = parsed.projectId ?? NO_PROJECT_ID;
  const lastUser = [...parsed.messages].reverse().find((m) => m.role === "user");
  const taskTitle = lastUser?.content.slice(0, 48);
  const surfaceModuleId: ChatSurfaceModuleId =
    parsed.surfaceModuleId === "writing"
      ? "writing"
      : parsed.surfaceModuleId === "ppt"
        ? "ppt"
        : parsed.surfaceModuleId === "3d"
          ? "3d"
          : parsed.surfaceModuleId === "video"
            ? "video"
            : parsed.surfaceModuleId === "simulation"
              ? "simulation"
        : "chat";

  let workspaceProjectId: string;
  let ensuredProject: ResearchProject | undefined;
  let lazyDefaultWorkspace: CreateRunRequest["lazyDefaultWorkspace"] | undefined;
  let effectiveProjectId = uiProjectId;

  if (chatExecutionMode() === "companion") {
    const resolved = await resolveCompanionWorkspaceProjectId(uiProjectId, {
      moduleId: surfaceModuleId,
      taskId: parsed.sessionId,
      taskTitle,
      requiresImmediateWorkspace:
        parsed.messages.some((message) =>
          Array.isArray(message.attachments) && message.attachments.length > 0,
        ),
    });
    workspaceProjectId = resolved.workspaceProjectId;
    if (resolved.ensuredProject) {
      ensuredProject = resolved.ensuredProject;
      effectiveProjectId = resolved.ensuredProject.id;
    }
    lazyDefaultWorkspace = resolved.lazyDefaultWorkspace;
  } else {
    workspaceProjectId = resolveWorkspaceProjectId(uiProjectId);
  }

  const mode = normalizeChatMode(parsed.mode) ?? "auto";
  const orchestration = resolveChatOrchestration({ mode });
  const writingTemplateId =
    surfaceModuleId === "writing"
      ? parsed.writingTemplateId?.trim() || undefined
      : undefined;
  const pptTemplateId =
    surfaceModuleId === "ppt"
      ? parsed.pptTemplateId?.trim() || undefined
      : undefined;
  const videoTemplateId =
    surfaceModuleId === "video"
      ? parsed.videoTemplateId?.trim() || undefined
      : undefined;

  const moduleSkills =
    surfaceModuleId === "writing"
      ? resolveSkills({
          moduleId: "writing",
          binding: { templateId: writingTemplateId },
        })
      : surfaceModuleId === "ppt"
        ? resolveSkills({
            moduleId: "ppt",
            binding: { task: "deck", templateId: pptTemplateId },
          })
        : surfaceModuleId === "3d"
          ? resolveSkills({
              moduleId: "3d",
              binding: {},
            })
          : surfaceModuleId === "video"
            ? resolveSkills({
                moduleId: "video",
                binding: { templateId: videoTemplateId },
              })
            : surfaceModuleId === "simulation"
              ? resolveSkills({
                  moduleId: "simulation",
                  binding: {},
                })
        : null;

  const processSkill =
    surfaceModuleId === "writing"
      ? WRITING_BASE_SKILL
      : surfaceModuleId === "ppt"
        ? PPT_DEFAULT_SKILL
        : surfaceModuleId === "3d"
          ? INDUSTRIAL_DRAWING_BASE_SKILL
          : surfaceModuleId === "video"
            ? (moduleSkills?.processSkill ?? VIDEO_BASE_SKILL)
            : surfaceModuleId === "simulation"
              ? SIMULATION_BASE_SKILL
        : orchestration.baseProcessSkill;
  const platformNormSkill =
    surfaceModuleId === "writing" ||
    surfaceModuleId === "ppt" ||
    surfaceModuleId === "3d" ||
    surfaceModuleId === "video" ||
    surfaceModuleId === "simulation"
      ? (moduleSkills?.platformNormSkill ?? orchestration.platformNormSkill)
      : orchestration.platformNormSkill;
  const supportSkillSlugs =
    surfaceModuleId === "simulation"
      ? (moduleSkills?.supportSkillSlugs.length
          ? moduleSkills.supportSkillSlugs
          : [SIMULATION_WORLD_MODEL_SKILL])
      : moduleSkills?.supportSkillSlugs.length
        ? moduleSkills.supportSkillSlugs
        : undefined;
  const executionMode = chatExecutionMode();
  const timeoutProfile =
    surfaceModuleId === "writing"
      ? "writing"
      : surfaceModuleId === "ppt"
        ? "ppt"
        : surfaceModuleId === "3d"
          ? "default"
          : surfaceModuleId === "video"
            ? "video"
            : surfaceModuleId === "simulation"
              ? "simulation"
        : mode === "deep"
          ? "deep"
          : mode === "fast"
            ? "fast"
            : "default";

  if (
    executionMode === "companion" &&
    workspaceProjectId !== LAZY_DEFAULT_WORKSPACE_ID &&
    (effectiveProjectId === NO_PROJECT_ID || workspaceProjectId === NO_PROJECT_ID)
  ) {
    throw new Error("project_id_unresolved");
  }

  const messages =
    executionMode === "companion" && !companionConfig.useMock
      ? await syncMessageAttachmentsToWorkspace(
          parsed.messages,
          workspaceProjectId,
        )
      : parsed.messages;

  return {
    ensuredProject,
    request: {
      sessionId: parsed.sessionId,
      projectId: effectiveProjectId,
      workspaceProjectId,
      lazyDefaultWorkspace,
      moduleId: surfaceModuleId,
      binding:
        surfaceModuleId === "writing"
          ? {
              moduleId: "writing" as const,
              ...(writingTemplateId ? { templateId: writingTemplateId } : {}),
            }
          : surfaceModuleId === "ppt"
            ? {
                moduleId: "ppt" as const,
                task: "deck" as const,
                ...(pptTemplateId ? { templateId: pptTemplateId } : {}),
              }
            : surfaceModuleId === "3d"
              ? {
                  moduleId: "3d" as const,
                }
              : surfaceModuleId === "video"
                ? {
                    moduleId: "video" as const,
                    ...(videoTemplateId ? { templateId: videoTemplateId } : {}),
                  }
                : surfaceModuleId === "simulation"
                  ? {
                      moduleId: "simulation" as const,
                      ...inferSimulationBindingPatch(lastUser?.content ?? ""),
                    }
            : { moduleId: "chat" as const, mode },
      agentId: parsed.agentId,
      agentModel: parsed.agentModel,
      messages,
      useClientHistory: parsed.useClientHistory,
      processSkill,
      platformNormSkill,
      supportSkillSlugs,
      timeoutProfile,
    },
  };
}

export async function companionRunResponse(
  req: CreateRunRequest,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user");

  if (companionConfig.useMock) {
    const stream = mockCompanionRunSse(req, lastUser?.content ?? "");
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-JLC-Execution": "companion",
        "X-JLC-Execution-Mode": "mock",
        "X-JLC-Agent-Id": req.agentId,
        ...extraHeaders,
      },
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }

  return fetch(companionRunsUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(req),
    signal,
  })
    .then(async (upstream) => {
      if (!upstream.ok) {
        const detail = await upstream.text();
        return Response.json(
          {
            error: "companion_error",
            status: upstream.status,
            message: detail.slice(0, 500) || upstream.statusText,
          },
          { status: 502 },
        );
      }

      const upstreamExecutionMode = upstream.headers.get(
        "X-JLC-Execution-Mode",
      );
      if (
        req.moduleId === "simulation" &&
        (upstreamExecutionMode === "mock" ||
          upstreamExecutionMode === "simulate" ||
          upstreamExecutionMode === "spawn")
      ) {
        await upstream.body?.cancel().catch(() => undefined);
        return Response.json(
          {
            error: "simulation_requires_companion_cli",
            mode: upstreamExecutionMode ?? "unknown",
            message:
              "推演模块需要 Companion 以真实 CLI 模式运行，已拒绝 simulate/spawn/mock 响应。",
          },
          { status: 409 },
        );
      }

      const outHeaders = new Headers(upstream.headers);
      outHeaders.set("X-JLC-Execution", "companion");
      outHeaders.set("X-JLC-Agent-Id", req.agentId);
      for (const [k, v] of Object.entries(extraHeaders ?? {})) {
        outHeaders.set(k, v);
      }

      if (!upstream.body) {
        return Response.json(
          { error: "companion_error", message: "Empty response body from Companion" },
          { status: 502 },
        );
      }

      return new Response(
        proxySseStream(upstream.body, signal ?? new AbortController().signal, "companion_stream_error"),
        {
          status: upstream.status,
          headers: outHeaders,
        },
      );
    })
    .catch((err) => {
      const message =
        err instanceof Error ? err.message : "Failed to reach Companion";
      return Response.json(
        { error: "companion_unreachable", message },
        { status: 502 },
      );
    });
}

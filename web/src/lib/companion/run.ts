import { resolveChatOrchestration } from "@jlc/runtime-core";
import { normalizeChatMode } from "@/lib/navigation";
import {
  chatExecutionMode,
  companionConfig,
  companionRunsUrl,
} from "@/lib/companion/config";
import { uploadCompanionProjectFile } from "@/lib/companion/client";
import { mockCompanionRunSse } from "@/lib/companion/mock";
import type { CreateRunRequest } from "@/lib/companion/types";
import type { ChatCompletionRequestBody } from "@/lib/hermes/types";
import { resolveCompanionWorkspaceProjectId } from "@/lib/research-projects-server";
import { NO_PROJECT_ID, resolveWorkspaceProjectId } from "@/lib/research-projects";

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

function isAttachmentForRun(value: unknown): value is ChatAttachmentForRun {
  return !!value && typeof value === "object";
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
): Promise<CreateRunRequest> {
  const uiProjectId = parsed.projectId ?? NO_PROJECT_ID;
  const workspaceProjectId =
    chatExecutionMode() === "companion" && !companionConfig.useMock
      ? await resolveCompanionWorkspaceProjectId(uiProjectId)
      : resolveWorkspaceProjectId(uiProjectId);
  const mode = normalizeChatMode(parsed.mode) ?? "fast";
  const orchestration = resolveChatOrchestration({ mode });
  const messages =
    chatExecutionMode() === "companion" && !companionConfig.useMock
      ? await syncMessageAttachmentsToWorkspace(
          parsed.messages,
          workspaceProjectId,
        )
      : parsed.messages;

  return {
    sessionId: parsed.sessionId,
    projectId: parsed.projectId ?? NO_PROJECT_ID,
    workspaceProjectId,
    moduleId: "chat",
    binding: { moduleId: "chat", mode },
    agentId: parsed.agentId,
    agentModel: parsed.agentModel,
    messages,
    useClientHistory: parsed.useClientHistory,
    processSkill: orchestration.baseProcessSkill,
    platformNormSkill: orchestration.platformNormSkill,
  };
}

export async function companionRunResponse(
  req: CreateRunRequest,
  signal?: AbortSignal,
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
    .then((upstream) => {
      if (!upstream.ok) {
        return upstream.text().then((detail) =>
          Response.json(
            {
              error: "companion_error",
              status: upstream.status,
              message:
                detail.slice(0, 500) ||
                upstream.statusText ||
                "Companion rejected run",
            },
            { status: 502 },
          ),
        );
      }
      if (!upstream.body) {
        return Response.json(
          { error: "companion_error", message: "Empty body from Companion" },
          { status: 502 },
        );
      }

      const outHeaders = new Headers({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "X-JLC-Execution": "companion",
        "X-JLC-Execution-Mode": "live",
        "X-JLC-Agent-Id": req.agentId,
      });
      const runId = upstream.headers.get("X-JLC-Run-Id");
      if (runId) outHeaders.set("X-JLC-Run-Id", runId);

      return new Response(upstream.body, { status: 200, headers: outHeaders });
    })
    .catch((err) => {
      const message =
        err instanceof Error ? err.message : "Failed to reach Companion";
      return Response.json(
        {
          error: "companion_unreachable",
          message: `${message}. Start the Companion daemon or set COMPANION_USE_MOCK=true with CHAT_EXECUTION=companion.`,
          baseUrl: companionConfig.baseUrl,
        },
        { status: 502 },
      );
    });
}

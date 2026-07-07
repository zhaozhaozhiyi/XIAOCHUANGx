"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatAgentModelPicker } from "./ChatAgentModelPicker";
import { ChatComposer } from "./ChatComposer";
import { ChatHomeTaskSuggestions } from "./ChatHomeTaskSuggestions";
import { TemplateSkillGallery } from "./TemplateSkillGallery";
import { ChatTopBar } from "./ChatTopBar";
import type { ChatComposerSendPayload } from "./ChatComposer";
import { useChatAgentSelection } from "./useChatAgentSelection";
import { setPendingSession } from "@/lib/chat";
import { useSidebarCollapsed } from "@/components/layout/SidebarLayoutContext";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import {
  getResearchProject,
  NO_PROJECT_ID,
} from "@/lib/research-projects";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";
import { uploadChatAttachments } from "@/lib/chat-attachments";
import {
  MODULE_CHAT_SURFACES,
  readStoredModuleSkillTemplateId,
  sessionPath,
  writeStoredModuleSkillTemplateId,
  type ChatSurfaceModuleId,
} from "@/lib/module-chat-config";
import { getChatHomeSuggestions } from "@/lib/chat-home-suggestions";

function createSessionId(): string {
  return String(Date.now());
}

export function ChatHome({
  surfaceModuleId = "chat",
}: {
  surfaceModuleId?: ChatSurfaceModuleId;
}) {
  const surface = MODULE_CHAT_SURFACES[surfaceModuleId];
  const suggestions = getChatHomeSuggestions(surfaceModuleId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sidebarCollapsed = useSidebarCollapsed();
  const { executionSource, agentId, agentModel, selectAgentModel } =
    useChatAgentSelection();
  const [projectId, setProjectId] = useState(() => {
    const fromQuery = searchParams.get("project");
    return fromQuery && getResearchProject(fromQuery)?.kind === "local_bound"
      ? fromQuery
      : NO_PROJECT_ID;
  });
  const [sending, setSending] = useState(false);
  const { setWorkspaceProject } = useWorkspaceProject();

  useEffect(() => {
    const p = getResearchProject(projectId);
    setWorkspaceProject(projectId, p?.name ?? "当前工作文件夹");
  }, [projectId, setWorkspaceProject]);

  const startChat = async (
    text: string,
    mode: ChatModeId,
    executionSource: ChatExecutionSource,
    agentId: AgentId,
    agentModel: string,
    projId: string,
    attachments?: ChatComposerSendPayload["attachments"],
    writingTemplateId?: ChatComposerSendPayload["writingTemplateId"],
    pptTemplateId?: ChatComposerSendPayload["pptTemplateId"],
    videoTemplateId?: ChatComposerSendPayload["videoTemplateId"],
  ) => {
    const trimmed = text.trim();
    if (!trimmed && !attachments?.length) return;
    setSending(true);
    try {
      const id = createSessionId();
      const selectedTemplateId =
        surface.moduleId === "writing"
          ? writingTemplateId
          : surface.moduleId === "ppt"
            ? pptTemplateId
            : surface.moduleId === "video"
              ? videoTemplateId
              : undefined;
      if (surface.skillPicker && selectedTemplateId) {
        writeStoredModuleSkillTemplateId(
          surface.skillPicker,
          selectedTemplateId,
          id,
        );
      }
      const uploadedAttachments = await uploadChatAttachments(
        id,
        attachments,
        projId,
      );
      setPendingSession(id, {
        text: trimmed,
        attachments: uploadedAttachments,
        mode: surfaceModuleId === "chat" ? mode : "deep",
        surfaceModuleId,
        ...(surface.moduleId === "writing" && writingTemplateId
          ? { writingTemplateId }
          : {}),
        ...(surface.moduleId === "ppt" && pptTemplateId ? { pptTemplateId } : {}),
        ...(surface.moduleId === "video" && videoTemplateId
          ? { videoTemplateId }
          : {}),
        executionSource,
        agentId,
        agentModel,
        projectId: projId,
      });
      router.push(sessionPath(surface, id));
    } catch {
      // upload failed — stay on page, user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ChatTopBar
        sidebarCollapsed={sidebarCollapsed}
        left={
          <ChatAgentModelPicker
            executionSource={executionSource}
            agentId={agentId}
            agentModel={agentModel}
            onChange={selectAgentModel}
          />
        }
        center={
          <span className="text-sm text-[var(--fg-secondary)]">
            {surface.newSessionLabel}
          </span>
        }
      />
      <div
        className={`chat-home-bg px-4 sm:px-6 ${
          surface.skillPicker ? "chat-home-bg--with-gallery" : "pb-24"
        }`}
      >
        <div className="chat-home-bg__content">
          <h1 className="text-display mb-3 text-[var(--fg)]">{surface.homeTitle}</h1>
          <p className="prose-width mb-10 text-center text-[15px] text-[var(--fg-secondary)]">
            {surface.homeSubtitle}
          </p>
          <ChatComposer
            showProjectPicker
            showModePicker={false}
            skillPickerModule={surface.skillPicker}
            newSessionHref={surface.newSessionHref}
            defaultMode={surfaceModuleId === "chat" ? "auto" : "deep"}
            disabled={sending}
            projectId={projectId}
            onProjectIdChange={setProjectId}
            executionSource={executionSource}
            agentId={agentId}
            agentModel={agentModel}
            onSend={(payload) =>
              startChat(
                payload.text,
                surfaceModuleId === "chat" ? payload.mode : "deep",
                payload.executionSource,
                payload.agentId,
                payload.agentModel,
                payload.projectId,
                payload.attachments,
                payload.writingTemplateId,
                payload.pptTemplateId,
                payload.videoTemplateId,
              )
            }
          />
          {suggestions ? (
            <ChatHomeTaskSuggestions
              group={suggestions}
              onSelect={(q) => {
                const selectedSkillId = surface.skillPicker
                  ? readStoredModuleSkillTemplateId(surface.skillPicker)
                  : undefined;
                void startChat(
                  q,
                  surfaceModuleId === "chat" ? "auto" : "deep",
                  executionSource,
                  agentId,
                  agentModel,
                  projectId,
                  undefined,
                  surface.moduleId === "writing"
                    ? (selectedSkillId as ChatComposerSendPayload["writingTemplateId"])
                    : undefined,
                  surface.moduleId === "ppt"
                    ? (selectedSkillId as ChatComposerSendPayload["pptTemplateId"])
                    : undefined,
                  surface.moduleId === "video"
                    ? (selectedSkillId as ChatComposerSendPayload["videoTemplateId"])
                    : undefined,
                );
              }}
            />
          ) : null}
        </div>

        {surface.skillPicker ? (
          <div className="chat-home-gallery-band">
            <TemplateSkillGallery module={surface.skillPicker} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

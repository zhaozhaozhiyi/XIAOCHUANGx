"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChatAgentModelPicker } from "./ChatAgentModelPicker";
import { ChatComposer } from "./ChatComposer";
import { ChatHomeTaskSuggestions } from "./ChatHomeTaskSuggestions";
import { ChatTopBar } from "./ChatTopBar";
import { useChatAgentSelection } from "./useChatAgentSelection";
import { setPendingSession } from "@/lib/chat";
import { useSidebarCollapsed } from "@/components/layout/SidebarLayoutContext";
import { useSettings } from "@/components/settings/SettingsContext";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import {
  getResearchProject,
  NO_PROJECT_ID,
} from "@/lib/research-projects";
import type { ChatExecutionSource } from "@/lib/byok/shared";
import type { ChatModeId } from "@/lib/navigation";
import type { AgentId } from "@/lib/settings";

export function ChatHome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sidebarCollapsed = useSidebarCollapsed();
  const { settings } = useSettings();
  const { executionSource, agentId, agentModel, selectAgentModel } =
    useChatAgentSelection();
  const [projectId, setProjectId] = useState(NO_PROJECT_ID);
  const { setWorkspaceProject } = useWorkspaceProject();

  useEffect(() => {
    const p = getResearchProject(projectId);
    setWorkspaceProject(projectId, p?.name ?? "临时工作区");
  }, [projectId, setWorkspaceProject]);

  useEffect(() => {
    const fromQuery = searchParams.get("project");
    if (!fromQuery) return;
    if (getResearchProject(fromQuery)?.kind === "local_bound") {
      setProjectId(fromQuery);
    }
  }, [searchParams]);

  const startChat = (
    text: string,
    mode: ChatModeId,
    executionSource: ChatExecutionSource,
    agentId: AgentId,
    agentModel: string,
    projId: string,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = String(Date.now());
    setPendingSession(id, {
      text: trimmed,
      mode,
      executionSource,
      agentId,
      agentModel,
      projectId: projId,
    });
    router.push(`/chat/${id}`);
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
          <span className="text-sm text-[var(--fg-secondary)]">新对话</span>
        }
      />
      <div className="chat-home-bg px-6 pb-24">
        <div className="chat-home-bg__content">
          <h1 className="text-display mb-3 text-[var(--fg)]">今天要处理什么？</h1>
          <p className="prose-width mb-10 text-center text-[15px] text-[var(--fg-secondary)]">
            查资料、写文档、记会议——小窗专注办公场景（works）
          </p>
          <ChatComposer
            showProjectPicker
            projectId={projectId}
            onProjectIdChange={setProjectId}
            executionSource={executionSource}
            agentId={agentId}
            agentModel={agentModel}
            onSend={(payload) =>
              startChat(
                payload.text,
                payload.mode,
                payload.executionSource,
                payload.agentId,
                payload.agentModel,
                payload.projectId,
              )
            }
          />
          <ChatHomeTaskSuggestions
            onSelect={(q) =>
              startChat(
                q,
                "fast",
                executionSource,
                agentId,
                agentModel,
                projectId,
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

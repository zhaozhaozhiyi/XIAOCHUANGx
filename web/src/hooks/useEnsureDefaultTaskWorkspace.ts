"use client";

import { useCallback, useState } from "react";
import { useWorkspaceProject } from "@/components/workspace/WorkspaceProjectContext";
import { useWorkspaceOptional } from "@/components/workspace/WorkspaceContext";
import { rememberEnsuredResearchProject } from "@/lib/research-projects";
import { workspaceErrorMessage } from "@/lib/workspace-errors";
import type { ModuleId } from "@/lib/module-registry";

type EnsureDefaultTaskWorkspaceInput = {
  moduleId: ModuleId;
  taskTitle?: string;
  taskId?: string;
};

type EnsureDefaultTaskWorkspaceResult = {
  projectId: string;
  name: string;
  pathSummary: string;
  bindingSource?: "user_picked" | "platform_default";
};

export function useEnsureDefaultTaskWorkspace() {
  const { setWorkspaceProject } = useWorkspaceProject();
  const workspace = useWorkspaceOptional();
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureWorkspace = useCallback(
    async (input: EnsureDefaultTaskWorkspaceInput) => {
      setEnsuring(true);
      setError(null);
      try {
        const res = await fetch("/api/projects/ensure-default-task-project", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const json = (await res.json()) as
          | EnsureDefaultTaskWorkspaceResult
          | { error?: string };
        if (!res.ok) {
          const code =
            "error" in json && typeof json.error === "string"
              ? json.error
              : `ensure_default_http_${res.status}`;
          throw new Error(code);
        }
        const project = json as EnsureDefaultTaskWorkspaceResult;
        rememberEnsuredResearchProject({
          id: project.projectId,
          kind: "local_bound",
          name: project.name,
          pathSummary: project.pathSummary,
          bindingSource: project.bindingSource ?? "platform_default",
        });
        setWorkspaceProject(project.projectId, project.pathSummary);
        workspace?.refreshTree();
        return project;
      } catch (err) {
        const message = workspaceErrorMessage(
          err instanceof Error ? err.message : "ensure_default_failed",
        );
        setError(message ?? "工作区创建失败");
        return null;
      } finally {
        setEnsuring(false);
      }
    },
    [setWorkspaceProject, workspace],
  );

  return {
    ensuring,
    error,
    ensureWorkspace,
    clearEnsureError: () => setError(null),
  };
}

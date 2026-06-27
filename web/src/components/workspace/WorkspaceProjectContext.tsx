"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getResearchProject,
  isUsingLocalProject,
  NO_PROJECT_ID,
  resolveWorkspaceProjectId,
} from "@/lib/research-projects";
import { RESEARCH_PROJECTS_UPDATED } from "@/lib/research-projects-events";

type WorkspaceProjectContextValue = {
  workspaceProjectId: string;
  projectLabel: string;
  setWorkspaceProject: (projectId: string, label?: string) => void;
};

const WorkspaceProjectContext =
  createContext<WorkspaceProjectContextValue | null>(null);

export function WorkspaceProjectProvider({ children }: { children: ReactNode }) {
  const [workspaceProjectId, setWorkspaceProjectId] = useState(NO_PROJECT_ID);
  const [projectLabel, setProjectLabel] = useState("当前工作文件夹");

  const resolveDisplayName = useCallback(
    (projectId: string, fallback?: string) => {
      const mock = getResearchProject(projectId);
      return (
        fallback ??
        (mock?.bindingSource === "platform_default"
          ? mock.pathSummary
          : mock?.name) ??
        projectId
      );
    },
    [],
  );

  const setWorkspaceProject = useCallback(
    (projectId: string, label?: string) => {
      if (projectId === NO_PROJECT_ID) {
        setWorkspaceProjectId(NO_PROJECT_ID);
        setProjectLabel(label ?? "当前工作文件夹");
        return;
      }

      const wsId =
        isUsingLocalProject(projectId) ?
          projectId
        : resolveWorkspaceProjectId(projectId);
      const displayName = resolveDisplayName(projectId, label ?? wsId);
      const apply = (name: string) => {
        setWorkspaceProjectId(wsId);
        setProjectLabel(name);
      };

      if (isUsingLocalProject(projectId)) {
        void fetch("/api/projects/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        })
          .then(() => apply(displayName))
          .catch(() => apply(displayName));
        return;
      }

      apply(displayName);
    },
    [resolveDisplayName],
  );

  useEffect(() => {
    const updateLabel = () => {
      if (workspaceProjectId === NO_PROJECT_ID) return;
      setProjectLabel((prev) => {
        const next = resolveDisplayName(workspaceProjectId, prev);
        return next === prev ? prev : next;
      });
    };
    window.addEventListener(RESEARCH_PROJECTS_UPDATED, updateLabel);
    return () => window.removeEventListener(RESEARCH_PROJECTS_UPDATED, updateLabel);
  }, [workspaceProjectId, resolveDisplayName]);

  const value = useMemo(
    () => ({
      workspaceProjectId,
      projectLabel,
      setWorkspaceProject,
    }),
    [workspaceProjectId, projectLabel, setWorkspaceProject],
  );

  return (
    <WorkspaceProjectContext.Provider value={value}>
      {children}
    </WorkspaceProjectContext.Provider>
  );
}

export function useWorkspaceProject(): WorkspaceProjectContextValue {
  const ctx = useContext(WorkspaceProjectContext);
  if (!ctx) {
    throw new Error(
      "useWorkspaceProject must be used within WorkspaceProjectProvider",
    );
  }
  return ctx;
}

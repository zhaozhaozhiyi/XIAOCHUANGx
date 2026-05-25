"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getResearchProject,
  isUsingLocalProject,
  NO_PROJECT_ID,
  resolveWorkspaceProjectId,
  SANDBOX_PROJECT_ID,
} from "@/lib/research-projects";

type WorkspaceProjectContextValue = {
  workspaceProjectId: string;
  projectLabel: string;
  setWorkspaceProject: (projectId: string, label?: string) => void;
};

const WorkspaceProjectContext =
  createContext<WorkspaceProjectContextValue | null>(null);

export function WorkspaceProjectProvider({ children }: { children: ReactNode }) {
  const [workspaceProjectId, setWorkspaceProjectId] = useState(
    SANDBOX_PROJECT_ID,
  );
  const [projectLabel, setProjectLabel] = useState("临时工作区");

  const setWorkspaceProject = useCallback(
    (projectId: string, label?: string) => {
      const wsId = resolveWorkspaceProjectId(projectId);
      const apply = (name: string) => {
        setWorkspaceProjectId(wsId);
        setProjectLabel(name);
      };

      if (projectId === NO_PROJECT_ID) {
        apply(label ?? "临时工作区");
        return;
      }

      const mock = getResearchProject(projectId);
      const displayName = label ?? mock?.name ?? wsId;

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
    [],
  );

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

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
  MOCK_RESEARCH_PROJECTS,
  isResearchProjectHidden,
  type ResearchProject,
} from "@/lib/research-projects";
import { RESEARCH_PROJECTS_UPDATED } from "@/lib/research-projects-events";
import { setCachedCompanionLocalBoundProjects } from "@/lib/research-projects-cache";

type ApiProject = {
  projectId: string;
  name: string;
  workspaceKind: string;
  pathSummary: string;
  bindingSource?: "user_picked" | "platform_default";
};

type ResearchProjectsContextValue = {
  localBoundProjects: ResearchProject[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  getProject: (id: string) => ResearchProject | undefined;
};

const ResearchProjectsContext =
  createContext<ResearchProjectsContextValue | null>(null);

function readCustomProjects(): ResearchProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("jlc-custom-research-projects");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ResearchProject =>
        !!p &&
        typeof p === "object" &&
        typeof (p as ResearchProject).id === "string" &&
        (p as ResearchProject).kind === "local_bound" &&
        typeof (p as ResearchProject).name === "string" &&
        typeof (p as ResearchProject).pathSummary === "string",
    );
  } catch {
    return [];
  }
}

function mapApiProject(p: ApiProject): ResearchProject | null {
  if (p.workspaceKind !== "local_bound") return null;
  return {
    id: p.projectId,
    kind: "local_bound",
    name: p.name,
    pathSummary: p.pathSummary,
    bindingSource: p.bindingSource ?? "user_picked",
  };
}

function mergeLocalBound(
  fromApi: ResearchProject[],
  custom: ResearchProject[],
): ResearchProject[] {
  const seen = new Set<string>();
  const merged: ResearchProject[] = [];
  for (const p of [...custom, ...fromApi]) {
    if (isResearchProjectHidden(p.id)) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return merged;
}

export function ResearchProjectsProvider({ children }: { children: ReactNode }) {
  const [localBoundProjects, setLocalBoundProjects] = useState<ResearchProject[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const custom = readCustomProjects();
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = (await res.json()) as {
        projects?: ApiProject[];
        error?: string;
        ok?: boolean;
      };
      if (!res.ok && !data.projects?.length) {
        setError(data.error ?? `projects_${res.status}`);
        setLocalBoundProjects(mergeLocalBound([], custom));
        return;
      }
      const fromApi = (data.projects ?? [])
        .map(mapApiProject)
        .filter((p): p is ResearchProject => p != null);
      const merged = mergeLocalBound(fromApi, custom);
      setError(null);
      setLocalBoundProjects(merged);
      setCachedCompanionLocalBoundProjects(fromApi);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch_failed");
      const merged = mergeLocalBound([], custom);
      setLocalBoundProjects(merged);
      setCachedCompanionLocalBoundProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener(RESEARCH_PROJECTS_UPDATED, onUpdate);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(RESEARCH_PROJECTS_UPDATED, onUpdate);
    };
  }, [refresh]);

  const getProject = useCallback(
    (id: string): ResearchProject | undefined => {
      return (
        localBoundProjects.find((p) => p.id === id) ??
        readCustomProjects().find(
          (p) => p.id === id && !isResearchProjectHidden(p.id),
        ) ??
        MOCK_RESEARCH_PROJECTS.find(
          (p) => p.id === id && !isResearchProjectHidden(p.id),
        )
      );
    },
    [localBoundProjects],
  );

  const value = useMemo(
    () => ({
      localBoundProjects,
      loading,
      error,
      refresh,
      getProject,
    }),
    [localBoundProjects, loading, error, refresh, getProject],
  );

  return (
    <ResearchProjectsContext.Provider value={value}>
      {children}
    </ResearchProjectsContext.Provider>
  );
}

export function useResearchProjects(): ResearchProjectsContextValue {
  const ctx = useContext(ResearchProjectsContext);
  if (!ctx) {
    throw new Error("useResearchProjects must be used within ResearchProjectsProvider");
  }
  return ctx;
}

/** 可选：Provider 未挂载时回退同步 MOCK（测试/Storybook） */
export function useResearchProjectsOptional(): ResearchProjectsContextValue | null {
  return useContext(ResearchProjectsContext);
}

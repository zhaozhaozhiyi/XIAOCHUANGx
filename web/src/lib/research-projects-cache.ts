import type { ResearchProject } from "@/lib/research-projects";

/** Companion `/api/projects` 同步缓存，供 `getResearchProject` 客户端解析 */
let cachedLocalBoundFromCompanion: ResearchProject[] = [];

export function setCachedCompanionLocalBoundProjects(
  projects: ResearchProject[],
): void {
  cachedLocalBoundFromCompanion = projects;
}

export function getCachedCompanionLocalBoundProjects(): ResearchProject[] {
  return cachedLocalBoundFromCompanion;
}

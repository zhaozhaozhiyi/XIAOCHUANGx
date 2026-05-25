import type { ResearchProject } from "@/lib/research-projects";
import { addCustomResearchProject } from "@/lib/research-projects";
import { companionProjectErrorMessage } from "@/lib/companion/project-errors";

export async function createLocalBoundProject(input: {
  name: string;
  baseDir: string;
}): Promise<ResearchProject> {
  const res = await fetch("/api/projects/import-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim() || undefined,
      baseDir: input.baseDir.trim(),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    project?: {
      projectId: string;
      name: string;
      workspaceKind: string;
      pathSummary: string;
    };
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(
      json.message ??
        companionProjectErrorMessage(json.error ?? "") ??
        `import_failed_${res.status}`,
    );
  }

  const created = json.project;
  if (!created?.projectId) {
    throw new Error("invalid_import_response");
  }

  const project: ResearchProject = {
    id: created.projectId,
    kind: "local_bound",
    name: created.name,
    pathSummary: created.pathSummary,
  };

  addCustomResearchProject(project);
  return project;
}

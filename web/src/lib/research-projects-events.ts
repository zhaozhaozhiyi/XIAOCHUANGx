/** 研究项目列表变更（Companion 拉取 / 用户 import-folder 后刷新） */

export const RESEARCH_PROJECTS_UPDATED = "jlc-research-projects-updated";

export function notifyResearchProjectsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESEARCH_PROJECTS_UPDATED));
}

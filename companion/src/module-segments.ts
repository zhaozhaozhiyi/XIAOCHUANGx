/**
 * XIAOCHUANG 模块目录名 — 须与 web/src/lib/module-registry.ts workspaceSegment 保持一致。
 */
export const MODULE_WORKSPACE_SEGMENTS: Record<string, string> = {
  chat: "会话",
  meeting: "会议",
  writing: "写作",
  ppt: "PPT",
};

export const MODULE_DEFAULT_TASK_NAMES: Record<string, string> = {
  chat: "新对话",
  meeting: "新会议",
  writing: "新写作",
  ppt: "新演示",
};

export function resolveModuleWorkspaceSegment(moduleId: string): string | null {
  return MODULE_WORKSPACE_SEGMENTS[moduleId] ?? null;
}

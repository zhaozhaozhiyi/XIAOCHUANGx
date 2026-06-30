/**
 * XIAOCHUANG 模块目录名 — 须与 web/src/lib/module-registry.ts workspaceSegment 保持一致。
 */
export const MODULE_WORKSPACE_SEGMENTS: Record<string, string> = {
  chat: "会话",
  writing: "写作",
  ppt: "PPT",
  "3d": "工业制图",
  video: "视频",
  simulation: "推演",
};

export const MODULE_DEFAULT_TASK_NAMES: Record<string, string> = {
  chat: "新对话",
  writing: "新写作",
  ppt: "新演示",
  "3d": "新 3D 图纸",
  video: "新视频",
  simulation: "新推演",
};

export function resolveModuleWorkspaceSegment(moduleId: string): string | null {
  return MODULE_WORKSPACE_SEGMENTS[moduleId] ?? null;
}

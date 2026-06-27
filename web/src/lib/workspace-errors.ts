const WORKSPACE_ERROR_MAP: Record<string, string> = {
  module_id_required_for_default_workspace:
    "工作区尚未创建，请先发送第一条消息",
  workspace_not_ready: "工作区尚未创建，请先发送第一条消息",
  baseDir_not_accessible: "工作文件夹不存在或不可访问",
  baseDir_required: "请选择工作文件夹",
  project_not_found: "未找到对应的工作区",
};

export function workspaceErrorMessage(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return WORKSPACE_ERROR_MAP[trimmed] ?? trimmed;
}

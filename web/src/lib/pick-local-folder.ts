/** Web 手填本地目录路径（PRD v2.8：禁止 showDirectoryPicker 主路径） */

export type LocalFolderPick = {
  name: string;
  baseDir: string;
};

function folderNameFromPath(baseDir: string): string {
  const trimmed = baseDir.trim().replace(/\/+$/, "");
  const parts = trimmed.split(/[/\\]/).filter(Boolean);
  return parts[parts.length - 1] ?? "新项目";
}

export function buildLocalFolderPick(
  folderName: string,
  baseDir: string,
): LocalFolderPick | null {
  const dir = baseDir.trim();
  if (!dir) return null;
  const name = folderName.trim() || folderNameFromPath(dir);
  return { name, baseDir: dir };
}

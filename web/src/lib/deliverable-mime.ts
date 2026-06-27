export function deliverableTypeLabel(path: string, mime?: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/")) return `图像 · ${ext.toUpperCase() || "IMG"}`;
  if (mime?.includes("presentation") || ext === "pptx" || ext === "ppt") {
    return "幻灯片 · PPTX";
  }
  if (mime?.includes("markdown") || ext === "md") return "文档 · Markdown";
  if (ext === "pdf") return "文档 · PDF";
  if (ext === "png" || ext === "jpg" || ext === "jpeg") {
    return `图像 · ${ext.toUpperCase()}`;
  }
  if (ext) return `文件 · ${ext.toUpperCase()}`;
  return "文件";
}

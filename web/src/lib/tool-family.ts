import type { ToolBatchItem } from "@/lib/chat-parts";

export type ToolFamily =
  | "read"
  | "search"
  | "query"
  | "explore"
  | "command"
  | "write"
  | "other";

export function classifyToolFamily(tool: string): ToolFamily {
  const t = tool.toLowerCase();
  if (
    t === "read_file" ||
    t === "read" ||
    t === "file_read" ||
    t.includes("read")
  ) {
    return "read";
  }
  if (
    t === "write_file" ||
    t === "write" ||
    t === "edit_file" ||
    t === "file_edit" ||
    t.includes("write") ||
    t.includes("edit")
  ) {
    return "write";
  }
  if (
    t === "grep" ||
    t === "search" ||
    t === "web_search" ||
    t === "web_extract" ||
    t === "glob"
  ) {
    return "search";
  }
  if (t === "choice_query" || t === "mcp") return "query";
  if (t === "list_dir" || t === "ls" || t === "list") return "explore";
  if (
    t === "bash" ||
    t === "run_terminal" ||
    t === "command" ||
    t === "command_execution"
  ) {
    return "command";
  }
  return "other";
}

const FAMILY_ORDER: ToolFamily[] = [
  "read",
  "search",
  "query",
  "explore",
  "command",
  "write",
  "other",
];

const FAMILY_LABEL: Record<ToolFamily, (n: number) => string> = {
  read: (n) => `读取 ${n} 个文件`,
  search: (n) => `搜索 ${n} 次`,
  query: (n) => `检索 ${n} 次`,
  explore: (n) => `探索 ${n} 项`,
  command: (n) => `运行 ${n} 条命令`,
  write: (n) => `写入 ${n} 个文件`,
  other: (n) => `${n} 项工具`,
};

function countFamilies(items: ToolBatchItem[]): Record<ToolFamily, number> {
  const counts: Partial<Record<ToolFamily, number>> = {};
  for (const item of items) {
    const fam = classifyToolFamily(item.tool);
    counts[fam] = (counts[fam] ?? 0) + 1;
  }
  return counts as Record<ToolFamily, number>;
}

/** 工具卡标题（单卡 live 展示） */
export function toolDisplayName(tool: string): string {
  const fam = classifyToolFamily(tool);
  switch (fam) {
    case "search":
      return "搜索";
    case "read":
      return "读取文件";
    case "command":
      return "终端命令";
    case "write":
      return "写入文件";
    case "explore":
      return "浏览目录";
    case "query":
      return "检索";
    default:
      return tool;
  }
}

/** 人话探索摘要（对齐 Cursor Explored / Open Design tool-group） */
export function buildExploreSummaryTitle(items: ToolBatchItem[]): string {
  if (items.length === 0) return "执行中…";

  if (items.length === 1) {
    const item = items[0]!;
    const fam = classifyToolFamily(item.tool);
    if (fam === "read" && item.message) {
      const path = item.message.split(/\s/)[0]?.slice(0, 80);
      return path ? `读取 ${path}` : "读取 1 个文件";
    }
  }

  const counts = countFamilies(items);
  const segments: string[] = [];
  for (const fam of FAMILY_ORDER) {
    const n = counts[fam];
    if (n && n > 0) segments.push(FAMILY_LABEL[fam](n));
  }
  if (segments.length === 0) return `已执行 ${items.length} 步`;
  return `已${segments.join(" · ")}`;
}

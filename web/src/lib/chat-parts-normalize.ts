import type { ChatPart, ToolBatchItem, ToolPart } from "@/lib/chat-parts";
import { newPartId } from "@/lib/chat-parts-utils";
import { buildExploreSummaryTitle } from "@/lib/tool-family";

const BATCHABLE_TOOLS = new Set([
  "choice_query",
  "grep",
  "search",
  "web_extract",
  "web_search",
  "mcp",
  "todo",
  "Bash",
  "bash",
  "run_terminal",
  "list_dir",
]);

function isBatchableTool(tool: string): boolean {
  return (
    BATCHABLE_TOOLS.has(tool) ||
    tool === "phase" ||
    (!tool.includes("file") && tool !== "read_file" && tool !== "write_file")
  );
}

function batchTitle(items: ToolBatchItem[]): string {
  return buildExploreSummaryTitle(items);
}

function flushToolBatch(buffer: ToolPart[]): ChatPart | null {
  if (buffer.length === 0) return null;
  const items: ToolBatchItem[] = buffer.map((t) => ({
    tool: t.tool,
    status: t.status,
    message: t.message,
  }));
  const streaming = buffer.some((t) => t.streaming);
  const streamSeq = buffer.reduce<number | undefined>((min, t) => {
    const s = t.streamSeq;
    if (s == null) return min;
    return min == null ? s : Math.min(min, s);
  }, undefined);
  return {
    id: buffer[0]!.id.startsWith("tool-")
      ? `batch-${buffer[0]!.id}`
      : newPartId("batch"),
    zone: "activity",
    kind: "tool_batch",
    title: batchTitle(items),
    items,
    streamSeq,
    streaming,
    completedAt: streaming ? undefined : Date.now(),
  };
}

/** 将连续的单条 tool 合并为 tool_batch，保持时间序 */
export function compactToolParts(parts: ChatPart[]): ChatPart[] {
  const out: ChatPart[] = [];
  let buffer: ToolPart[] = [];

  const flush = () => {
    const batch = flushToolBatch(buffer);
    if (batch) out.push(batch);
    buffer = [];
  };

  for (const p of parts) {
    if (p.kind === "tool" && isBatchableTool(p.tool)) {
      buffer.push(p);
      continue;
    }
    flush();
    out.push(p);
  }
  flush();
  return out;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min}m ${rem}s` : `${min}m`;
}

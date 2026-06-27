import type { SimulatedActivityEvent } from "@jlc/runtime-core/simulated-activity";
import type { ChatPart } from "@/lib/chat-parts";

function newPartId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 将节奏化活动事件编码为 Hermes/OpenAI 兼容的 SSE 行 */
export function encodeMockActivitySse(
  encoder: TextEncoder,
  ev: SimulatedActivityEvent,
  format: "hermes" | "companion",
): Uint8Array[] {
  const lines: Uint8Array[] = [];
  const toolEvent =
    format === "companion" ? "tool.progress" : "hermes.tool.progress";

  const push = (event: string, data: unknown) => {
    lines.push(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
    );
  };

  if (ev.type === "status") {
    push(toolEvent, {
      tool: "phase",
      status: "running",
      message: ev.label,
    });
    return lines;
  }
  if (ev.type === "tool") {
    push(toolEvent, {
      tool: ev.tool,
      status: ev.status ?? "running",
      message: ev.message,
    });
    push(toolEvent, {
      tool: ev.tool,
      status: "success",
      message: ev.message,
    });
    return lines;
  }
  if (ev.type === "reasoning") {
    push(toolEvent, {
      tool: "reasoning",
      status: "running",
      message: ev.markdown.slice(0, 120),
    });
    return lines;
  }
  if (ev.type === "todo") {
    push("todo.update", { items: ev.items });
    return lines;
  }
  if (ev.type === "file_read") {
    const part: ChatPart = {
      id: newPartId("file_read"),
      zone: "activity",
      kind: "file_read",
      path: ev.path,
      completedAt: Date.now(),
    };
    push("part.append", { part });
    return lines;
  }
  if (ev.type === "file_edit") {
    const part: ChatPart = {
      id: newPartId("file_edit"),
      zone: "activity",
      kind: "file_edit",
      path: ev.path,
      additions: ev.additions ?? 0,
      deletions: ev.deletions ?? 0,
      completedAt: Date.now(),
    };
    push("part.append", { part });
    return lines;
  }
  if (ev.type === "command") {
    push(toolEvent, {
      tool: "Bash",
      status: ev.status ?? "running",
      message: ev.command,
    });
    push(toolEvent, {
      tool: "Bash",
      status: "success",
      message: ev.command,
    });
    return lines;
  }
  if (ev.type === "interim") {
    push("interim_assistant", {
      text: ev.text,
      already_streamed: ev.alreadyStreamed ?? false,
    });
  }
  return lines;
}

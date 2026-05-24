import type { AgentId, ChatModeId } from "@jlc/runtime-core";
import {
  getSimulatedActivityEvents,
  getSimulatedDeliverables,
  type SimulatedActivityEvent,
} from "@jlc/runtime-core";
import { emitDeliverablesPart } from "./emit-deliverables.js";
import type { SseWriter } from "./sse.js";
import { sleep } from "./sse.js";

function newPartId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function emitActivityEvent(
  writer: SseWriter,
  ev: SimulatedActivityEvent,
): Promise<void> {
  if (ev.type === "status") {
    writer.send("tool.progress", {
      tool: "phase",
      status: "running",
      message: ev.label,
    });
    return;
  }
  if (ev.type === "tool") {
    writer.send("tool.progress", {
      tool: ev.tool,
      status: ev.status ?? "running",
      message: ev.message,
    });
    await sleep(100);
    writer.send("tool.progress", {
      tool: ev.tool,
      status: "success",
      message: ev.message,
    });
    return;
  }
  if (ev.type === "reasoning") {
    writer.send("tool.progress", {
      tool: "reasoning",
      status: "running",
      message: ev.markdown.slice(0, 160),
    });
    await sleep(60);
    writer.send("tool.progress", {
      tool: "reasoning",
      status: "success",
      message: ev.markdown.slice(0, 160),
    });
    return;
  }
  if (ev.type === "todo") {
    writer.send("todo.update", { items: ev.items });
    return;
  }
  if (ev.type === "file_read") {
    writer.send("part.append", {
      part: {
        id: newPartId("file_read"),
        zone: "activity",
        kind: "file_read",
        path: ev.path,
        completedAt: Date.now(),
      },
    });
    return;
  }
  if (ev.type === "file_edit") {
    writer.send("part.append", {
      part: {
        id: newPartId("file_edit"),
        zone: "activity",
        kind: "file_edit",
        path: ev.path,
        additions: ev.additions ?? 0,
        deletions: ev.deletions ?? 0,
        completedAt: Date.now(),
      },
    });
    return;
  }
  if (ev.type === "command") {
    writer.send("tool.progress", {
      tool: "Bash",
      status: ev.status ?? "running",
      message: ev.command,
    });
    await sleep(120);
    writer.send("tool.progress", {
      tool: "Bash",
      status: "success",
      message: ev.command,
    });
    return;
  }
  if (ev.type === "interim") {
    writer.send("interim_assistant", {
      text: ev.text,
      already_streamed: ev.alreadyStreamed ?? false,
    });
  }
}

/** 在 message.delta 之前播放节奏化过程（与 Web mock SSE 对齐） */
export async function streamSimulatedActivity(
  writer: SseWriter,
  mode: ChatModeId,
  userText: string,
  abort: AbortController,
  agentId?: AgentId,
): Promise<void> {
  const events = getSimulatedActivityEvents(mode, userText, agentId);
  for (const ev of events) {
    if (abort.signal.aborted) return;
    await emitActivityEvent(writer, ev);
    await sleep(70);
  }

  const deliverables = getSimulatedDeliverables(mode, userText);
  if (deliverables && !abort.signal.aborted) {
    emitDeliverablesPart(writer, deliverables);
  }
}

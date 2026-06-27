import { executeBackgroundRun, isSessionRunning } from "./manager.js";
import {
  dequeueSessionRunControl,
  peekSessionRunQueue,
  type QueuedRunControl,
} from "./queue.js";

const drainingSessions = new Set<string>();

async function runQueuedItem(item: QueuedRunControl): Promise<void> {
  const nextRequest = {
    ...item.request,
    messages: [...item.request.messages],
  };
  await executeBackgroundRun(nextRequest, { runId: item.runId });
}

export async function drainSessionQueue(sessionId: string): Promise<void> {
  if (!sessionId || drainingSessions.has(sessionId)) return;
  if (isSessionRunning(sessionId)) return;

  drainingSessions.add(sessionId);
  try {
    while (!isSessionRunning(sessionId)) {
      const next = await dequeueSessionRunControl(sessionId);
      if (!next) return;
      await runQueuedItem(next);
      if (isSessionRunning(sessionId)) return;
    }
  } finally {
    drainingSessions.delete(sessionId);
  }
}

export function scheduleSessionQueueDrain(sessionId: string): void {
  if (!sessionId) return;
  queueMicrotask(() => {
    void drainSessionQueue(sessionId);
  });
}

export async function getSessionQueueState(sessionId: string): Promise<{
  items: QueuedRunControl[];
  count: number;
  running: boolean;
}> {
  const items = await peekSessionRunQueue(sessionId);
  return {
    items,
    count: items.length,
    running: isSessionRunning(sessionId),
  };
}

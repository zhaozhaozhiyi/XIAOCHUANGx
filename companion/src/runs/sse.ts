import type { ServerResponse } from "node:http";

export type RunEventWriter = {
  send: (event: string, data: unknown) => void;
  end: () => void;
  flush?: () => Promise<void>;
};

export type SseWriter = RunEventWriter;

export function createSseWriter(
  res: ServerResponse,
  extraHeaders?: Record<string, string>,
): SseWriter {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "X-JLC-Api-Version": "v1",
    ...extraHeaders,
  });

  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      res.end();
    },
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createNoopWriter(): RunEventWriter {
  return {
    send() {},
    end() {},
  };
}

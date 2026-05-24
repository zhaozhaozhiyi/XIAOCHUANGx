import type { SimulatedDeliverablesPayload } from "@jlc/runtime-core";
import type { SseWriter } from "./sse.js";

export function emitDeliverablesPart(
  writer: SseWriter,
  payload: SimulatedDeliverablesPayload,
): void {
  writer.send("part.append", {
    part: {
      id: `deliverables-${Date.now()}`,
      zone: "summary",
      kind: "deliverables",
      headline: payload.headline,
      primaryPath: payload.primaryPath,
      items: payload.items,
      completedAt: Date.now(),
    },
  });
}

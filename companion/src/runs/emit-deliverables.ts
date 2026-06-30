import type { SimulatedDeliverablesPayload } from "@jlc/runtime-core";
import type { SseWriter } from "./sse.js";

export function emitDeliverablesPart(
  writer: SseWriter,
  payload: SimulatedDeliverablesPayload,
  workspaceProjectId?: string,
): void {
  const resolvedWorkspaceProjectId = workspaceProjectId ?? payload.workspaceProjectId;
  writer.send("part.append", {
    part: {
      id: `deliverables-${Date.now()}`,
      zone: "summary",
      kind: "deliverables",
      headline: payload.headline,
      primaryPath: payload.primaryPath,
      ...(resolvedWorkspaceProjectId
        ? { workspaceProjectId: resolvedWorkspaceProjectId }
        : {}),
      items: payload.items.map((item) => ({
        ...item,
        ...(item.workspaceProjectId || !resolvedWorkspaceProjectId
          ? {}
          : { workspaceProjectId: resolvedWorkspaceProjectId }),
      })),
      completedAt: Date.now(),
    },
  });
}

import { getSimulatedDeliverables } from "@jlc/runtime-core/simulated-deliverables";
import type { ChatPart } from "@/lib/chat-parts";
import type { ChatModeId } from "@/lib/navigation";
import { newPartId } from "@/lib/chat-parts-utils";

export function buildDeliverablesPart(
  mode: ChatModeId,
  userText: string,
  streamSeq?: number,
): ChatPart | null {
  const payload = getSimulatedDeliverables(mode, userText);
  if (!payload) return null;
  return {
    id: newPartId("deliverables"),
    zone: "summary",
    kind: "deliverables",
    headline: payload.headline,
    primaryPath: payload.primaryPath,
    items: payload.items,
    streamSeq,
    completedAt: Date.now(),
  };
}

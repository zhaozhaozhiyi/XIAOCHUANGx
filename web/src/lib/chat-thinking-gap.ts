import type { ChatPart } from "@/lib/chat-parts";

export type ThinkingGap = {
  /** 插在该 part 之前；null 表示时间线最前 */
  beforePartId: string | null;
  durationMs: number;
  label: string;
};

function formatGapLabel(ms: number): string {
  if (ms < 3_000) return "思考片刻";
  const sec = Math.round(ms / 1000);
  return `思考 ${sec}s`;
}

const SKIP_KINDS = new Set(["turn_meta", "todo"]);

/**
 * 根据 part 完成时间计算步间间隔（渲染层，不写 SSE）。
 */
export function computeThinkingGaps(
  parts: ChatPart[],
  options?: { runStartedAt?: number; minGapMs?: number },
): ThinkingGap[] {
  const minGap = options?.minGapMs ?? 3_000;
  const runStartedAt = options?.runStartedAt;

  const timeline = parts.filter((p) => !SKIP_KINDS.has(p.kind));

  const gaps: ThinkingGap[] = [];
  let prevEnd = runStartedAt;

  for (const part of timeline) {
    if (part.streaming && part.completedAt == null) continue;

    const end = part.completedAt;
    if (end == null) continue;

    if (prevEnd != null) {
      const gapMs = end - prevEnd;
      if (gapMs >= minGap) {
        gaps.push({
          beforePartId: part.id,
          durationMs: gapMs,
          label: formatGapLabel(gapMs),
        });
      }
    }

    prevEnd = end;
  }

  return gaps;
}

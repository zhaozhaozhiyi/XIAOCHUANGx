export type FinalSegmentAccumulator = {
  segments: Map<
    string,
    {
      text: string;
      forwardedFinalLength: number;
    }
  >;
  hasFinalText: boolean;
};

export function createFinalSegmentAccumulator(): FinalSegmentAccumulator {
  return {
    segments: new Map(),
    hasFinalText: false,
  };
}

export function appendFinalSegment(
  state: FinalSegmentAccumulator,
  payload: {
    segmentId: string;
    role: "pending" | "process" | "final";
    text?: string;
  },
): string {
  const segment = state.segments.get(payload.segmentId) ?? {
    text: "",
    forwardedFinalLength: 0,
  };
  if (payload.text) segment.text += payload.text;
  state.segments.set(payload.segmentId, segment);

  if (payload.role !== "final") return "";
  const content = segment.text.slice(segment.forwardedFinalLength);
  if (!content) return "";

  const startsNewSegment = segment.forwardedFinalLength === 0;
  segment.forwardedFinalLength = segment.text.length;
  const normalizedContent = state.hasFinalText ? content : content.trimStart();
  if (!normalizedContent) return "";
  const separator = startsNewSegment && state.hasFinalText ? "\n\n" : "";
  state.hasFinalText = true;
  return `${separator}${normalizedContent}`;
}

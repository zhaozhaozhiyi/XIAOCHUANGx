export type UnknownPartTelemetryPayload = {
  kind: string;
  zone: string;
  presentation: "default" | "timeline";
  partId: string;
};

export type MermaidTelemetryPayload = {
  sourceType: "research_map" | "markdown";
  partId?: string;
  sourceLength: number;
  error?: string;
};

const unknownPartEventName = "chat_unknown_part_rendered";
const mermaidSuccessEventName = "chat_mermaid_render_success";
const mermaidFailedEventName = "chat_mermaid_render_failed";

function emitTelemetry(eventName: string, payload: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  const detail = {
    event: eventName,
    ts: Date.now(),
    ...payload,
  };

  try {
    window.dispatchEvent(new CustomEvent("jlc:telemetry", { detail }));
  } catch {
    /* no-op */
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[telemetry] ${eventName}`, detail);
  }
}

export function trackUnknownPartKind(payload: UnknownPartTelemetryPayload): void {
  emitTelemetry(unknownPartEventName, payload);
}

export function trackMermaidRenderSuccess(payload: MermaidTelemetryPayload): void {
  emitTelemetry(mermaidSuccessEventName, payload);
}

export function trackMermaidRenderFailed(payload: MermaidTelemetryPayload): void {
  emitTelemetry(mermaidFailedEventName, payload);
}

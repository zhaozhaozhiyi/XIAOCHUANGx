import {
  chatExecutionMode,
  companionConfig,
  companionRunControlUrl,
} from "@/lib/companion/config";

export type RunControlAction = "enqueue" | "interrupt" | "steer";

export async function controlCompanionRun(input: {
  runId: string;
  action: RunControlAction;
  text: string;
  attachments?: Array<{ fileId: string }>;
}): Promise<void> {
  const runId = input.runId.trim();
  if (!runId) return;

  if (chatExecutionMode() !== "companion") {
    throw new Error("not_companion");
  }

  if (companionConfig.useMock) {
    if (input.action === "interrupt") return;
    throw new Error(`${input.action}_not_implemented`);
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (companionConfig.apiToken) {
    headers.Authorization = `Bearer ${companionConfig.apiToken}`;
  }

  const res = await fetch(companionRunControlUrl(runId), {
    method: "POST",
    headers,
    body: JSON.stringify({
      action: input.action,
      text: input.text,
      attachments: input.attachments ?? [],
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
      message?: string;
    };
    throw new Error(
      payload.code ?? payload.error ?? payload.message ?? "control_failed",
    );
  }
}

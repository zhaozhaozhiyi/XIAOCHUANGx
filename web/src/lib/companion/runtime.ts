import type {
  CompanionRunEventsResponse,
  CompanionRunRecord,
  CompanionSimulationRoundsResponse,
  CompanionSimulationSnapshotResponse,
  CompanionSessionQueueResponse,
  CompanionSessionRunsResponse,
} from "@/lib/companion/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    throw new Error(payload.message ?? payload.error ?? `request_failed_${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchSessionRunRecords(
  sessionId: string,
): Promise<CompanionSessionRunsResponse> {
  return fetchJson<CompanionSessionRunsResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/runs`,
  );
}

export async function fetchSessionRunQueue(
  sessionId: string,
): Promise<CompanionSessionQueueResponse> {
  return fetchJson<CompanionSessionQueueResponse>(
    `/api/sessions/${encodeURIComponent(sessionId)}/queue`,
  );
}

export async function fetchRunRecord(
  runId: string,
): Promise<CompanionRunRecord> {
  return fetchJson<CompanionRunRecord>(
    `/api/runs/${encodeURIComponent(runId)}`,
  );
}

export async function fetchRunEvents(
  runId: string,
): Promise<CompanionRunEventsResponse> {
  return fetchJson<CompanionRunEventsResponse>(
    `/api/runs/${encodeURIComponent(runId)}/events`,
  );
}

export async function fetchSimulationRounds(
  sessionId: string,
): Promise<CompanionSimulationRoundsResponse> {
  const q = new URLSearchParams({ sessionId });
  return fetchJson<CompanionSimulationRoundsResponse>(
    `/api/simulation-rounds?${q}`,
  );
}

export async function fetchSimulationSnapshot(input: {
  sessionId: string;
  roundId: string;
}): Promise<CompanionSimulationSnapshotResponse> {
  const q = new URLSearchParams({
    sessionId: input.sessionId,
    roundId: input.roundId,
  });
  return fetchJson<CompanionSimulationSnapshotResponse>(
    `/api/simulation-snapshot?${q}`,
  );
}

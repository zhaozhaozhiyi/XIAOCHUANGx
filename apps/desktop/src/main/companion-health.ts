export type CompanionHealthSnapshot = {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
};

function companionBaseUrl(): string {
  return (process.env.COMPANION_BASE_URL ?? "http://127.0.0.1:9477").replace(
    /\/$/,
    "",
  );
}

/** 主进程代理 Companion GET /v1/health（PRD §5.3.7 窄 IPC） */
export async function getCompanionHealth(): Promise<CompanionHealthSnapshot> {
  try {
    const res = await fetch(`${companionBaseUrl()}/v1/health`, {
      signal: AbortSignal.timeout(5000),
    });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "companion_unreachable",
    };
  }
}

export async function submitRunClarification(input: {
  runId: string;
  toolUseId: string;
  content: string;
}): Promise<{ ok: true } | { ok: false; error?: string; message: string }> {
  const res = await fetch(
    `/api/companion/runs/${encodeURIComponent(input.runId)}/clarification`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toolUseId: input.toolUseId,
        content: input.content,
      }),
    },
  );
  if (res.ok) return { ok: true };
  let message = `提交失败 (${res.status})`;
  try {
    const json = (await res.json()) as { message?: string; error?: string };
    return {
      ok: false,
      error: json.error,
      message: json.message ?? json.error ?? message,
    };
  } catch {
    /* ignore */
  }
  return { ok: false, message };
}

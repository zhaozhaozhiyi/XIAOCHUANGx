export function proxySseStream(
  upstreamBody: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  errorCode: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const reader = upstreamBody.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const abort = () => {
        void reader.cancel().catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      signal.addEventListener("abort", abort, { once: true });

      try {
        while (!signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) controller.enqueue(value);
        }
      } catch (error) {
        if (!signal.aborted) {
          const message =
            error instanceof Error ? error.message : "stream terminated";
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: errorCode, message })}\n\n`,
            ),
          );
        }
      } finally {
        signal.removeEventListener("abort", abort);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      return reader.cancel().catch(() => undefined);
    },
  });
}

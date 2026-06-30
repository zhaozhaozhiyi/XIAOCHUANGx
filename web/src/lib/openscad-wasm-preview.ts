export type OpenScadWasmPreviewResult =
  | {
      ok: true;
      mime: "model/stl";
      encoding: "base64";
      content: string;
      engine: "openscad-wasm";
    }
  | {
      ok: false;
      error:
        | "openscad_wasm_disabled"
        | "openscad_wasm_unsupported"
        | "openscad_wasm_timeout"
        | "openscad_wasm_not_configured"
        | "openscad_wasm_failed";
      detail?: string;
    };

type WorkerResponse =
  | {
      id: string;
      ok: true;
      mime: "model/stl";
      encoding: "base64";
      content: string;
    }
  | {
      id: string;
      ok: false;
      error?: string;
      detail?: string;
    };

const DEFAULT_TIMEOUT_MS = 12_000;
const workerState: {
  worker: Worker | null;
  pending: Map<
    string,
    {
      resolve: (result: OpenScadWasmPreviewResult) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >;
} = {
  worker: null,
  pending: new Map(),
};

export function isOpenScadWasmPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW === "1";
}

function resetWorker(reason: OpenScadWasmPreviewResult) {
  workerState.worker?.terminate();
  workerState.worker = null;
  for (const pending of workerState.pending.values()) {
    clearTimeout(pending.timeout);
    pending.resolve(reason);
  }
  workerState.pending.clear();
}

function getPreviewWorker(): Worker {
  if (workerState.worker) return workerState.worker;
  const worker = new Worker(
    new URL("../workers/openscad-wasm-preview.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = workerState.pending.get(event.data.id);
    if (!pending) return;
    clearTimeout(pending.timeout);
    workerState.pending.delete(event.data.id);
    if (event.data.ok) {
      pending.resolve({
        ok: true,
        mime: event.data.mime,
        encoding: event.data.encoding,
        content: event.data.content,
        engine: "openscad-wasm",
      });
      return;
    }
    pending.resolve({
      ok: false,
      error:
        event.data.error === "openscad_wasm_not_configured"
          ? "openscad_wasm_not_configured"
          : "openscad_wasm_failed",
      detail: event.data.detail,
    });
  };
  worker.onerror = (event) => {
    resetWorker({
      ok: false,
      error: "openscad_wasm_failed",
      detail: event.message,
    });
  };
  workerState.worker = worker;
  return worker;
}

export async function compileScadWithOpenScadWasm(input: {
  source: string;
  timeoutMs?: number;
}): Promise<OpenScadWasmPreviewResult> {
  if (!isOpenScadWasmPreviewEnabled()) {
    return { ok: false, error: "openscad_wasm_disabled" };
  }
  if (typeof Worker === "undefined") {
    return { ok: false, error: "openscad_wasm_unsupported" };
  }

  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<OpenScadWasmPreviewResult>((resolve) => {
    const worker = getPreviewWorker();
    const timeout = setTimeout(() => {
      workerState.pending.delete(id);
      resolve({ ok: false, error: "openscad_wasm_timeout" });
    }, timeoutMs);
    workerState.pending.set(id, { resolve, timeout });
    worker.postMessage({ id, source: input.source });
  });
}

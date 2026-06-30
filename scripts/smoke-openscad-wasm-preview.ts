import {
  compileScadWithOpenScadWasm,
  isOpenScadWasmPreviewEnabled,
} from "../web/src/lib/openscad-wasm-preview.ts";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type WorkerMessage = {
  id: string;
  source: string;
};

class SmokeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  private readonly workerModulePromise: Promise<{
    send: (message: WorkerMessage) => Promise<unknown>;
  }>;

  constructor() {
    this.workerModulePromise = this.loadWorkerModule();
  }

  postMessage(message: WorkerMessage) {
    void this.workerModulePromise
      .then((module) => module.send(message))
      .then((data) => this.onmessage?.({ data }))
      .catch((err) =>
        this.onerror?.({
          message: err instanceof Error ? err.message : String(err),
        }),
      );
  }

  terminate() {
    // The smoke worker is in-process and cleans up naturally.
  }

  private async loadWorkerModule() {
    const previousSelf = (globalThis as typeof globalThis & { self?: unknown }).self;
    let responder: ((message: unknown) => void) | null = null;
    const fakeSelf = {
      postMessage(message: unknown) {
        responder?.(message);
      },
      onmessage: null as ((event: { data: WorkerMessage }) => void) | null,
    };
    (globalThis as typeof globalThis & { self?: unknown }).self = fakeSelf;
    await import("../web/src/workers/openscad-wasm-preview.worker.ts");
    (globalThis as typeof globalThis & { self?: unknown }).self = previousSelf;

    return {
      send(message: WorkerMessage) {
        return new Promise<unknown>((resolveMessage, reject) => {
          responder = resolveMessage;
          try {
            fakeSelf.onmessage?.({ data: message });
          } catch (err) {
            reject(err);
          }
        });
      },
    };
  }
}

async function installBrowserHarness() {
  const jsPath = join(repoRoot, "web", "public", "openscad-wasm", "openscad.js");
  const wasmPath = join(repoRoot, "web", "public", "openscad-wasm", "openscad.wasm");
  if (!existsSync(jsPath) || !existsSync(wasmPath)) return false;

  const jsModule = await import(`file://${jsPath}`);
  const wasmBinary = await readFile(wasmPath);
  const originalImport = globalThis.__jlcOpenScadWasmFactory;
  globalThis.__jlcOpenScadWasmFactory = jsModule.default;
  globalThis.__jlcOpenScadWasmBinary = wasmBinary;
  globalThis.Worker = SmokeWorker as unknown as typeof Worker;
  globalThis.window = {
    setTimeout,
    clearTimeout,
  } as unknown as Window & typeof globalThis;
  process.env.NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW = "1";
  return () => {
    globalThis.__jlcOpenScadWasmFactory = originalImport;
    delete globalThis.__jlcOpenScadWasmBinary;
    delete (globalThis as typeof globalThis & { Worker?: unknown }).Worker;
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
    delete process.env.NEXT_PUBLIC_OPENSCAD_WASM_PREVIEW;
  };
}

async function main() {
  const result = await compileScadWithOpenScadWasm({
    source: "cube([1, 1, 1]);",
    timeoutMs: 100,
  });
  const ok =
    isOpenScadWasmPreviewEnabled() === false &&
    result.ok === false &&
    result.error === "openscad_wasm_disabled";

  console.log(
    JSON.stringify(
      {
        ok,
        enabled: isOpenScadWasmPreviewEnabled(),
        result,
      },
      null,
      2,
    ),
  );

  if (!ok) {
    process.exitCode = 1;
    return;
  }

  const cleanup = await installBrowserHarness();
  if (cleanup === false) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          enabledCompileSkipped: true,
          reason: "openscad_wasm_assets_missing",
        },
        null,
        2,
      ),
    );
    return;
  }

  try {
    const enabledResult = await compileScadWithOpenScadWasm({
      source: "cube([1, 1, 1]);",
      timeoutMs: 15_000,
    });
    const secondResult = await compileScadWithOpenScadWasm({
      source: "sphere(r = 1, $fn = 12);",
      timeoutMs: 15_000,
    });
    const enabledOk =
      enabledResult.ok &&
      enabledResult.engine === "openscad-wasm" &&
      enabledResult.content.length > 100 &&
      secondResult.ok &&
      secondResult.engine === "openscad-wasm" &&
      secondResult.content.length > 100;
    console.log(
      JSON.stringify(
        {
          ok: enabledOk,
          enabled: isOpenScadWasmPreviewEnabled(),
          result: enabledResult.ok
            ? {
                ok: true,
                engine: enabledResult.engine,
                mime: enabledResult.mime,
                encoding: enabledResult.encoding,
                contentLength: enabledResult.content.length,
              }
            : enabledResult,
          secondResult: secondResult.ok
            ? {
                ok: true,
                engine: secondResult.engine,
                mime: secondResult.mime,
                encoding: secondResult.encoding,
                contentLength: secondResult.content.length,
              }
            : secondResult,
        },
        null,
        2,
      ),
    );
    if (!enabledOk) process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

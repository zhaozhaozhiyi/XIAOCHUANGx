type PreviewRequest = {
  id: string;
  source: string;
};

type PreviewResponse =
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
      error: "openscad_wasm_not_configured" | "openscad_wasm_failed";
      detail: string;
    };

type OpenScadModule = {
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    readFile: (path: string, options?: { encoding?: "utf8" | "binary" }) => Uint8Array;
    unlink: (path: string) => void;
  };
  callMain: (args: string[]) => number;
};

type OpenScadFactory = (moduleArg: {
  noInitialRun?: boolean;
  noExitRuntime?: boolean;
  wasmBinary?: Uint8Array;
  locateFile?: (path: string) => string;
  print?: (message: string) => void;
  printErr?: (message: string) => void;
}) => Promise<OpenScadModule>;

type WorkerGlobalWithHarness = typeof globalThis & {
  __jlcOpenScadWasmFactory?: OpenScadFactory;
  __jlcOpenScadWasmBinary?: Uint8Array;
};

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<PreviewRequest>) => void) | null;
  postMessage: (message: PreviewResponse) => void;
};

let modulePromise: Promise<OpenScadModule> | null = null;
let compileQueue: Promise<void> = Promise.resolve();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const OPENSCAD_WASM_LOADER_URL = "/openscad-wasm/openscad.js";

async function loadOpenScadModule(): Promise<OpenScadModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      try {
        const harness = globalThis as WorkerGlobalWithHarness;
        const factoryModule = harness.__jlcOpenScadWasmFactory
          ? { default: harness.__jlcOpenScadWasmFactory }
          : ((await import(
              /* webpackIgnore: true */ OPENSCAD_WASM_LOADER_URL
            )) as { default?: OpenScadFactory });
        const factory = factoryModule.default;
        if (typeof factory !== "function") {
          throw new Error("openscad_wasm_factory_missing");
        }
        return await factory({
          noInitialRun: true,
          noExitRuntime: true,
          wasmBinary: harness.__jlcOpenScadWasmBinary,
          locateFile: (path) => `/openscad-wasm/${path}`,
          print: () => undefined,
          printErr: () => undefined,
        });
      } catch (err) {
        modulePromise = null;
        throw err;
      }
    })();
  }
  return modulePromise;
}

function safeUnlink(openScadModule: OpenScadModule, path: string) {
  try {
    openScadModule.FS.unlink(path);
  } catch {
    // The output may not exist after a failed compile; ignore cleanup misses.
  }
}

async function compilePreview(id: string, source: string): Promise<PreviewResponse> {
  const openScadModule = await loadOpenScadModule();
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const inputPath = `/input-${safeId}.scad`;
  const outputPath = `/output-${safeId}.stl`;

  safeUnlink(openScadModule, inputPath);
  safeUnlink(openScadModule, outputPath);
  openScadModule.FS.writeFile(inputPath, source);
  const exitCode = openScadModule.callMain(["-o", outputPath, inputPath]);
  if (exitCode !== 0) {
    throw new Error(`openscad_wasm_exit_${exitCode}`);
  }

  const output = openScadModule.FS.readFile(outputPath);
  safeUnlink(openScadModule, inputPath);
  safeUnlink(openScadModule, outputPath);

  return {
    id,
    ok: true,
    mime: "model/stl",
    encoding: "base64",
    content: bytesToBase64(output),
  };
}

worker.onmessage = (event: MessageEvent<PreviewRequest>) => {
  const id = event.data?.id;
  const source = event.data?.source;
  if (!id || !source?.trim()) {
    worker.postMessage({
      id,
      ok: false,
      error: "openscad_wasm_failed",
      detail: "empty_scad_source",
    });
    return;
  }

  compileQueue = compileQueue
    .then(() => compilePreview(id, source))
    .then((response) => worker.postMessage(response))
    .catch((err) => {
      const detail = normalizeError(err);
      worker.postMessage({
        id,
        ok: false,
        error: detail.includes("openscad_wasm_factory_missing")
          ? "openscad_wasm_not_configured"
          : "openscad_wasm_failed",
        detail,
      });
    });
};

export {};

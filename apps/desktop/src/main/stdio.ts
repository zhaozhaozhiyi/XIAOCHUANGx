import type { Writable } from "node:stream";

let installed = false;

// Electron reload / dev restarts can leave stdio pipes closed. Only EPIPE means
// "the log sink is gone"; every other stream error should still surface.
function isEpipeError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "EPIPE"
  );
}

function rethrowAsync(err: unknown): void {
  setTimeout(() => {
    throw err;
  }, 0);
}

function guardStream(stream: Writable): void {
  stream.on("error", (err) => {
    if (isEpipeError(err)) return;
    rethrowAsync(err);
  });
}

export function installStdioEpipeGuard(): void {
  if (installed) return;
  installed = true;
  guardStream(process.stdout);
  guardStream(process.stderr);
}

export function writeToStdio(stream: Writable, chunk: string): void {
  try {
    stream.write(chunk);
  } catch (err) {
    if (isEpipeError(err)) return;
    throw err;
  }
}

installStdioEpipeGuard();

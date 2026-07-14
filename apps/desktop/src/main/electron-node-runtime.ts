import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/**
 * Packaged macOS apps expose the main executable as a foreground app. If we use
 * it for ELECTRON_RUN_AS_NODE children, Dock may show a generic "exec" icon.
 * The bundled Helper executable runs the same Node-capable Electron runtime
 * without creating a user-visible Dock app.
 */
export function resolveElectronNodeRuntime(): string {
  if (process.platform !== "darwin") {
    return process.execPath;
  }

  const executableName = basename(process.execPath);
  const contentsDir = dirname(dirname(process.execPath));
  const helperPath = join(
    contentsDir,
    "Frameworks",
    `${executableName} Helper.app`,
    "Contents",
    "MacOS",
    `${executableName} Helper`,
  );

  return existsSync(helperPath) ? helperPath : process.execPath;
}

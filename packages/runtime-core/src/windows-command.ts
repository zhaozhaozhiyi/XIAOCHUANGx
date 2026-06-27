import { existsSync, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

export type WindowsCommandResolution = {
  bin: string;
  argsPrefix?: string[];
  shellWrapperPath?: string;
  requiresShell: boolean;
  windowsVerbatimArguments?: boolean;
};

const SHELL_WRAPPER_EXT = /\.(?:cmd|bat)$/i;
const EXECUTABLE_EXT = /\.(?:exe|cmd|bat|com)$/i;

function commandResolution(bin: string): WindowsCommandResolution {
  if (SHELL_WRAPPER_EXT.test(bin)) {
    return {
      bin: process.env.ComSpec || "cmd.exe",
      argsPrefix: ["/d", "/s", "/c"],
      shellWrapperPath: bin,
      requiresShell: false,
      windowsVerbatimArguments: true,
    };
  }
  return { bin, requiresShell: false };
}

export function quoteCmdArg(arg: string): string {
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/\\+$/g, "$&$&")}"`;
}

export function buildResolvedCommandArgs(
  command: WindowsCommandResolution,
  args: string[],
): string[] {
  if (!command.shellWrapperPath) {
    return [...(command.argsPrefix ?? []), ...args];
  }

  const commandLine = [
    quoteCmdArg(command.shellWrapperPath),
    ...args.map((arg) => quoteCmdArg(arg)),
  ].join(" ");
  return [...(command.argsPrefix ?? []), `"${commandLine}"`];
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function candidateExtensions(): string[] {
  const raw = process.env.PATHEXT?.trim();
  if (!raw) return [".exe", ".cmd", ".bat", ".com"];
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.length > 0);
}

function resolveDirectPath(bin: string): string | null {
  if (EXECUTABLE_EXT.test(bin)) {
    return isFile(bin) ? bin : null;
  }
  for (const ext of candidateExtensions()) {
    const candidate = `${bin}${ext}`;
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export function resolveWindowsCommand(bin: string): WindowsCommandResolution {
  if (process.platform !== "win32") {
    return { bin, requiresShell: false };
  }

  const direct =
    isAbsolute(bin) || bin.includes("\\") || bin.includes("/")
      ? resolveDirectPath(bin)
      : null;
  if (direct) {
    return commandResolution(direct);
  }

  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    const candidate = resolveDirectPath(join(dir, bin));
    if (candidate && existsSync(candidate)) {
      return commandResolution(candidate);
    }
  }

  return { bin, requiresShell: false };
}

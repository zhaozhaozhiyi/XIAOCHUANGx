import path from "node:path";

export function resolveLegacyWorkspaceRoot(): string {
  const configured = process.env.JLC_LEGACY_WORKSPACE_ROOT?.trim();
  return configured
    ? path.resolve(configured)
    : path.resolve(/*turbopackIgnore: true*/ process.cwd());
}

export function resolveLegacySafePath(relativePath: string): string | null {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;

  const root = resolveLegacyWorkspaceRoot();
  const full = path.join(root, normalized);
  if (!full.startsWith(root)) return null;
  return full;
}

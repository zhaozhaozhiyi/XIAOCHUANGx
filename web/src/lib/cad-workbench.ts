const CAD_WORKBENCH_PRIORITY = [
  /(^|\/)drawing\.scad$/i,
  /\.scad$/i,
  /(^|\/)exports\/drawing\.stl$/i,
  /(^|\/)exports\/preview\.stl$/i,
  /\.stl$/i,
  /(^|\/)exports\/drawing\.dxf$/i,
  /\.dxf$/i,
  /(^|\/)readme\.md$/i,
] as const;

function normalizeCadPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function cadWorkbenchRank(path: string): number {
  const normalized = normalizeCadPath(path);
  const rank = CAD_WORKBENCH_PRIORITY.findIndex((pattern) =>
    pattern.test(normalized),
  );
  return rank === -1 ? Number.POSITIVE_INFINITY : rank;
}

export function isCadWorkbenchPath(path: string | undefined | null): boolean {
  if (!path) return false;
  return Number.isFinite(cadWorkbenchRank(path));
}

export function selectMainCadPath(
  candidates: Iterable<string | undefined | null>,
): string | null {
  let best: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate?.trim()) continue;
    const normalized = normalizeCadPath(candidate);
    const rank = cadWorkbenchRank(normalized);
    if (!Number.isFinite(rank)) continue;
    if (
      best == null ||
      rank < bestRank ||
      (rank === bestRank && normalized.length < best.length)
    ) {
      best = normalized;
      bestRank = rank;
    }
  }

  return best;
}

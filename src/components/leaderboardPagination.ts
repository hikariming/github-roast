function clampPageIndex(page: number, totalPages: number): number {
  return Math.min(Math.max(0, page), Math.max(0, totalPages - 1));
}

export function resolveLeaderboardPageInput(
  raw: string,
  currentPage: number,
  totalPages: number,
): number {
  const pageCount = Math.max(1, Math.floor(totalPages));
  const current = clampPageIndex(Math.floor(currentPage), pageCount);
  if (!raw.trim()) return current;

  const value = Number(raw);
  if (!Number.isFinite(value)) return current;

  return clampPageIndex(Math.trunc(value) - 1, pageCount);
}

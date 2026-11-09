/** Long enough to catch a reload that failed again, short enough that a tab left open recovers from the next deploy */
export const CHUNK_RELOAD_GUARD_MS = 60_000;

/** Whether a failed chunk may reload the page, given the stored time of the last such reload (`null` when there was none) */
export function mayReloadAfterChunkError(lastReload: string | null, now: number): boolean {
  if (lastReload === null) return true;
  const elapsed = now - Number(lastReload);
  return Number.isNaN(elapsed) || elapsed >= CHUNK_RELOAD_GUARD_MS;
}

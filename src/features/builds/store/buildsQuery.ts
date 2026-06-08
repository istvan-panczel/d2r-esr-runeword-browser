import type { BuildSortMode } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a string is a UUID. Build ids are uuid columns, so a malformed id
 * (e.g. a hand-typed bad URL) would make PostgREST error on the type cast rather
 * than return zero rows — we treat those as "not found" without querying.
 */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Keyset cursor: the sort-relevant fields of the last build on the current page. */
export interface BuildListCursor {
  readonly likesCount: number;
  readonly createdAt: string;
  readonly id: string;
}

/**
 * Builds the PostgREST `.or()` condition string for keyset pagination after
 * `cursor`, matching the active sort order. Both orderings end with `id` (unique,
 * immutable) so the cursor is always a strict total order — no missed/duplicate
 * rows on the stable "newest" sort, and minimal duplicates on "most liked".
 */
export function buildCursorOrFilter(sortMode: BuildSortMode, cursor: BuildListCursor): string {
  if (sortMode === 'most_liked') {
    // (likes_count, created_at, id) DESC
    const likes = String(cursor.likesCount);
    return [
      `likes_count.lt.${likes}`,
      `and(likes_count.eq.${likes},created_at.lt.${cursor.createdAt})`,
      `and(likes_count.eq.${likes},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    ].join(',');
  }
  // newest: (created_at, id) DESC
  return [`created_at.lt.${cursor.createdAt}`, `and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`].join(',');
}

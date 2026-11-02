import { descendingKeysetFilter, isUuid } from '@/core/supabase/query';
import type { BuildSortMode } from '../types';

export { isUuid };

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
  const createdAndId = [
    { column: 'created_at', value: cursor.createdAt },
    { column: 'id', value: cursor.id },
  ];
  // most_liked: (likes_count, created_at, id) DESC; newest: (created_at, id) DESC
  return descendingKeysetFilter(
    sortMode === 'most_liked' ? [{ column: 'likes_count', value: cursor.likesCount }, ...createdAndId] : createdAndId
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useSelector } from 'react-redux';
import { db } from '@/core/db';
import { selectError, selectIsInitialized } from '@/core/store';
import { indexUniqueDetails, type UniqueDetailsIndex } from '../engine/uniqueDetails';

export type UniqueDetailsState =
  { readonly status: 'loading' } | { readonly status: 'unavailable' } | { readonly status: 'ready'; readonly index: UniqueDetailsIndex };

/**
 * The HTM unique items (the Uniques page data) for the coupon detail cards. The stash routes render before the HTM data
 * sync finishes, so the cache can still be empty: 'loading' while the sync runs, 'unavailable' when it failed or found
 * nothing; the cards update by themselves once the sync stores the items (live query).
 */
export function useUniqueDetails(): UniqueDetailsState {
  const items = useLiveQuery(() => db.htmUniqueItems.toArray());
  const isInitialized = useSelector(selectIsInitialized);
  const error = useSelector(selectError);
  if (items === undefined) return { status: 'loading' };
  if (items.length === 0) return isInitialized || error !== null ? { status: 'unavailable' } : { status: 'loading' };
  return { status: 'ready', index: indexUniqueDetails(items) };
}

import { useDispatch, useSelector } from 'react-redux';
import { usePersistentState } from '@/core/hooks/usePersistentState';
import { filterByFavoriteId, isBoolean } from '@/core/utils/favorites';
import { openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import {
  selectFavoriteCounts,
  selectFavoriteItemIds,
  selectFavoriteItemIdSet,
  selectPendingFavoriteItemIdSet,
  toggleFavoriteRequested,
} from '../store';

export interface ItemFavoritesOptions<T> {
  /** Builds the stable item_id for an item (e.g. buildRecipeFavoriteId('runeword', r)). */
  readonly getId: (item: T) => string;
  /** item_id prefix for this kind (e.g. 'runeword:'), used to count this page's favourites. */
  readonly kindPrefix: string;
  /** localStorage key for the per-page "Favorites only" view toggle. */
  readonly filterStorageKey: string;
}

export interface ItemFavorites<T> {
  readonly isFavorite: (item: T) => boolean;
  readonly count: (item: T) => number;
  readonly isPending: (item: T) => boolean;
  readonly toggle: (item: T) => void;
  readonly filterItems: (items: readonly T[]) => readonly T[];
  /** Number of this kind's items the user has favourited (for the toggle button). */
  readonly favoriteCount: number;
  readonly showFavoritesOnly: boolean;
  readonly toggleShowFavoritesOnly: () => void;
  /** Whether favourites UI that only makes sense signed in (the filter) should show. */
  readonly isAuthenticated: boolean;
}

/**
 * Server-backed favourites for a list screen: the star toggle (with sign-in
 * prompt), the public per-item count, and the "Favorites only" view filter.
 * Reads from the favourites slice (populated by the lazy saga) and auth state.
 */
export function useItemFavorites<T>({ getId, kindPrefix, filterStorageKey }: ItemFavoritesOptions<T>): ItemFavorites<T> {
  const dispatch = useDispatch();
  const favoriteIds = useSelector(selectFavoriteItemIds);
  const favoriteIdSet = useSelector(selectFavoriteItemIdSet);
  const counts = useSelector(selectFavoriteCounts);
  const pendingIdSet = useSelector(selectPendingFavoriteItemIdSet);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [showFavoritesOnly, setShowFavoritesOnly] = usePersistentState<boolean>(filterStorageKey, false, isBoolean);

  return {
    isFavorite: (item) => favoriteIdSet.has(getId(item)),
    count: (item) => counts[getId(item)] ?? 0,
    isPending: (item) => pendingIdSet.has(getId(item)),
    toggle: (item) => {
      if (!isAuthenticated) {
        dispatch(openSignInDialog());
        return;
      }
      dispatch(toggleFavoriteRequested(getId(item)));
    },
    // Ignore the stale toggle when signed out so a leftover "on" never hides every item.
    filterItems: (items) => (showFavoritesOnly && isAuthenticated ? filterByFavoriteId(items, getId, favoriteIds) : items),
    favoriteCount: favoriteIds.filter((id) => id.startsWith(kindPrefix)).length,
    showFavoritesOnly,
    toggleShowFavoritesOnly: () => {
      setShowFavoritesOnly((current) => !current);
    },
    isAuthenticated,
  };
}

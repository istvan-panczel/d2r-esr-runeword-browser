import { usePersistentState } from './usePersistentState';
import { filterByFavoriteId, isBoolean, isStringArray, toggleFavoriteId } from '../utils/favorites';

export interface FavoriteStorageKeys {
  /** localStorage key holding the array of favourite ids. */
  readonly favoriteIds: string;
  /** localStorage key holding the "favorites only" toggle boolean. */
  readonly showOnly: string;
}

export interface Favorites<T> {
  readonly favoriteCount: number;
  readonly showFavoritesOnly: boolean;
  readonly toggleShowFavoritesOnly: () => void;
  readonly isFavorite: (item: T) => boolean;
  readonly toggleFavorite: (item: T) => void;
  readonly filterItems: (items: readonly T[]) => readonly T[];
}

/**
 * Generic persistent favourites (star + "Favorites only" toggle), keyed by a
 * caller-supplied stable id. Recipe and unique-item favourites both build on this.
 */
export function useFavorites<T>(keys: FavoriteStorageKeys, getFavoriteId: (item: T) => string): Favorites<T> {
  const [favoriteIds, setFavoriteIds] = usePersistentState<readonly string[]>(keys.favoriteIds, [], isStringArray);
  const [showFavoritesOnly, setShowFavoritesOnly] = usePersistentState<boolean>(keys.showOnly, false, isBoolean);

  const favoriteIdSet = new Set(favoriteIds);

  return {
    favoriteCount: favoriteIds.length,
    showFavoritesOnly,
    toggleShowFavoritesOnly: () => {
      setShowFavoritesOnly((current) => !current);
    },
    isFavorite: (item) => favoriteIdSet.has(getFavoriteId(item)),
    toggleFavorite: (item) => {
      const favoriteId = getFavoriteId(item);
      setFavoriteIds((current) => toggleFavoriteId(favoriteId, current));
    },
    filterItems: (items) => (showFavoritesOnly ? filterByFavoriteId(items, getFavoriteId, favoriteIds) : items),
  };
}

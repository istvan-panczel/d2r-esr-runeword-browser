import type { FavoriteStorageKeys } from '@/core/hooks/useFavorites';
import type { HtmUniqueItem } from '@/core/db/models';

/** localStorage keys for unique-item favourites. */
export const HTM_UNIQUE_ITEM_FAVORITE_KEYS: FavoriteStorageKeys = {
  favoriteIds: 'd2r-esr.htmUniqueItems.favorites.v1',
  showOnly: 'd2r-esr.htmUniqueItems.showFavoritesOnly.v1',
};

/**
 * Stable favourite id for a unique item. Keyed on (name, baseItemCode) rather
 * than the Dexie auto-increment `id`, so favourites survive a data re-sync that
 * reassigns ids — mirroring how recipe favourites key on stable content.
 */
export function buildHtmUniqueItemFavoriteId(item: Pick<HtmUniqueItem, 'name' | 'baseItemCode'>): string {
  return ['htmUnique', item.name, item.baseItemCode].join(':');
}

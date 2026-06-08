import { useFavorites, type Favorites } from '@/core/hooks/useFavorites';
import type { HtmUniqueItem } from '@/core/db/models';
import { HTM_UNIQUE_ITEM_FAVORITE_KEYS, buildHtmUniqueItemFavoriteId } from '../utils/htmUniqueItemFavorites';

/** Persistent favourites for the unique-items screen (star + "Favorites only"). */
export function useHtmUniqueItemFavorites(): Favorites<HtmUniqueItem> {
  return useFavorites<HtmUniqueItem>(HTM_UNIQUE_ITEM_FAVORITE_KEYS, buildHtmUniqueItemFavoriteId);
}

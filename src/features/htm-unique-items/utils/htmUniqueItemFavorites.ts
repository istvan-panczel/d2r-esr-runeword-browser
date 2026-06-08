import type { HtmUniqueItem } from '@/core/db/models';

/**
 * Stable favourite id for a unique item. Keyed on (name, baseItemCode) rather
 * than the Dexie auto-increment `id`, so favourites survive a data re-sync that
 * reassigns ids — mirroring how recipe favourites key on stable content.
 */
export function buildHtmUniqueItemFavoriteId(item: Pick<HtmUniqueItem, 'name' | 'baseItemCode'>): string {
  return ['htmUnique', item.name, item.baseItemCode].join(':');
}

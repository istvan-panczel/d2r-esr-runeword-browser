import { readPersistentJson, removePersistentJson, writePersistentJson, type PersistentStorage } from '@/core/hooks/usePersistentState';
import { isBoolean, isStringArray } from '@/core/utils/favorites';

// Keys that held favourite ids on-device before favourites moved to Supabase.
// The stored arrays already contain ids in `item_id` form (e.g. runeword:Spirit:1),
// so they migrate to the cloud verbatim.
export const LEGACY_FAVORITE_ID_KEYS = [
  'd2r-esr.runewords.favoriteRecipes.v1',
  'd2r-esr.gemwords.favoriteRecipes.v1',
  'd2r-esr.htmUniqueItems.favorites.v1',
] as const;

// Obsolete "Favorites only" view-toggle prefs cleaned up alongside the data.
const LEGACY_FILTER_KEYS = [
  'd2r-esr.runewords.showFavoriteRecipesOnly.v1',
  'd2r-esr.gemwords.showFavoriteRecipesOnly.v1',
  'd2r-esr.htmUniqueItems.showFavoritesOnly.v1',
] as const;

// Set once the one-time localStorage -> Supabase migration has run on this device.
export const FAVORITES_MIGRATED_KEY = 'd2r-esr.favorites.migratedToCloud.v1';

function browserStorage(): PersistentStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

/** Favourite ids still sitting in the legacy localStorage keys (deduped, order-stable). */
export function collectLegacyFavoriteIds(storage: PersistentStorage | null = browserStorage()): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const key of LEGACY_FAVORITE_ID_KEYS) {
    for (const id of readPersistentJson<readonly string[]>(storage, key, [], isStringArray)) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Whether the one-time migration has already run on this device. */
export function hasMigratedLocalFavorites(storage: PersistentStorage | null = browserStorage()): boolean {
  return readPersistentJson<boolean>(storage, FAVORITES_MIGRATED_KEY, false, isBoolean);
}

/** Drop the legacy favourite + filter keys and record that the migration has run. */
export function markLocalFavoritesMigrated(storage: PersistentStorage | null = browserStorage()): void {
  for (const key of [...LEGACY_FAVORITE_ID_KEYS, ...LEGACY_FILTER_KEYS]) {
    removePersistentJson(storage, key);
  }
  writePersistentJson(storage, FAVORITES_MIGRATED_KEY, true);
}

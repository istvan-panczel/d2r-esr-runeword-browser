import { describe, expect, it } from 'vitest';
import type { PersistentStorage } from '@/core/hooks/usePersistentState';
import {
  FAVORITES_MIGRATED_KEY,
  collectLegacyFavoriteIds,
  hasMigratedLocalFavorites,
  markLocalFavoritesMigrated,
} from './localFavoritesMigration';

function fakeStorage(initial: Record<string, string> = {}): PersistentStorage & { readonly map: Map<string, string> } {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

describe('localFavoritesMigration', () => {
  it('collects favourite ids across the three legacy keys, deduped and order-stable', () => {
    const storage = fakeStorage({
      'd2r-esr.runewords.favoriteRecipes.v1': JSON.stringify(['runeword:Spirit:1', 'runeword:Insight:1']),
      'd2r-esr.gemwords.favoriteRecipes.v1': JSON.stringify(['gemword:Black:1']),
      'd2r-esr.htmUniqueItems.favorites.v1': JSON.stringify(['htmUnique:Nagelring:rin', 'runeword:Spirit:1']),
    });
    expect(collectLegacyFavoriteIds(storage)).toEqual([
      'runeword:Spirit:1',
      'runeword:Insight:1',
      'gemword:Black:1',
      'htmUnique:Nagelring:rin',
    ]);
  });

  it('returns nothing when there are no legacy favourites', () => {
    expect(collectLegacyFavoriteIds(fakeStorage())).toEqual([]);
  });

  it('ignores malformed legacy values', () => {
    const storage = fakeStorage({
      'd2r-esr.runewords.favoriteRecipes.v1': JSON.stringify('not-an-array'),
      'd2r-esr.gemwords.favoriteRecipes.v1': '{ broken json',
    });
    expect(collectLegacyFavoriteIds(storage)).toEqual([]);
  });

  it('reports migration state and flips it when marked', () => {
    const storage = fakeStorage();
    expect(hasMigratedLocalFavorites(storage)).toBe(false);
    markLocalFavoritesMigrated(storage);
    expect(hasMigratedLocalFavorites(storage)).toBe(true);
  });

  it('clears legacy favourite + filter keys when marking migrated', () => {
    const storage = fakeStorage({
      'd2r-esr.runewords.favoriteRecipes.v1': JSON.stringify(['runeword:Spirit:1']),
      'd2r-esr.runewords.showFavoriteRecipesOnly.v1': 'true',
      'd2r-esr.htmUniqueItems.showFavoritesOnly.v1': 'true',
    });

    markLocalFavoritesMigrated(storage);

    expect(collectLegacyFavoriteIds(storage)).toEqual([]);
    expect(storage.map.has('d2r-esr.runewords.showFavoriteRecipesOnly.v1')).toBe(false);
    expect(storage.map.has('d2r-esr.htmUniqueItems.showFavoritesOnly.v1')).toBe(false);
    expect(storage.map.get(FAVORITES_MIGRATED_KEY)).toBe('true');
  });
});

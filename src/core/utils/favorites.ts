// Generic favourites primitives: a persisted set of stable string ids plus a
// "favorites only" toggle. Recipe favourites (runewords/gemwords) and unique-item
// favourites both build on these, each supplying its own stable id scheme.

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function toggleFavoriteId(favoriteId: string, favoriteIds: readonly string[]): readonly string[] {
  if (favoriteIds.includes(favoriteId)) {
    return favoriteIds.filter((entry) => entry !== favoriteId);
  }

  return [...favoriteIds, favoriteId];
}

export function filterByFavoriteId<T>(
  items: readonly T[],
  getFavoriteId: (item: T) => string,
  favoriteIds: readonly string[]
): readonly T[] {
  const favoriteIdSet = new Set(favoriteIds);
  return items.filter((item) => favoriteIdSet.has(getFavoriteId(item)));
}

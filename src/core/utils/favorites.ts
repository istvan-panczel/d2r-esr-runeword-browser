// Shared favourites helpers: localStorage value validators and an id-membership
// filter, used by the favourites hook, the localStorage -> Supabase migration,
// and the per-kind id builders.

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function filterByFavoriteId<T>(
  items: readonly T[],
  getFavoriteId: (item: T) => string,
  favoriteIds: readonly string[]
): readonly T[] {
  const favoriteIdSet = new Set(favoriteIds);
  return items.filter((item) => favoriteIdSet.has(getFavoriteId(item)));
}

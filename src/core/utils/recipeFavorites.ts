export type RecipeFavoriteKind = 'runeword' | 'gemword';

export interface RecipeFavoriteEntry {
  readonly name: string;
  readonly variant: number;
}

export function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function buildRecipeFavoriteId(kind: RecipeFavoriteKind, recipe: RecipeFavoriteEntry): string {
  // (name, variant) is unique by construction (parsers assign variants per name)
  // and intentionally excludes volatile data like allowedItems, so favourites
  // survive upstream data refreshes that tweak a recipe's item list
  return [kind, recipe.name, String(recipe.variant)].join(':');
}

export function toggleRecipeFavoriteId(favoriteId: string, favoriteIds: readonly string[]): readonly string[] {
  if (favoriteIds.includes(favoriteId)) {
    return favoriteIds.filter((entry) => entry !== favoriteId);
  }

  return [...favoriteIds, favoriteId];
}

export function filterFavoriteRecipes<T extends RecipeFavoriteEntry>(
  recipes: readonly T[],
  kind: RecipeFavoriteKind,
  favoriteIds: readonly string[]
): readonly T[] {
  const favoriteIdSet = new Set(favoriteIds);
  return recipes.filter((recipe) => favoriteIdSet.has(buildRecipeFavoriteId(kind, recipe)));
}

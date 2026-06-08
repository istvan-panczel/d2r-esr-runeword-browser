export type RecipeFavoriteKind = 'runeword' | 'gemword';

export interface RecipeFavoriteEntry {
  readonly name: string;
  readonly variant: number;
}

export function buildRecipeFavoriteId(kind: RecipeFavoriteKind, recipe: RecipeFavoriteEntry): string {
  // (name, variant) is unique by construction (parsers assign variants per name)
  // and intentionally excludes volatile data like allowedItems, so favourites
  // survive upstream data refreshes that tweak a recipe's item list
  return [kind, recipe.name, String(recipe.variant)].join(':');
}

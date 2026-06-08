import { useFavorites, type Favorites } from './useFavorites';
import { buildRecipeFavoriteId, type RecipeFavoriteEntry, type RecipeFavoriteKind } from '../utils/recipeFavorites';

export interface RecipeFavorites<T extends RecipeFavoriteEntry> {
  readonly favoriteCount: number;
  readonly showFavoritesOnly: boolean;
  readonly toggleShowFavoritesOnly: () => void;
  readonly isFavorite: (recipe: T) => boolean;
  readonly toggleFavorite: (recipe: T) => void;
  readonly filterRecipes: (recipes: readonly T[]) => readonly T[];
}

/**
 * Persistent per-kind recipe favourites (star + "Favorites only" toggle),
 * shared by the runewords and gemwords screens.
 */
export function useRecipeFavorites<T extends RecipeFavoriteEntry>(kind: RecipeFavoriteKind): RecipeFavorites<T> {
  const favorites: Favorites<T> = useFavorites<T>(
    {
      favoriteIds: `d2r-esr.${kind}s.favoriteRecipes.v1`,
      showOnly: `d2r-esr.${kind}s.showFavoriteRecipesOnly.v1`,
    },
    (recipe) => buildRecipeFavoriteId(kind, recipe)
  );

  return {
    favoriteCount: favorites.favoriteCount,
    showFavoritesOnly: favorites.showFavoritesOnly,
    toggleShowFavoritesOnly: favorites.toggleShowFavoritesOnly,
    isFavorite: favorites.isFavorite,
    toggleFavorite: favorites.toggleFavorite,
    filterRecipes: favorites.filterItems,
  };
}

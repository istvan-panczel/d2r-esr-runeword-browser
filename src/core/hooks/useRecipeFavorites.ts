import { usePersistentState } from './usePersistentState';
import {
  buildRecipeFavoriteId,
  filterFavoriteRecipes,
  isBoolean,
  isStringArray,
  toggleRecipeFavoriteId,
  type RecipeFavoriteEntry,
  type RecipeFavoriteKind,
} from '../utils/recipeFavorites';

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
  const [favoriteRecipeIds, setFavoriteRecipeIds] = usePersistentState<readonly string[]>(
    `d2r-esr.${kind}s.favoriteRecipes.v1`,
    [],
    isStringArray
  );
  const [showFavoritesOnly, setShowFavoritesOnly] = usePersistentState<boolean>(
    `d2r-esr.${kind}s.showFavoriteRecipesOnly.v1`,
    false,
    isBoolean
  );

  const favoriteIdSet = new Set(favoriteRecipeIds);

  return {
    favoriteCount: favoriteRecipeIds.length,
    showFavoritesOnly,
    toggleShowFavoritesOnly: () => {
      setShowFavoritesOnly((current) => !current);
    },
    isFavorite: (recipe) => favoriteIdSet.has(buildRecipeFavoriteId(kind, recipe)),
    toggleFavorite: (recipe) => {
      const favoriteId = buildRecipeFavoriteId(kind, recipe);
      setFavoriteRecipeIds((current) => toggleRecipeFavoriteId(favoriteId, current));
    },
    filterRecipes: (recipes) => (showFavoritesOnly ? filterFavoriteRecipes(recipes, kind, favoriteRecipeIds) : recipes),
  };
}

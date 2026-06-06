import { RunewordFilters } from '../components/RunewordFilters';
import { RunewordCard } from '../components/RunewordCard';
import { useFilteredRunewords } from '../hooks/useFilteredRunewords';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';
import { useRecipeFavorites } from '@/core/hooks/useRecipeFavorites';
import type { Runeword } from '@/core/db/models';

export function RunewordsScreen() {
  useUrlInitialize();
  const runewords = useFilteredRunewords();
  const favorites = useRecipeFavorites<Runeword>('runeword');

  // Loading state
  if (runewords === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredRunewords = favorites.filterRecipes(runewords);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Runewords ({filteredRunewords.length})</h1>
      <RunewordFilters />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing {filteredRunewords.length} runewords</p>
        <FavoritesToggleButton
          favoriteCount={favorites.favoriteCount}
          showFavoritesOnly={favorites.showFavoritesOnly}
          onToggle={favorites.toggleShowFavoritesOnly}
        />
      </div>

      {filteredRunewords.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly
            ? 'No favorite runewords to show. Star some runewords or turn off "Favorites only".'
            : 'No runewords found. Try adjusting your filters or load data first.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRunewords.map((runeword) => (
            <div key={`${runeword.name}-${String(runeword.variant)}-${runeword.allowedItems.join(',')}`} className="card-visibility-auto">
              <RunewordCard runeword={runeword} isFavorite={favorites.isFavorite(runeword)} onToggleFavorite={favorites.toggleFavorite} />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

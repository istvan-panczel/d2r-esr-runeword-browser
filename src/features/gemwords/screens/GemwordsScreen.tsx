import { GemwordFilters } from '../components/GemwordFilters';
import { GemwordCard } from '../components/GemwordCard';
import { useFilteredGemwords } from '../hooks/useFilteredGemwords';
import { useGemBonusMap } from '../hooks/useGemBonuses';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';
import { useRecipeFavorites } from '@/core/hooks/useRecipeFavorites';
import type { Gemword } from '@/core/db/models';

export function GemwordsScreen() {
  useUrlInitialize();
  const gemwords = useFilteredGemwords();
  const gemBonusMap = useGemBonusMap();
  const favorites = useRecipeFavorites<Gemword>('gemword');

  // Loading state
  if (gemwords === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredGemwords = favorites.filterRecipes(gemwords);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Gemwords ({filteredGemwords.length})</h1>
      <GemwordFilters />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing {filteredGemwords.length} gemwords</p>
        <FavoritesToggleButton
          favoriteCount={favorites.favoriteCount}
          showFavoritesOnly={favorites.showFavoritesOnly}
          onToggle={favorites.toggleShowFavoritesOnly}
        />
      </div>

      {filteredGemwords.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly
            ? 'No favorite gemwords to show. Star some gemwords or turn off "Favorites only".'
            : 'No gemwords found. Try adjusting your filters or load data first.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGemwords.map((gemword) => (
            <div key={`${gemword.name}-${String(gemword.variant)}-${gemword.allowedItems.join(',')}`} className="card-visibility-auto">
              <GemwordCard
                gemword={gemword}
                gemBonusMap={gemBonusMap}
                isFavorite={favorites.isFavorite(gemword)}
                onToggleFavorite={favorites.toggleFavorite}
              />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

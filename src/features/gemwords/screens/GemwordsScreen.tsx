import { GemwordFilters } from '../components/GemwordFilters';
import { GemwordCard } from '../components/GemwordCard';
import { useFilteredGemwords } from '../hooks/useFilteredGemwords';
import { useGemBonusMap } from '../hooks/useGemBonuses';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { SocketableLookupContext, useSocketableLookupQuery } from '@/core/hooks/useSocketableLookup';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';
import { useItemFavorites } from '@/features/favorites';
import { buildRecipeFavoriteId } from '@/core/utils/recipeFavorites';
import type { Gemword } from '@/core/db/models';
import { useSelector } from 'react-redux';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { selectExactName } from '../store/gemwordsSlice';

const getGemwordFavoriteId = (gemword: Gemword) => buildRecipeFavoriteId('gemword', gemword);

export function GemwordsScreen() {
  const { nameFromUrl, clearExactName } = useUrlInitialize();
  const gemwords = useFilteredGemwords();
  const exactName = useSelector(selectExactName);
  const gemBonusMap = useGemBonusMap();
  // Loaded once for the whole screen and shared by all gem badges/tooltips
  const socketableLookup = useSocketableLookupQuery();
  const favorites = useItemFavorites<Gemword>({
    getId: getGemwordFavoriteId,
    kindPrefix: 'gemword:',
    filterStorageKey: 'd2r-esr.gemwords.favoritesOnly.v1',
  });

  // Loading state
  if (gemwords === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredGemwords = favorites.filterItems(gemwords);

  return (
    <PageShell title="Gemwords" count={filteredGemwords.length}>
      <GemwordFilters />

      <ResultsBar
        summary={`Showing ${String(filteredGemwords.length)} gemwords`}
        chips={exactName !== null && <ExactNameChip name={exactName} onClear={clearExactName} scrollOnMount={nameFromUrl} />}
        actions={
          favorites.isAuthenticated && (
            <FavoritesToggleButton
              favoriteCount={favorites.favoriteCount}
              showFavoritesOnly={favorites.showFavoritesOnly}
              onToggle={favorites.toggleShowFavoritesOnly}
            />
          )
        }
      />

      {filteredGemwords.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly && favorites.isAuthenticated
            ? 'No favorite gemwords to show. Star some gemwords or turn off "Favorites only".'
            : 'No gemwords found. Try adjusting your filters or load data first.'}
        </p>
      ) : (
        <SocketableLookupContext value={socketableLookup}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
            {filteredGemwords.map((gemword) => (
              <div key={`${gemword.name}-${String(gemword.variant)}-${gemword.allowedItems.join(',')}`} className="card-visibility-auto">
                <GemwordCard
                  gemword={gemword}
                  gemBonusMap={gemBonusMap}
                  isFavorite={favorites.isFavorite(gemword)}
                  favoriteCount={favorites.count(gemword)}
                  favoritePending={favorites.isPending(gemword)}
                  onToggleFavorite={favorites.toggle}
                />
              </div>
            ))}
          </div>
        </SocketableLookupContext>
      )}
    </PageShell>
  );
}

import { RunewordFilters } from '../components/RunewordFilters';
import { RunewordCard } from '../components/RunewordCard';
import { useFilteredRunewords } from '../hooks/useFilteredRunewords';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { SocketableLookupContext, useSocketableLookupQuery } from '@/core/hooks/useSocketableLookup';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';
import { useItemFavorites } from '@/features/favorites';
import { buildRecipeFavoriteId } from '@/core/utils/recipeFavorites';
import type { Runeword } from '@/core/db/models';
import { useSelector } from 'react-redux';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { selectExactName } from '../store/runewordsSlice';

const getRunewordFavoriteId = (runeword: Runeword) => buildRecipeFavoriteId('runeword', runeword);

export function RunewordsScreen() {
  const { nameFromUrl, clearExactName } = useUrlInitialize();
  // Loaded once for the whole screen: search filtering, badges, tooltips and bonuses
  const socketableLookup = useSocketableLookupQuery();
  const runewords = useFilteredRunewords(socketableLookup);
  const exactName = useSelector(selectExactName);
  const favorites = useItemFavorites<Runeword>({
    getId: getRunewordFavoriteId,
    kindPrefix: 'runeword:',
    filterStorageKey: 'd2r-esr.runewords.favoritesOnly.v1',
  });

  // Loading state
  if (runewords === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredRunewords = favorites.filterItems(runewords);

  return (
    <PageShell title="Runewords" count={filteredRunewords.length}>
      <RunewordFilters />

      <ResultsBar
        summary={`Showing ${String(filteredRunewords.length)} runewords`}
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

      {filteredRunewords.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly && favorites.isAuthenticated
            ? 'No favorite runewords to show. Star some runewords or turn off "Favorites only".'
            : 'No runewords found. Try adjusting your filters or load data first.'}
        </p>
      ) : (
        <SocketableLookupContext value={socketableLookup}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
            {filteredRunewords.map((runeword) => (
              <div key={`${runeword.name}-${String(runeword.variant)}-${runeword.allowedItems.join(',')}`} className="card-visibility-auto">
                <RunewordCard
                  runeword={runeword}
                  isFavorite={favorites.isFavorite(runeword)}
                  favoriteCount={favorites.count(runeword)}
                  favoritePending={favorites.isPending(runeword)}
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

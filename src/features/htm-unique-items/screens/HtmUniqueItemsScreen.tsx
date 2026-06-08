import { HtmUniqueItemFilters } from '../components/HtmUniqueItemFilters';
import { HtmUniqueItemCard } from '../components/HtmUniqueItemCard';
import { useFilteredHtmUniqueItems } from '../hooks/useFilteredHtmUniqueItems';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { buildHtmUniqueItemFavoriteId } from '../utils/htmUniqueItemFavorites';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';
import { useItemFavorites } from '@/features/favorites';
import type { HtmUniqueItem } from '@/core/db';

export function HtmUniqueItemsScreen() {
  useUrlInitialize();
  const items = useFilteredHtmUniqueItems();
  const favorites = useItemFavorites<HtmUniqueItem>({
    getId: buildHtmUniqueItemFavoriteId,
    kindPrefix: 'htmUnique:',
    filterStorageKey: 'd2r-esr.htmUniqueItems.favoritesOnly.v1',
  });

  // Loading state
  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  const filteredItems = favorites.filterItems(items);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Unique Items ({filteredItems.length})</h1>
      <HtmUniqueItemFilters />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Showing {filteredItems.length} unique items</p>
        {favorites.isAuthenticated && (
          <FavoritesToggleButton
            favoriteCount={favorites.favoriteCount}
            showFavoritesOnly={favorites.showFavoritesOnly}
            onToggle={favorites.toggleShowFavoritesOnly}
          />
        )}
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly && favorites.isAuthenticated
            ? 'No favorite unique items to show. Star some items or turn off "Favorites only".'
            : 'No unique items found. Try adjusting your filters.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card-visibility-auto">
              <HtmUniqueItemCard
                item={item}
                isFavorite={favorites.isFavorite(item)}
                favoriteCount={favorites.count(item)}
                favoritePending={favorites.isPending(item)}
                onToggleFavorite={favorites.toggle}
              />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

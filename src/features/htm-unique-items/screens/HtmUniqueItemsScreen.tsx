import { HtmUniqueItemFilters } from '../components/HtmUniqueItemFilters';
import { HtmUniqueItemCard } from '../components/HtmUniqueItemCard';
import { useFilteredHtmUniqueItems } from '../hooks/useFilteredHtmUniqueItems';
import { useHtmUniqueItemFavorites } from '../hooks/useHtmUniqueItemFavorites';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { FavoritesToggleButton } from '@/core/components/FavoritesToggleButton';

export function HtmUniqueItemsScreen() {
  useUrlInitialize();
  const items = useFilteredHtmUniqueItems();
  const favorites = useHtmUniqueItemFavorites();

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
        <FavoritesToggleButton
          favoriteCount={favorites.favoriteCount}
          showFavoritesOnly={favorites.showFavoritesOnly}
          onToggle={favorites.toggleShowFavoritesOnly}
        />
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {favorites.showFavoritesOnly
            ? 'No favorite unique items to show. Star some items or turn off "Favorites only".'
            : 'No unique items found. Try adjusting your filters.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div key={item.id} className="card-visibility-auto">
              <HtmUniqueItemCard item={item} isFavorite={favorites.isFavorite(item)} onToggleFavorite={favorites.toggleFavorite} />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

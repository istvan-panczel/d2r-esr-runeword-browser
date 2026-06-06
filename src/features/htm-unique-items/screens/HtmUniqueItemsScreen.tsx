import { HtmUniqueItemFilters } from '../components/HtmUniqueItemFilters';
import { HtmUniqueItemCard } from '../components/HtmUniqueItemCard';
import { useFilteredHtmUniqueItems } from '../hooks/useFilteredHtmUniqueItems';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';

export function HtmUniqueItemsScreen() {
  useUrlInitialize();
  const items = useFilteredHtmUniqueItems();

  // Loading state
  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Unique Items ({items.length})</h1>
      <HtmUniqueItemFilters />

      <p className="text-sm text-muted-foreground mb-4">Showing {items.length} unique items</p>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No unique items found. Try adjusting your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="card-visibility-auto">
              <HtmUniqueItemCard item={item} />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

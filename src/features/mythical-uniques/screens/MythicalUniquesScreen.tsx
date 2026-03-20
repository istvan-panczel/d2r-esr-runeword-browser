import { MythicalUniqueFilters } from '../components/MythicalUniqueFilters';
import { MythicalUniqueCard } from '../components/MythicalUniqueCard';
import { useFilteredMythicalUniques } from '../hooks/useFilteredMythicalUniques';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';

export function MythicalUniquesScreen() {
  useUrlInitialize();
  const items = useFilteredMythicalUniques();

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
      <h1 className="text-2xl font-bold mb-4">Mythical Uniques ({items.length})</h1>
      <MythicalUniqueFilters />

      <p className="text-sm text-muted-foreground mb-4">Showing {items.length} mythical uniques</p>

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No mythical uniques found. Try adjusting your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <MythicalUniqueCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </div>
  );
}

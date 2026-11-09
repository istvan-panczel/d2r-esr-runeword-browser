import { AscendancyFilters } from '../components/AscendancyFilters';
import { AscendancyHowToPanel } from '../components/AscendancyHowToPanel';
import { AscendancyCard } from '../components/AscendancyCard';
import { useFilteredAscendancies } from '../hooks/useFilteredAscendancies';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { Spinner } from '@/components/ui/spinner';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';

export function AscendanciesScreen() {
  useUrlInitialize();
  const items = useFilteredAscendancies();

  // Loading state
  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <PageShell title="Ascendancies" count={items.length}>
      <AscendancyHowToPanel />

      <AscendancyFilters />

      <ResultsBar summary={`Showing ${String(items.length)} ascendancies`} />

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No ascendancies found. Try adjusting your search.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
          {items.map((item) => (
            <AscendancyCard key={item.name} item={item} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

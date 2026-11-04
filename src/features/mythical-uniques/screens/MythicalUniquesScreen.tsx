import { MythicalUniqueFilters } from '../components/MythicalUniqueFilters';
import { MythicalUniqueCard } from '../components/MythicalUniqueCard';
import { useFilteredMythicalUniques } from '../hooks/useFilteredMythicalUniques';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { selectExactName } from '../store';
import { useSelector } from 'react-redux';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { Spinner } from '@/components/ui/spinner';
import { ScrollToTopButton } from '@/components/ScrollToTopButton';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';
import { useItemSources } from '@/features/game-data/hooks/useItemSources';

export function MythicalUniquesScreen() {
  const { nameFromUrl, clearExactName } = useUrlInitialize();
  const items = useFilteredMythicalUniques();
  const exactName = useSelector(selectExactName);
  const sourceIndex = useItemSources();

  // Loading state
  if (items === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <PageShell title="Mythical Uniques" count={items.length}>
      <MythicalUniqueFilters />

      <ResultsBar
        summary={`Showing ${String(items.length)} mythical uniques`}
        chips={exactName !== null && <ExactNameChip name={exactName} onClear={clearExactName} scrollOnMount={nameFromUrl} />}
      />

      {items.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No mythical uniques found. Try adjusting your filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7 gap-4">
          {items.map((item) => (
            <div key={item.id} className="card-visibility-auto">
              <MythicalUniqueCard item={item} sourceIndex={sourceIndex} />
            </div>
          ))}
        </div>
      )}

      <ScrollToTopButton />
    </PageShell>
  );
}

import { useSelector } from 'react-redux';
import { SocketableFilters } from '../components/SocketableFilters';
import { SocketableCard } from '../components/SocketableCard';
import { useFilteredSocketables } from '../hooks/useFilteredSocketables';
import { useUrlInitialize } from '../hooks/useUrlInitialize';
import { selectEnabledCategories, selectExactName } from '../store/socketablesSlice';
import { ExactNameChip } from '@/core/components/ExactNameChip';
import { Spinner } from '@/components/ui/spinner';
import { PageShell } from '@/components/PageShell';
import { ResultsBar } from '@/components/ResultsBar';
import { useItemSources } from '@/features/game-data/hooks/useItemSources';

export function SocketablesScreen() {
  const { nameFromUrl, clearExactName } = useUrlInitialize();
  const socketables = useFilteredSocketables();
  const sourceIndex = useItemSources();
  const enabledCategories = useSelector(selectEnabledCategories);
  const exactName = useSelector(selectExactName);
  const noCategoriesSelected = !Object.values(enabledCategories).some(Boolean);

  // Loading state
  if (socketables === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <PageShell title="Socketables" count={socketables.length}>
      <SocketableFilters />

      <ResultsBar
        summary={`Showing ${String(socketables.length)} socketables`}
        chips={exactName !== null && <ExactNameChip name={exactName} onClear={clearExactName} scrollOnMount={nameFromUrl} />}
      />

      {socketables.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          {noCategoriesSelected
            ? 'No categories selected. Select at least one category to see socketables.'
            : 'No socketables found. Try adjusting your filters or load data first.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 @8xl/page:grid-cols-5 @9xl/page:grid-cols-6 @10xl/page:grid-cols-8 @11xl/page:grid-cols-9 gap-4">
          {socketables.map((socketable) => (
            <div key={`${socketable.category}-${socketable.name}`} className="card-visibility-auto">
              <SocketableCard socketable={socketable} sourceIndex={sourceIndex} />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

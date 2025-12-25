import { RunewordFilters } from '../components/RunewordFilters';
import { RunewordCard } from '../components/RunewordCard';
import { useFilteredRunewords } from '../hooks/useFilteredRunewords';
import { useUrlSync } from '../hooks/useUrlSync';
import { Spinner } from '@/components/ui/spinner';

export function RunewordsScreen() {
  useUrlSync();
  const runewords = useFilteredRunewords();

  // Loading state
  if (runewords === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Runewords</h1>
      <RunewordFilters />

      {runewords.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No runewords found. Try adjusting your filters or load data first.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {runewords.map((runeword) => (
            <RunewordCard key={`${runeword.name}-${String(runeword.variant)}`} runeword={runeword} />
          ))}
        </div>
      )}
    </div>
  );
}

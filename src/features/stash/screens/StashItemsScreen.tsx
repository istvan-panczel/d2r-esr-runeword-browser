import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { SummaryChips } from '../components/shared/SummaryChips';
import { StashGate } from '../components/StashGate';
import { stashCatalog } from '../engine/catalog';
import { describeStashItem } from '../engine/describeItem';
import { walkStashItems } from '../engine/walk';
import { useStash } from '../hooks/useStash';
import { useStashTypes } from '../hooks/useStashTypes';

/**
 * /stash/items: every item on the stash pages (docs/features/STASH-ITEMS.md). STUB of the foundation phase: the counts
 * the shared engine gives; the page workstream replaces it with the table / card view, search and filters.
 */
export function StashItemsScreen() {
  const { bundle } = useStash();
  const types = useStashTypes();
  return (
    <StashGate>
      {(stash) => {
        if (types.status === 'loading') return <GameDataLoading />;
        if (types.status === 'error') return <GameDataError error={types.error} onRetry={types.retry} />;
        const catalog = stashCatalog(bundle, types.types);
        const items = walkStashItems(stash).map(({ item }) => describeStashItem(item, catalog));
        const count = (kinds: readonly string[]) => items.filter((item) => kinds.includes(item.kind)).length;
        return (
          <div className="space-y-4">
            <SummaryChips
              chips={[
                { value: items.length, label: 'items on your stash pages' },
                { value: count(['unique']), label: 'uniques' },
                { value: count(['set']), label: 'set items' },
                { value: count(['runeword']), label: 'runewords' },
              ]}
            />
            <p className="text-sm text-muted-foreground">The item list with search, stat filters and sorting is coming here.</p>
          </div>
        );
      }}
    </StashGate>
  );
}

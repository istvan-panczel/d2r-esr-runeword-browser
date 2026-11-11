import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EnhanceSearch } from '@/features/game-data/components/EnhanceParts';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { ItemCard } from '@/features/stash/components/items/ItemCards';
import { STASH_SEARCH_HELP } from '@/features/stash/components/shared/stashSearchHelp';
import { ToolbarCard } from '@/components/ToolbarCard';
import { filterStorageSections, type FilteredSection } from '../../engine/characterStorage';
import { useCharacterItems } from '../../hooks/useCharacterItems';
import type { CharacterFile } from '../../parser/types';
import { ITEM_GRID_CLASS } from './tabClasses';

function StorageSection({ entry, filtered }: { readonly entry: FilteredSection; readonly filtered: boolean }) {
  const { section, rows } = entry;
  const count = filtered ? `${String(rows.length)} of ${String(section.rows.length)}` : String(rows.length);
  return (
    <details open className="group rounded-xl border bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h3 className="font-semibold">
          {section.title} <span className="font-normal text-muted-foreground tabular-nums">({count})</span>
        </h3>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-2 px-4 pb-4">
        {section.note !== undefined && <p className="text-xs text-muted-foreground">{section.note}</p>}
        <ul className={ITEM_GRID_CLASS}>
          {rows.map((item) => (
            <li key={item.key}>
              <ItemCard row={item.row} where={item.where} />
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

/** Storage: inventory, belt, Horadric Cube, personal stash (and other, corpse, golem items when present), each list collapsible, with the All Items search. */
export function StorageTab({ character }: { readonly character: CharacterFile }) {
  const items = useCharacterItems(character);
  const [search, setSearch] = useState('');
  if (items.status === 'loading') return <GameDataLoading />;
  if (items.status === 'error') return <GameDataError error={items.error} onRetry={items.retry} />;
  const { storage } = items.view;
  const shown = filterStorageSections(storage, search, items.types);
  const filtered = search.trim() !== '';

  if (storage.length === 0) {
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing carried or stored.</p>;
  }

  return (
    <div className="space-y-4">
      <ToolbarCard>
        <EnhanceSearch
          id="character-storage-search"
          label="Search items"
          value={search}
          onChange={setSearch}
          onClear={() => {
            setSearch('');
          }}
          placeholder="Search name, base, type, stat text..."
          hint="Search the name, base, item type (belt, ring…), quality, socketed items and stat text;"
          help={STASH_SEARCH_HELP}
        />
      </ToolbarCard>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No item matches the search.</p>
      ) : (
        shown.map((entry) => <StorageSection key={entry.section.key} entry={entry} filtered={filtered} />)
      )}
    </div>
  );
}

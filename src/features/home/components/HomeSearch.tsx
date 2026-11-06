import { useState, type FocusEvent } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { selectError, selectIsInitialized } from '@/core/store';
import { useBundleNames, useItemNames } from '../hooks/useHomeSearchSources';
import { runewordsSearchHref, searchHome, type HomeSearchSources } from '../utils/homeSearch';

const SEARCH_ALL_VALUE = '__search-runewords';
const ITEM_CLASS =
  'data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-primary/50 data-[selected=true]:ring-inset';

/**
 * One input over every name list: runewords, gemwords, uniques and mythicals (Dexie, once the startup sync is done) and
 * bases, sets, skills, modifiers, materials, areas and cube recipe families (static bundles, fetched on the first keystroke). Picking
 * a result opens its page focused on it; Enter on the first row (selected by default) runs the runewords free-text search.
 */
export function HomeSearch() {
  const navigate = useNavigate();
  const isInitialized = useSelector(selectIsInitialized);
  const syncError = useSelector(selectError);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  // Nothing is read or fetched until the visitor starts typing.
  const [activated, setActivated] = useState(false);
  const itemNames = useItemNames(activated && isInitialized);
  const bundleNames = useBundleNames(activated);

  const trimmed = query.trim();
  const sources: HomeSearchSources = { ...itemNames, ...bundleNames.sources };
  const groups = searchHome(trimmed, sources);
  const showList = open && trimmed !== '';
  const itemsPending = !isInitialized || itemNames === undefined;
  const bundlesPending = bundleNames.pending;

  const go = (href: string) => {
    setOpen(false);
    void navigate(href);
  };

  const handleValueChange = (value: string) => {
    setQuery(value);
    setOpen(true);
    if (!activated && value.trim() !== '') setActivated(true);
  };

  // Close when focus leaves the search (the result rows keep focus on the input, see onMouseDown below).
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <div className="relative" onBlur={handleBlur}>
      <Command
        shouldFilter={false}
        loop
        label="Search"
        className="overflow-visible rounded-lg border bg-background shadow-xs **:data-[slot=command-input-wrapper]:h-11 **:data-[slot=command-input-wrapper]:border-b-0"
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <CommandInput
          value={query}
          onValueChange={handleValueChange}
          onFocus={() => {
            setOpen(true);
          }}
          placeholder="Search items, skills, areas, recipes…"
          className="h-11 text-base sm:text-sm"
        />
        {showList && (
          <CommandList
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-[min(60svh,28rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            <CommandGroup>
              <CommandItem
                value={SEARCH_ALL_VALUE}
                onSelect={() => {
                  go(runewordsSearchHref(trimmed));
                }}
                className={ITEM_CLASS}
              >
                <Search aria-hidden />
                <span className="min-w-0 truncate">
                  Search runewords for <span className="font-medium">“{trimmed}”</span>
                </span>
              </CommandItem>
            </CommandGroup>
            {itemsPending && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {syncError !== null && !isInitialized
                  ? 'Runeword and unique data could not be loaded; only the game-data lists are searched.'
                  : 'Runeword and unique data is still loading…'}
              </p>
            )}
            {groups.map((group) => (
              <CommandGroup key={group.category} heading={group.label}>
                {group.results.map((result) => (
                  <CommandItem
                    key={result.href}
                    value={`${group.category}:${result.href}`}
                    onSelect={() => {
                      go(result.href);
                    }}
                    className={ITEM_CLASS}
                  >
                    <span className="min-w-0 truncate">{result.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {groups.length === 0 && !itemsPending && !bundlesPending && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No names match; Enter searches the runeword bonuses too.</p>
            )}
            {bundlesPending && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading bases, sets, skills, modifiers, materials and areas…</p>
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}

import { useState, type FocusEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, CommandInput, CommandList } from '@/components/ui/command';
import { useHomeSearch } from '../hooks/useHomeSearch';
import { HomeSearchResults, SearchRunewordsRow } from './HomeSearchRows';

/**
 * One input over every name list: runewords, gemwords, uniques and mythicals (Dexie, once the startup sync is done) and
 * bases, sets, skills, modifiers, materials, areas and cube recipe families (static bundles, fetched on the first keystroke). Picking
 * a result opens its page focused on it; Enter on the first row (selected by default) runs the runewords free-text search.
 */
export function HomeSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const trimmed = query.trim();
  const search = useHomeSearch(trimmed);
  const showList = open && trimmed !== '';

  const go = (href: string) => {
    setOpen(false);
    void navigate(href);
  };

  const handleValueChange = (value: string) => {
    setQuery(value);
    setOpen(true);
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
            <SearchRunewordsRow query={trimmed} onSelect={go} />
            <HomeSearchResults search={search} onSelect={go} />
          </CommandList>
        )}
      </Command>
    </div>
  );
}

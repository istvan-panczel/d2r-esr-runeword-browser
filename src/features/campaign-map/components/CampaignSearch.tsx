import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { CampaignMap, CampaignSectionKey } from '../engine/types';
import { searchCampaignMap, SEARCH_KIND_LABELS } from '../utils/search';

const ITEM_CLASS =
  'data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-primary/50 data-[selected=true]:ring-inset';

interface CampaignSearchProps {
  readonly map: CampaignMap;
  readonly itemNames: ReadonlyMap<string, string> | null;
  readonly sectionTitle: (key: CampaignSectionKey) => string;
  /** A result was picked */
  readonly onPick: (id: number) => void;
}

/** True when a keystroke goes to a text field (the `/` shortcut must not steal it) */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

/**
 * "Find an area, boss or quest item" combobox (cmdk, our own matching). `/` anywhere on the page focuses it; picking a
 * result hands the area to the page (switch tab, select, pulse).
 */
export function CampaignSearch({ map, itemNames, sectionTitle, onPick }: CampaignSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hits = searchCampaignMap(map.areas.values(), query, (code) => itemNames?.get(code));
  const showList = open && query.trim() !== '';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const pick = (id: number) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    onPick(id);
  };

  // Close when focus leaves the search (the result rows keep focus on the input, see onMouseDown below).
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <div className="relative w-full sm:max-w-sm" onBlur={handleBlur}>
      <Command
        shouldFilter={false}
        loop
        label="Find an area, boss or quest item"
        className="overflow-visible rounded-md border bg-background shadow-xs **:data-[slot=command-input-wrapper]:h-9 **:data-[slot=command-input-wrapper]:border-b-0"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            // Keep the page's Esc (clear the selection) for when the search is closed.
            if (showList) event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <CommandInput
          ref={inputRef}
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
          }}
          placeholder="Find an area, boss or quest item…  ( / )"
          className="h-9"
        />
        {showList && (
          <CommandList
            className="absolute inset-x-0 top-full z-50 mt-1 max-h-[min(60svh,26rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            onMouseDown={(event) => {
              event.preventDefault();
            }}
          >
            {hits.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {itemNames === null
                  ? 'No area or boss matches (quest item names are still loading).'
                  : 'No area, boss or quest item matches.'}
              </p>
            ) : (
              hits.map((hit) => {
                const area = map.areas.get(hit.id);
                if (area === undefined) return null;
                return (
                  <CommandItem
                    key={hit.id}
                    value={String(hit.id)}
                    onSelect={() => {
                      pick(hit.id);
                    }}
                    className={`flex-col items-start gap-0 ${ITEM_CLASS}`}
                  >
                    <span className="font-medium">{area.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {sectionTitle(area.section)}
                      {hit.kind === 'area' ? '' : ` · ${SEARCH_KIND_LABELS[hit.kind]}: ${hit.text}`}
                    </span>
                  </CommandItem>
                );
              })
            )}
          </CommandList>
        )}
      </Command>
    </div>
  );
}

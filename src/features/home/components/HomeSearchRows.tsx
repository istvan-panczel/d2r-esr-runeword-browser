import type { ComponentProps } from 'react';
import { Search } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import type { HomeSearchState } from '../hooks/useHomeSearch';
import { homeSearchRowValue, runewordsSearchHref, SEARCH_RUNEWORDS_VALUE } from '../utils/homeSearch';

const ITEM_CLASS =
  'data-[selected=true]:bg-accent data-[selected=true]:ring-1 data-[selected=true]:ring-primary/50 data-[selected=true]:ring-inset';

const NOTE_CLASS = 'px-3 py-2 text-xs text-muted-foreground';

/** A result row of the home page search and the global search dialog. */
export function HomeSearchRow(props: ComponentProps<typeof CommandItem>) {
  return <CommandItem className={ITEM_CLASS} {...props} />;
}

interface SearchRunewordsRowProps {
  /** The trimmed query */
  readonly query: string;
  readonly onSelect: (href: string) => void;
  /** Maps a row's cmdk value (the dialog's `FIRST_ROW_VALUE`); the row's own value by default */
  readonly rowValue?: (value: string) => string;
}

const ownValue = (value: string) => value;

/** The "Search runewords for …" row: the runewords free-text search over names and bonuses. */
export function SearchRunewordsRow({ query, onSelect, rowValue = ownValue }: SearchRunewordsRowProps) {
  return (
    <CommandGroup>
      <HomeSearchRow
        value={rowValue(SEARCH_RUNEWORDS_VALUE)}
        onSelect={() => {
          onSelect(runewordsSearchHref(query));
        }}
      >
        <Search aria-hidden />
        <span className="min-w-0 truncate">
          Search runewords for <span className="font-medium">“{query}”</span>
        </span>
      </HomeSearchRow>
    </CommandGroup>
  );
}

interface HomeSearchResultsProps {
  readonly search: HomeSearchState;
  readonly onSelect: (href: string) => void;
  /** Other rows matched (the dialog's pages), so "no names match" would be wrong */
  readonly hasOtherResults?: boolean;
  readonly rowValue?: (value: string) => string;
}

/** The result groups and the loading notes around them. */
export function HomeSearchResults({ search, onSelect, hasOtherResults = false, rowValue = ownValue }: HomeSearchResultsProps) {
  const { groups, itemsPending, bundlesPending, itemsFailed } = search;
  return (
    <>
      {itemsPending && (
        <p className={NOTE_CLASS}>
          {itemsFailed
            ? 'Runeword and unique data could not be loaded; only the game-data lists are searched.'
            : 'Runeword and unique data is still loading…'}
        </p>
      )}
      {groups.map((group) => (
        <CommandGroup key={group.category} heading={group.label}>
          {group.results.map((result) => (
            <HomeSearchRow
              key={result.href}
              value={rowValue(homeSearchRowValue(group.category, result.href))}
              onSelect={() => {
                onSelect(result.href);
              }}
            >
              <span className="min-w-0 truncate">{result.name}</span>
            </HomeSearchRow>
          ))}
        </CommandGroup>
      ))}
      {groups.length === 0 && !hasOtherResults && !itemsPending && !bundlesPending && (
        <p className={NOTE_CLASS}>No names match; Enter searches the runeword bonuses too.</p>
      )}
      {bundlesPending && <p className={NOTE_CLASS}>Loading bases, sets, skills, modifiers, materials and areas…</p>}
    </>
  );
}

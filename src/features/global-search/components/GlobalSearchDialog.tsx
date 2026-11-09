import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Command, CommandGroup, CommandInput, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getNavEntries } from '@/core/navigation/navConfig';
import { selectAuthIsConfigured } from '@/features/auth';
import { HomeSearchResults, HomeSearchRow, SearchRunewordsRow } from '@/features/home/components/HomeSearchRows';
import { useHomeSearch } from '@/features/home/hooks/useHomeSearch';
import { searchPages } from '../utils/pageSearch';
import { FIRST_ROW_VALUE, firstRowValue, pageRowValue } from '../utils/searchRows';

/** The input and the results. It lives inside DialogContent, which unmounts on close, so every open starts empty. */
function GlobalSearchPanel({ onClose }: { readonly onClose: () => void }) {
  const navigate = useNavigate();
  const isSupabaseEnabled = useSelector(selectAuthIsConfigured);
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const search = useHomeSearch(trimmed);
  const pages = searchPages(trimmed, getNavEntries(isSupabaseEnabled));
  const firstRow = firstRowValue(pages, search.groups);
  const rowValue = (value: string) => (value === firstRow ? FIRST_ROW_VALUE : value);

  const go = (href: string) => {
    onClose();
    void navigate(href);
  };

  return (
    // The ranking is ours (shouldFilter off). vimBindings off: its Ctrl+K "move up" would fire together with the close shortcut.
    <Command
      shouldFilter={false}
      loop
      vimBindings={false}
      label="Search"
      className="bg-background **:data-[slot=command-input-wrapper]:h-12"
    >
      {/* pr-8 clears the dialog's close button */}
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, items, skills, areas, recipes…"
        className="h-12 pr-8 text-base sm:text-sm"
      />
      {/* A fixed height: the dialog is centred, so a list that grew with the results would move the input while typing. */}
      <CommandList className="h-[min(60svh,28rem)] max-h-none p-1">
        {trimmed === '' ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Type to search pages, items, skills, areas and recipes.</p>
        ) : (
          <>
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((page) => (
                  <HomeSearchRow
                    key={page.href}
                    value={rowValue(pageRowValue(page.href))}
                    onSelect={() => {
                      go(page.href);
                    }}
                  >
                    <span className="min-w-0 truncate">{page.name}</span>
                    {page.section !== null && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{page.section}</span>}
                  </HomeSearchRow>
                ))}
              </CommandGroup>
            )}
            <HomeSearchResults search={search} onSelect={go} hasOtherResults={pages.length > 0} rowValue={rowValue} />
            <SearchRunewordsRow query={trimmed} onSelect={go} rowValue={rowValue} />
          </>
        )}
      </CommandList>
    </Command>
  );
}

interface GlobalSearchDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCloseAutoFocus: (event: Event) => void;
}

/** The search dialog, a lazy chunk of its own (with cmdk and the search code); `GlobalSearch` opens it. */
export function GlobalSearchDialog({ open, onOpenChange, onCloseAutoFocus }: GlobalSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, items, skills, areas and recipes. Enter opens the selected result.
        </DialogDescription>
        <GlobalSearchPanel
          onClose={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

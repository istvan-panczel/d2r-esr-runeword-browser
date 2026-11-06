import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, X } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  selectSharedFiltersSearchText,
  selectSharedFiltersSortMode,
  setSharedFiltersSearchText,
  setSharedFiltersSortMode,
  type SharedFilterSort,
} from '../../sharing';

const SEARCH_DEBOUNCE_MS = 300;

const SORT_LABELS: Readonly<Record<SharedFilterSort, string>> = {
  newest: 'Newest',
  most_liked: 'Most liked',
  most_downloaded: 'Most downloaded',
};

const SORTS = Object.keys(SORT_LABELS) as SharedFilterSort[];

/**
 * Search by name (debounced, server-side) and the sort of the Shared tab, as the builds list has them. Rendered on the
 * library's toolbar card next to the Shared / My filters switch (it grows to fill that row).
 */
export function SharedFiltersToolbar() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSharedFiltersSearchText);
  const sortMode = useSelector(selectSharedFiltersSortMode);

  const [localSearch, setLocalSearch] = useState(searchText);

  // Keep the input in sync when the store value changes elsewhere (e.g. cleared).
  const [prevSearch, setPrevSearch] = useState(searchText);
  if (searchText !== prevSearch) {
    setPrevSearch(searchText);
    setLocalSearch(searchText);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchText) dispatch(setSharedFiltersSearchText(localSearch));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [localSearch, searchText, dispatch]);

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      <InputGroup className="max-w-xs flex-1">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search filters..."
          aria-label="Search shared filters by name"
          value={localSearch}
          onChange={(event) => {
            setLocalSearch(event.target.value);
          }}
        />
        {localSearch.length > 0 && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => {
                setLocalSearch('');
                dispatch(setSharedFiltersSearchText(''));
              }}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>

      <Select
        value={sortMode}
        onValueChange={(value) => {
          dispatch(setSharedFiltersSortMode(value as SharedFilterSort));
        }}
      >
        <SelectTrigger className="w-44" aria-label="Sort shared filters">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

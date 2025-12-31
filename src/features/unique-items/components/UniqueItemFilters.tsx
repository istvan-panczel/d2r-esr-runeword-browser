import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { ItemTypeFilter } from './ItemTypeFilter';
import { setSearchText, selectSearchText } from '../store';

const SEARCH_DEBOUNCE_MS = 300;

export function UniqueItemFilters() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSearchText);

  const [localSearchText, setLocalSearchText] = useState(searchText);

  // Sync local state when Redux state changes externally
  useEffect(() => {
    setLocalSearchText(searchText);
  }, [searchText]);

  // Debounce dispatch to Redux
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchText !== searchText) {
        dispatch(setSearchText(localSearchText));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [localSearchText, searchText, dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    setLocalSearchText('');
    dispatch(setSearchText(''));
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Search row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton />
          </div>
          <Label htmlFor="unique-search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="unique-search"
              type="text"
              placeholder="Search name or properties..."
              value={localSearchText}
              onChange={handleSearchChange}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {localSearchText && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClearSearch} aria-label="Clear search">
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
      </div>

      {/* Item Type Filter */}
      <ItemTypeFilter />
    </div>
  );
}

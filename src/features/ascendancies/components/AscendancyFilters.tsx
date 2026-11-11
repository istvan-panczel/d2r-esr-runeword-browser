import { useDispatch, useSelector } from 'react-redux';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { useShareUrl } from '../hooks/useShareUrl';
import { setSearchText, selectSearchText } from '../store';

const SEARCH_DEBOUNCE_MS = 300;

const SEARCH_EXAMPLES = [
  { query: 'spell damage', description: 'ascendancies with "spell damage"' },
  { query: '"class skill"', description: 'exact phrase match' },
  { query: 'resist strength', description: 'both "resist" and "strength"' },
];

export function AscendancyFilters() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSearchText);
  const getShareUrl = useShareUrl();

  const [localSearchText, setLocalSearchText, commitSearchText] = useDebouncedFilterValue(
    searchText,
    (value) => dispatch(setSearchText(value)),
    SEARCH_DEBOUNCE_MS
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    commitSearchText('');
  };

  return (
    <FilterPanel>
      <div className="flex flex-wrap items-end gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton examples={SEARCH_EXAMPLES} />
          </div>
          <Label htmlFor="ascendancy-search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="ascendancy-search"
              type="text"
              placeholder="Search name, bonuses or gems..."
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

        {/* Copy Link button */}
        <CopyLinkButton getShareUrl={getShareUrl} />
      </div>
    </FilterPanel>
  );
}

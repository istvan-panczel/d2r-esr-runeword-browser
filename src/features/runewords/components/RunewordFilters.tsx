import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { RuneCheckboxGroup } from './RuneCheckboxGroup';
import { ItemTypeFilter } from './ItemTypeFilter';
import { useShareUrl } from '../hooks/useShareUrl';
import {
  setSearchText,
  setSocketCount,
  selectSearchText,
  selectSocketCount,
  selectAllRunes,
  deselectAllRunes,
  selectSelectedRunes,
} from '../store/runewordsSlice';

const SEARCH_DEBOUNCE_MS = 300;

export function RunewordFilters() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const selectedRunes = useSelector(selectSelectedRunes);
  const getShareUrl = useShareUrl();

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

  const handleSocketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      dispatch(setSocketCount(null));
    } else {
      const num = parseInt(value, 10);
      if (num >= 1 && num <= 6) {
        dispatch(setSocketCount(num));
      }
    }
  };

  const handleClearSockets = () => {
    dispatch(setSocketCount(null));
  };

  const allRunesSelected = Object.keys(selectedRunes).length > 0 && Object.values(selectedRunes).every(Boolean);
  const noRunesSelected = Object.keys(selectedRunes).length > 0 && Object.values(selectedRunes).every((v) => !v);

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Socket row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton />
          </div>
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="search"
              type="text"
              placeholder="Search name or affixes..."
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

        {/* Socket count */}
        <div className="w-32 space-y-1">
          <p className="text-xs text-muted-foreground">Filter by # of sockets.</p>
          <Label htmlFor="sockets" className="sr-only">
            Sockets
          </Label>
          <InputGroup>
            <InputGroupInput
              id="sockets"
              type="number"
              min={1}
              max={6}
              placeholder="Sockets"
              value={socketCount ?? ''}
              onChange={handleSocketChange}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {socketCount !== null && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClearSockets} aria-label="Clear sockets">
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Copy Link button */}
        <CopyLinkButton getShareUrl={getShareUrl} />
      </div>

      {/* Item Type Filter */}
      <ItemTypeFilter />

      {/* Rune Filter with All/None toggles */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Runes:</span>
          <Button variant="outline" size="sm" onClick={() => dispatch(selectAllRunes())} disabled={allRunesSelected}>
            All
          </Button>
          <Button variant="outline" size="sm" onClick={() => dispatch(deselectAllRunes())} disabled={noRunesSelected}>
            None
          </Button>
        </div>
        <RuneCheckboxGroup />
      </div>
    </div>
  );
}

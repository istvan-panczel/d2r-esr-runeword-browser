import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { RuneCheckboxGroup } from './RuneCheckboxGroup';
import { ItemTypeFilter } from './ItemTypeFilter';
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

  const allRunesSelected = Object.keys(selectedRunes).length > 0 && Object.values(selectedRunes).every(Boolean);
  const noRunesSelected = Object.keys(selectedRunes).length > 0 && Object.values(selectedRunes).every((v) => !v);

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Socket row */}
      <div className="flex flex-wrap gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md">
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
        <div className="w-24">
          <Label htmlFor="sockets" className="sr-only">
            Sockets
          </Label>
          <Input id="sockets" type="number" min={1} max={6} placeholder="Sockets" value={socketCount ?? ''} onChange={handleSocketChange} />
        </div>
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
